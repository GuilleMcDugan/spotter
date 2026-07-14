import fs from 'fs'
import path from 'path'
import os from 'os'

export interface ProviderConfig {
  apiKey?: string
  endpoint?: string
  enabled: boolean
  type?: 'sfx-generate' | 'sfx-search' | 'both'
}

export interface SpotterConfig {
  claudePath: string
  providers: Record<string, ProviderConfig>
}

const CONFIG_DIR = path.join(os.homedir(), '.spotter')
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json')

const DEFAULTS: SpotterConfig = {
  claudePath: 'claude',
  providers: {
    elevenlabs: { enabled: false, type: 'sfx-generate' },
    freesound:  { enabled: false, type: 'sfx-search' },
  }
}

export function loadConfig(): SpotterConfig {
  if (!fs.existsSync(CONFIG_PATH)) return DEFAULTS
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    return { ...DEFAULTS, ...raw, providers: { ...DEFAULTS.providers, ...raw.providers } }
  } catch {
    return DEFAULTS
  }
}

export function saveConfig(config: SpotterConfig): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

export function getKey(name: string): string | null {
  const cfg = loadConfig()
  return cfg.providers[name]?.apiKey ?? null
}

export function setKey(name: string, apiKey: string): void {
  const cfg = loadConfig()
  cfg.providers[name] = { ...(cfg.providers[name] ?? { enabled: true }), apiKey }
  saveConfig(cfg)
}
