import ffmpegPath from 'ffmpeg-static'
import ffmpeg from 'fluent-ffmpeg'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'

const resolvedFfmpegPath = (ffmpegPath as string).replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(resolvedFfmpegPath)

export type ProgressCallback = (phase: string, progress: number, message: string) => void

export interface FrameInfo {
  filePath: string
  tc: number
}

export interface FrameExtractionResult {
  framesDir: string
  frames: FrameInfo[]
  frameCount: number
  projectPath: string
}

// ─── Frame extraction ────────────────────────────────────────────────────────

function extractSingleFrame(videoPath: string, tc: number, outputPath: string): Promise<void> {
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

export async function prepareFrames(
  videoPath: string,
  projectPath: string,
  duration: number,
  onProgress: ProgressCallback
): Promise<FrameExtractionResult> {
  const framesDir = path.join(projectPath, 'frames')
  fs.mkdirSync(framesDir, { recursive: true })

  const targetCount = Math.min(20, Math.max(4, Math.ceil(duration / 8)))
  const interval = duration / targetCount
  const times: number[] = []
  for (let i = 0; i < targetCount; i++) {
    times.push(Math.min(i * interval, duration - 0.5))
  }

  const frames: FrameInfo[] = []

  for (let i = 0; i < times.length; i++) {
    const tc = times[i]
    const outPath = path.join(
      framesDir,
      `frame_${String(i).padStart(3, '0')}_${Math.round(tc)}s.jpg`
    )
    if (!fs.existsSync(outPath)) {
      await extractSingleFrame(videoPath, tc, outPath)
    }
    frames.push({ filePath: outPath, tc })
    onProgress(
      'frames',
      Math.round(((i + 1) / times.length) * 40), // 0–40%
      `Fotograma ${i + 1} / ${times.length}`
    )
  }

  return { framesDir, frames, frameCount: frames.length, projectPath }
}

// ─── Claude Code subprocess analysis ─────────────────────────────────────────

const CLAUDE_PATH = '/Users/guille/.npm-global/bin/claude'

function buildAnalysisPrompt(
  projectPath: string,
  duration: number,
  criterio: string,
  frameFiles: string[]
): string {
  const now = new Date().toISOString()

  const frameList = frameFiles
    .map((f) => {
      const tcMatch = path.basename(f).match(/_(\d+)s\.jpg$/)
      const tc = tcMatch ? parseInt(tcMatch[1]) : 0
      return `  - ${f}  (tc: ${tc}s)`
    })
    .join('\n')

  return `You are a professional sound designer analyzing a video project for sound design spotting.

VIDEO DURATION: ${duration.toFixed(1)} seconds
${criterio ? `DIRECTOR'S INTENT: ${criterio}` : ''}

FRAMES (${frameFiles.length} total — use the Read tool to view each image):
${frameList}

TASK:
1. Use the Read tool to read and visually analyze EVERY frame listed above.
2. Generate 15–30 sound design cues covering the full ${duration.toFixed(1)}s.
3. Output ONLY a raw JSON object to stdout — no markdown fences, no prose, pure JSON.

JSON SCHEMA (ALL text content in English — descriptions, mood, notes, everything):
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
      "description": "Concrete sound description in English — this feeds directly into Freesound search and ElevenLabs SFX generation",
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
- AMB: ambiences, atmospheres, room tone (exterior/interior, weather, presence)
- FOLEY: physical presence (footsteps, cloth, contact, objects, props)
- DISEÑO: non-naturalistic sound design (emotional hits, transitions, abstract elements)
- PRÁCTICO: diegetic practical sources (cars, TV, phone, machinery, off-screen voices)

PRIORITY: A=essential narrative / B=enriches scene / C=optional texture
RULES: cues from different tracks CAN overlap in time (parallel layers). status always "pending". tc_in/tc_out never exceed ${duration.toFixed(1)}.

CRITICAL: your entire response must be ONLY the JSON object. Start with { end with }. No other text.`
}

export async function analyzeWithClaude(
  projectPath: string,
  duration: number,
  onProgress: ProgressCallback
): Promise<void> {
  const criterioPath = path.join(projectPath, 'criterio.txt')
  const criterio = fs.existsSync(criterioPath)
    ? fs.readFileSync(criterioPath, 'utf-8').trim()
    : ''

  // Collect frame files to embed in prompt
  const framesDir = path.join(projectPath, 'frames')
  const frameFiles = fs
    .readdirSync(framesDir)
    .filter((f) => f.endsWith('.jpg'))
    .sort()
    .map((f) => path.join(framesDir, f))

  const prompt = buildAnalysisPrompt(projectPath, duration, criterio, frameFiles)

  return new Promise((resolve, reject) => {
    onProgress('analysis', 42, 'Claude analizando fotogramas…')

    let pct = 42
    const timer = setInterval(() => {
      pct = Math.min(90, pct + 3)
      onProgress('analysis', pct, 'Claude analizando fotogramas…')
    }, 5000)

    const env = {
      ...process.env,
      PATH: `/Users/guille/.npm-global/bin:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ''}`
    }

    // Spawn claude directly — no shell, no quoting issues
    const proc = spawn(
      CLAUDE_PATH,
      ['-p', prompt, '--output-format', 'text', '--allowedTools', 'Read'],
      { env }
    )

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { stderr += d.toString() })

    proc.on('close', (code) => {
      clearInterval(timer)

      if (code !== 0) {
        reject(new Error(`Claude Code salió con código ${code}.\n${stderr.slice(-400)}`))
        return
      }

      // Extract JSON from stdout (claude may wrap in prose despite instructions)
      const analysisPath = path.join(projectPath, 'analysis.json')
      const jsonMatch = stdout.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0])
          fs.writeFileSync(analysisPath, JSON.stringify(parsed, null, 2), 'utf-8')
          onProgress('analysis', 100, 'Análisis completado')
          resolve()
          return
        } catch {
          // fall through to error
        }
      }

      reject(
        new Error(
          `Claude no generó JSON válido.\nSalida: ${stdout.slice(0, 300)}\nError: ${stderr.slice(-200)}`
        )
      )
    })

    proc.on('error', (err) => {
      clearInterval(timer)
      reject(new Error(`No se encontró claude en ${CLAUDE_PATH}: ${err.message}`))
    })
  })
}
