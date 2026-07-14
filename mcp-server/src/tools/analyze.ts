import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { loadConfig } from '../config.js'

ffmpeg.setFfmpegPath(ffmpegPath as unknown as string)

export interface AnalyzeOptions {
  videoPath: string
  projectDir?: string
  criterio?: string
}

export interface AnalysisResult {
  projectDir: string
  analysisPath: string
  analysis: object
}

function extractFrame(videoPath: string, tc: number, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .seekInput(tc)
      .frames(1)
      .outputOptions(['-q:v 4', '-vf scale=960:-2'])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run()
  })
}

function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, data) => {
      if (err) reject(err)
      else resolve(data.format.duration ?? 0)
    })
  })
}

function buildPrompt(duration: number, criterio: string, frameFiles: string[]): string {
  const now = new Date().toISOString()
  const frameList = frameFiles.map(f => {
    const tcMatch = path.basename(f).match(/_(\d+)s\.jpg$/)
    const tc = tcMatch ? parseInt(tcMatch[1]) : 0
    return `  - ${f}  (tc: ${tc}s)`
  }).join('\n')

  return `You are a professional sound designer analyzing a video project for sound design spotting.

VIDEO DURATION: ${duration.toFixed(1)} seconds
${criterio ? `DIRECTOR'S INTENT: ${criterio}` : ''}

FRAMES (${frameFiles.length} total — use the Read tool to view each image):
${frameList}

TASK:
1. Use the Read tool to read and visually analyze EVERY frame listed above.
2. Generate 15–30 sound design cues covering the full ${duration.toFixed(1)}s.
3. Output ONLY a raw JSON object to stdout — no markdown fences, no prose, pure JSON.

JSON SCHEMA (ALL text content in English):
{
  "narrative": {
    "synopsis": "1–2 sentences: what happens visually and narratively",
    "mood": "dominant emotional tone and subtext",
    "pacing": "visual/narrative rhythm description",
    "keyMoments": [{"tc": 12.5, "description": "moment description for sound"}],
    "soundscapeNotes": "acoustic spaces, sound worlds, reference layers"
  },
  "cues": [
    {
      "id": "cue_001",
      "tc_in": 0.0,
      "tc_out": 15.0,
      "track": "AMB",
      "description": "Concrete sound description in English — feeds into Freesound search and ElevenLabs SFX generation",
      "mood": "Emotional tone of this cue in English",
      "priority": "A",
      "notes": "Optional production notes in English",
      "status": "pending"
    }
  ],
  "analyzedAt": "${now}",
  "modelUsed": "claude-sonnet-4-6"
}

TRACK RULES:
- AMB: ambiences, atmospheres, room tone
- FOLEY: physical presence (footsteps, cloth, contact, objects)
- DISEÑO: non-naturalistic sound design (emotional hits, transitions, abstract elements)
- PRÁCTICO: diegetic practical sources (cars, TV, phone, machinery)

PRIORITY: A=essential / B=enriches / C=optional texture
Cues from different tracks CAN overlap in time. status always "pending".
tc_in/tc_out never exceed ${duration.toFixed(1)}.

CRITICAL: your entire response must be ONLY the JSON object. Start with { end with }.`
}

export async function analyzeVideo(opts: AnalyzeOptions): Promise<AnalysisResult> {
  const { videoPath, criterio = '' } = opts

  if (!fs.existsSync(videoPath)) throw new Error(`Video not found: ${videoPath}`)

  // Determine project directory
  const projectDir = opts.projectDir ?? path.join(
    os.homedir(), 'Documents', 'Proyectos SPOTTER',
    `${Date.now()}_${path.basename(videoPath, path.extname(videoPath)).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`
  )
  const framesDir = path.join(projectDir, 'frames')
  fs.mkdirSync(framesDir, { recursive: true })

  // Extract frames
  const duration = await getVideoDuration(videoPath)
  const targetCount = Math.min(20, Math.max(4, Math.ceil(duration / 8)))
  const interval = duration / targetCount
  const frameFiles: string[] = []

  for (let i = 0; i < targetCount; i++) {
    const tc = Math.min(i * interval, duration - 0.5)
    const outPath = path.join(framesDir, `frame_${String(i).padStart(3, '0')}_${Math.round(tc)}s.jpg`)
    if (!fs.existsSync(outPath)) await extractFrame(videoPath, tc, outPath)
    frameFiles.push(outPath)
  }

  // Run claude CLI
  const cfg = loadConfig()
  const claudePath = cfg.claudePath || 'claude'
  const prompt = buildPrompt(duration, criterio, frameFiles)

  const result = await new Promise<string>((resolve, reject) => {
    const env = { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ''}` }
    const proc = spawn(claudePath, ['-p', prompt, '--output-format', 'text', '--allowedTools', 'Read'], { env })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', code => {
      if (code !== 0) reject(new Error(`Claude exited ${code}\n${stderr.slice(-300)}`))
      else resolve(stdout)
    })
    proc.on('error', err => reject(new Error(`Claude not found at "${claudePath}": ${err.message}`)))
  })

  const jsonMatch = result.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error(`Claude returned no JSON.\nOutput: ${result.slice(0, 300)}`)

  const analysis = JSON.parse(jsonMatch[0])
  const analysisPath = path.join(projectDir, 'analysis.json')
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2), 'utf-8')

  // Save criterio if provided
  if (criterio) fs.writeFileSync(path.join(projectDir, 'criterio.txt'), criterio, 'utf-8')

  // Copy video reference
  const destVideo = path.join(projectDir, path.basename(videoPath))
  if (!fs.existsSync(destVideo)) fs.copyFileSync(videoPath, destVideo)

  return { projectDir, analysisPath, analysis }
}
