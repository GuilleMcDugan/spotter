import { execFile } from 'child_process'
import ffmpegPath from 'ffmpeg-static'
import fs from 'fs'
import path from 'path'

export interface ExportCue {
  id: string
  tc_in: number
  tc_out: number
  track: string
  description: string
  mood?: string
  priority: string
  audioFile?: string
  startTime?: number
  endTime?: number
}

export interface ExportResult {
  exportDir: string
  wavFiles: string[]
  csvPath: string
  errors: string[]
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath as unknown as string, args, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve()
    })
  })
}

export async function exportStems(
  projectDir: string,
  cues: ExportCue[],
  videoDuration: number
): Promise<ExportResult> {
  const exportDir = path.join(projectDir, 'export')
  const mediaDir = path.join(projectDir, 'media')
  fs.mkdirSync(exportDir, { recursive: true })

  const exported: string[] = []
  const errors: string[] = []

  for (const cue of cues) {
    if (!cue.audioFile) continue
    const src = path.join(mediaDir, cue.audioFile)
    if (!fs.existsSync(src)) { errors.push(`${cue.id}: audio file not found (${cue.audioFile})`); continue }

    const tcIn = cue.startTime ?? cue.tc_in
    const delayMs = Math.round(tcIn * 1000)
    const safeName = cue.description.slice(0, 36).replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
    const outName = `${cue.track}_${cue.id}_${safeName}.wav`
    const outPath = path.join(exportDir, outName)

    try {
      await runFfmpeg([
        '-y', '-i', src,
        '-af', `adelay=${delayMs}|${delayMs},apad=whole_dur=${videoDuration}`,
        '-t', String(videoDuration),
        '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le',
        outPath
      ])
      exported.push(outName)
    } catch (e) {
      errors.push(`${cue.id}: ${e instanceof Error ? e.message.slice(0, 80) : 'error'}`)
    }
  }

  // CSV cue sheet
  const header = 'ID,TC_IN,TC_OUT,DURATION,TRACK,PRIORITY,DESCRIPTION,MOOD,AUDIO_FILE,WAV_EXPORT'
  const rows = cues.map(c => {
    const tcIn = (c.startTime ?? c.tc_in).toFixed(3)
    const tcOut = (c.endTime ?? c.tc_out).toFixed(3)
    const dur = (parseFloat(tcOut) - parseFloat(tcIn)).toFixed(3)
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`
    const wav = exported.find(f => f.includes(c.id)) ?? ''
    return [c.id, tcIn, tcOut, dur, c.track, c.priority, esc(c.description), esc(c.mood ?? ''), esc(c.audioFile ?? ''), esc(wav)].join(',')
  })
  const csvPath = path.join(exportDir, 'cue_sheet.csv')
  fs.writeFileSync(csvPath, [header, ...rows].join('\n'), 'utf-8')

  return { exportDir, wavFiles: exported, csvPath, errors }
}
