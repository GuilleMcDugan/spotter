import { loadConfig } from '../config.js'

export interface SfxGenerateResult {
  filePath: string
  provider: string
  prompt: string
  durationSeconds: number
}

export interface SfxSearchResult {
  id: string
  name: string
  duration: number
  username: string
  license: string
  previewUrl: string
  sourceUrl: string
  provider: string
}

export interface SfxProvider {
  name: string
  canGenerate: boolean
  canSearch: boolean
  generate?(prompt: string, durationSeconds: number, outputDir: string): Promise<SfxGenerateResult>
  search?(query: string, maxResults?: number): Promise<SfxSearchResult[]>
}

// ─── ElevenLabs provider ─────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const elevenLabsProvider: SfxProvider = {
  name: 'elevenlabs',
  canGenerate: true,
  canSearch: false,

  async generate(prompt, durationSeconds, outputDir) {
    const cfg = loadConfig()
    const key = cfg.providers['elevenlabs']?.apiKey
    if (!key) throw new Error('ElevenLabs API key not configured. Run: spotter-mcp config set elevenlabs.apiKey YOUR_KEY')

    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds, prompt_influence: 0.6 })
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`ElevenLabs error ${res.status}: ${body.slice(0, 200)}`)
    }

    fs.mkdirSync(outputDir, { recursive: true })
    const slug = prompt.slice(0, 32).replace(/[^a-zA-Z0-9]/g, '_')
    const id = crypto.randomBytes(4).toString('hex')
    const filename = `el_${slug}_${id}.mp3`
    const filePath = path.join(outputDir, filename)
    fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()))

    return { filePath, provider: 'elevenlabs', prompt, durationSeconds }
  }
}

// ─── Freesound provider ──────────────────────────────────────────────────────

const freesoundProvider: SfxProvider = {
  name: 'freesound',
  canGenerate: false,
  canSearch: true,

  async search(query, maxResults = 12) {
    const cfg = loadConfig()
    const key = cfg.providers['freesound']?.apiKey
    if (!key) throw new Error('Freesound API key not configured. Run: spotter-mcp config set freesound.apiKey YOUR_KEY')

    const params = new URLSearchParams({
      query, token: key,
      fields: 'id,name,duration,previews,license,username,url',
      page_size: String(maxResults),
      filter: 'duration:[1 TO 60]',
      sort: 'score'
    })
    const res = await fetch(`https://freesound.org/apiv2/search/text/?${params}`)
    if (!res.ok) throw new Error(`Freesound error ${res.status}`)

    const data = await res.json() as { results: Array<{
      id: number; name: string; duration: number; username: string;
      license: string; previews: Record<string, string>; url: string
    }> }

    return (data.results ?? []).map(r => ({
      id: String(r.id),
      name: r.name,
      duration: r.duration,
      username: r.username,
      license: r.license,
      previewUrl: r.previews?.['preview-hq-mp3'] ?? '',
      sourceUrl: r.url,
      provider: 'freesound'
    }))
  }
}

// ─── Custom provider (generic REST) ─────────────────────────────────────────

function buildCustomProvider(name: string): SfxProvider {
  return {
    name,
    canGenerate: true,
    canSearch: false,

    async generate(prompt, durationSeconds, outputDir) {
      const cfg = loadConfig()
      const pc = cfg.providers[name]
      if (!pc?.endpoint) throw new Error(`Provider "${name}" has no endpoint configured`)
      if (!pc.apiKey) throw new Error(`Provider "${name}" has no apiKey configured`)

      const res = await fetch(pc.endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${pc.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, duration_seconds: durationSeconds })
      })
      if (!res.ok) throw new Error(`${name} error ${res.status}: ${(await res.text()).slice(0, 200)}`)

      const contentType = res.headers.get('content-type') ?? ''
      const ext = contentType.includes('wav') ? 'wav' : contentType.includes('ogg') ? 'ogg' : 'mp3'
      fs.mkdirSync(outputDir, { recursive: true })
      const slug = prompt.slice(0, 32).replace(/[^a-zA-Z0-9]/g, '_')
      const id = crypto.randomBytes(4).toString('hex')
      const filePath = path.join(outputDir, `${name}_${slug}_${id}.${ext}`)
      fs.writeFileSync(filePath, Buffer.from(await res.arrayBuffer()))

      return { filePath, provider: name, prompt, durationSeconds }
    }
  }
}

// ─── Registry ────────────────────────────────────────────────────────────────

const BUILT_IN: Record<string, SfxProvider> = {
  elevenlabs: elevenLabsProvider,
  freesound: freesoundProvider,
}

export function getProvider(name?: string): SfxProvider {
  const cfg = loadConfig()
  const target = name ?? Object.keys(cfg.providers).find(k => cfg.providers[k].enabled) ?? 'elevenlabs'
  return BUILT_IN[target] ?? buildCustomProvider(target)
}

export function listProviders(): Array<{ name: string; enabled: boolean; hasKey: boolean; type: string }> {
  const cfg = loadConfig()
  return Object.entries(cfg.providers).map(([name, pc]) => ({
    name,
    enabled: pc.enabled,
    hasKey: !!pc.apiKey,
    type: pc.type ?? (BUILT_IN[name]?.canGenerate ? 'sfx-generate' : 'sfx-search')
  }))
}
