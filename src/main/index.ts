import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  Menu
} from 'electron'
import path from 'path'
import fs from 'fs'
import { Readable } from 'stream'
import { execFile } from 'child_process'
import Store from 'electron-store'
import ffmpegStatic from 'ffmpeg-static'
import { getVideoMetadata } from './ffmpegHelpers'
import { prepareFrames, analyzeWithClaude } from './analysisEngine'
import { saveKey, loadKey, deleteNamedKey } from './apiKeys'

interface RecentProject {
  id: string
  name: string
  createdAt: string
  projectPath: string
}

interface ProjectData {
  id: string
  name: string
  createdAt: string
  videoPath: string
  videoFileName: string
  metadata: object
  aspectRatioOverride: string | null
  projectPath: string
}

// Register custom protocol before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'spotter-media',
    privileges: { secure: true, standard: true, stream: true, supportFetchAPI: true }
  }
])

app.setName('SPOTTER')

const store = new Store<{ recentProjects: RecentProject[] }>({
  name: 'spotter-prefs',
  defaults: { recentProjects: [] }
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const preloadPath = path.join(__dirname, '../preload/index.js')

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.flac': 'audio/flac',
  }
  return map[ext] ?? 'application/octet-stream'
}

app.whenReady().then(() => {
  protocol.handle('spotter-media', async (request) => {
    let filePath = request.url
      .replace('spotter-media://localhost', '')
      .replace('spotter-media://', '')
    filePath = decodeURIComponent(filePath)

    let stat: fs.Stats
    try { stat = fs.statSync(filePath) } catch {
      return new Response(null, { status: 404 })
    }
    const size = stat.size
    const mime = getMimeType(filePath)
    const rangeHeader = request.headers.get('range')

    if (!rangeHeader) {
      const body = Readable.toWeb(fs.createReadStream(filePath)) as BodyInit
      return new Response(body, {
        status: 200,
        headers: { 'Accept-Ranges': 'bytes', 'Content-Length': String(size), 'Content-Type': mime }
      })
    }

    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
    if (!match) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    const start = parseInt(match[1], 10)
    const end = match[2] ? parseInt(match[2], 10) : size - 1
    if (start >= size || end >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }

    const body = Readable.toWeb(fs.createReadStream(filePath, { start, end })) as BodyInit
    return new Response(body, {
      status: 206,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
        'Content-Type': mime,
      }
    })
  })

  createWindow()
  setupMenu()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC: Open video file dialog
ipcMain.handle('dialog:openVideo', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Importar vídeo',
    filters: [{ name: 'Vídeo', extensions: ['mp4', 'mov'] }],
    properties: ['openFile']
  })
  return {
    canceled: result.canceled,
    filePath: result.filePaths[0] || null
  }
})

// IPC: Get video metadata
ipcMain.handle('video:getMetadata', async (_event, filePath: string) => {
  return await getVideoMetadata(filePath)
})

// IPC: Create project
ipcMain.handle('project:create', async (_event, videoPath: string) => {
  const metadata = await getVideoMetadata(videoPath)
  const videoFileName = path.basename(videoPath)
  const baseName = path.basename(videoPath, path.extname(videoPath))
  const timestamp = Date.now()
  const projectId = `${timestamp}`
  const folderName = `${timestamp}_${baseName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`
  const projectsBase = path.join(app.getPath('documents'), 'Proyectos SPOTTER')
  const projectPath = path.join(projectsBase, folderName)

  fs.mkdirSync(projectPath, { recursive: true })

  const destVideoPath = path.join(projectPath, videoFileName)
  fs.copyFileSync(videoPath, destVideoPath)

  const project: ProjectData = {
    id: projectId,
    name: baseName,
    createdAt: new Date().toISOString(),
    videoPath: destVideoPath,
    videoFileName,
    metadata,
    aspectRatioOverride: null,
    projectPath
  }

  fs.writeFileSync(path.join(projectPath, 'project.json'), JSON.stringify(project, null, 2))

  const recent: RecentProject = {
    id: projectId,
    name: baseName,
    createdAt: project.createdAt,
    projectPath
  }

  const existing = store.get('recentProjects', [])
  const updated = [recent, ...existing.filter((p) => p.id !== projectId)].slice(0, 10)
  store.set('recentProjects', updated)

  return project
})

// IPC: Get recent projects
ipcMain.handle('project:getRecent', () => {
  const projects = store.get('recentProjects', [])
  return projects.filter((p) => fs.existsSync(p.projectPath))
})

// IPC: Load project
ipcMain.handle('project:load', (_event, projectPath: string) => {
  const jsonPath = path.join(projectPath, 'project.json')
  const data = fs.readFileSync(jsonPath, 'utf-8')
  return JSON.parse(data)
})

// IPC: Save project
ipcMain.handle('project:save', (_event, project: ProjectData) => {
  const jsonPath = path.join(project.projectPath, 'project.json')
  fs.writeFileSync(jsonPath, JSON.stringify(project, null, 2))
})

// IPC: Criterio (per-project director's intent)
ipcMain.handle('criterio:get', (_event, projectPath: string) => {
  const f = path.join(projectPath, 'criterio.txt')
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : ''
})
ipcMain.handle('criterio:save', (_event, projectPath: string, text: string) => {
  fs.writeFileSync(path.join(projectPath, 'criterio.txt'), text, 'utf-8')
})

// IPC: Prepare frames only (ffmpeg extraction)
ipcMain.handle(
  'analysis:prepareFrames',
  async (event, projectPath: string, videoPath: string, duration: number) => {
    return await prepareFrames(videoPath, projectPath, duration, (phase, progress, message) => {
      event.sender.send('analysis:progress', { phase, progress, message })
    })
  }
)

// IPC: Full analysis — extract frames + spawn Claude Code subprocess
ipcMain.handle(
  'analysis:run',
  async (event, projectPath: string, videoPath: string, duration: number) => {
    const progress = (phase: string, pct: number, message: string) => {
      event.sender.send('analysis:progress', { phase, progress: pct, message })
    }

    // Step 1: extract frames (0–40%)
    await prepareFrames(videoPath, projectPath, duration, progress)

    // Step 2: call Claude Code subprocess (40–100%)
    await analyzeWithClaude(projectPath, duration, progress)

    // Step 3: return the written analysis
    const analysisPath = path.join(projectPath, 'analysis.json')
    if (!fs.existsSync(analysisPath)) {
      throw new Error('Claude no escribió analysis.json. Revisa la salida del proceso.')
    }
    return JSON.parse(fs.readFileSync(analysisPath, 'utf-8'))
  }
)

// IPC: Load existing analysis
ipcMain.handle('analysis:load', (_event, projectPath: string) => {
  const analysisPath = path.join(projectPath, 'analysis.json')
  if (!fs.existsSync(analysisPath)) return null
  return JSON.parse(fs.readFileSync(analysisPath, 'utf-8'))
})

// IPC: Save analysis (after user edits cues)
ipcMain.handle('analysis:save', (_event, projectPath: string, analysis: object) => {
  const analysisPath = path.join(projectPath, 'analysis.json')
  fs.writeFileSync(analysisPath, JSON.stringify(analysis, null, 2))
})

// IPC: Check frames state
ipcMain.handle('analysis:framesReady', (_event, projectPath: string) => {
  const framesDir = path.join(projectPath, 'frames')
  if (!fs.existsSync(framesDir)) return { ready: false, count: 0 }
  const files = fs.readdirSync(framesDir).filter((f) => f.endsWith('.jpg'))
  return { ready: files.length > 0, count: files.length }
})

// ─── Timeline state persistence ──────────────────────────────────────────────

ipcMain.handle('timeline:save', (_e, projectPath: string, state: object) => {
  const p = path.join(projectPath, 'timeline.json')
  fs.writeFileSync(p, JSON.stringify(state, null, 2))
})

ipcMain.handle('timeline:load', (_e, projectPath: string) => {
  const p = path.join(projectPath, 'timeline.json')
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return null }
})

// ─── API key secure storage ───────────────────────────────────────────────────

ipcMain.handle('settings:getKey', (_e, name: string) => loadKey(name))
ipcMain.handle('settings:setKey', (_e, name: string, value: string) => saveKey(name, value))
ipcMain.handle('settings:deleteKey', (_e, name: string) => deleteNamedKey(name))

// ─── Export ──────────────────────────────────────────────────────────────────

interface ExportCue {
  id: string
  tc_in: number
  tc_out: number
  track: string
  trackId: string
  description: string
  mood: string
  priority: string
  audioFile?: string
  startTime?: number
  endTime?: number
  freesoundAttribution?: {
    author: string
    license: string
    url: string
    soundId: number
  }
}

function getFfmpegBin(): string {
  const raw = ffmpegStatic as string
  // When packaged, ffmpeg-static lives in asar.unpacked
  return raw.replace('app.asar', 'app.asar.unpacked')
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(getFfmpegBin(), args, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve()
    })
  })
}

ipcMain.handle('export:project', async (
  _e,
  projectPath: string,
  cues: ExportCue[],
  videoDuration: number,
  format?: { codec: string; sampleRate: number }
) => {
  const codec = format?.codec ?? 'pcm_s24le'
  const sampleRate = format?.sampleRate ?? 48000
  const isMp3 = codec === 'libmp3lame'
  const ext = isMp3 ? 'mp3' : 'wav'

  const exportDir = path.join(projectPath, 'export')
  fs.mkdirSync(exportDir, { recursive: true })

  const mediaDir = path.join(projectPath, 'media')
  const exported: string[] = []
  const errors: string[] = []

  for (const cue of cues) {
    if (!cue.audioFile) continue
    const src = path.join(mediaDir, cue.audioFile)
    if (!fs.existsSync(src)) continue

    const tcIn = cue.startTime ?? cue.tc_in
    const tcOut = cue.endTime ?? cue.tc_out
    const clipDur = tcOut - tcIn
    const delayMs = Math.round(tcIn * 1000)
    const safeName = cue.description.slice(0, 36).replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
    const outName = `${cue.track}_${cue.id}_${safeName}.${ext}`
    const outPath = path.join(exportDir, outName)

    try {
      const totalDur = videoDuration || 60
      const fi = (cue as any).fadeIn ?? 0
      const fo = (cue as any).fadeOut ?? 0
      const fadeInF = fi > 0 ? `afade=t=in:st=0:d=${fi},` : ''
      const fadeOutF = fo > 0 ? `afade=t=out:st=${Math.max(0, clipDur - fo).toFixed(3)}:d=${fo},` : ''
      const codecArgs = isMp3
        ? ['-c:a', 'libmp3lame', '-b:a', '320k', '-ar', String(sampleRate)]
        : ['-c:a', codec, '-ar', String(sampleRate), '-ac', '2']
      await runFfmpeg([
        '-y', '-i', src,
        '-af', `${fadeInF}${fadeOutF}adelay=${delayMs}|${delayMs},apad=whole_dur=${totalDur}`,
        '-t', String(totalDur),
        ...codecArgs,
        outPath
      ])
      exported.push(outName)
    } catch (e) {
      errors.push(`${cue.id}: ${e instanceof Error ? e.message.slice(0, 80) : 'error'}`)
    }
  }

  // Cue sheet CSV
  const header = 'ID,TC_IN,TC_OUT,DURATION,TRACK,PRIORITY,DESCRIPTION,MOOD,AUDIO_FILE,AUDIO_EXPORT'
  const rows = cues.map(c => {
    const tcIn = (c.startTime ?? c.tc_in).toFixed(3)
    const tcOut = (c.endTime ?? c.tc_out).toFixed(3)
    const dur = (parseFloat(tcOut) - parseFloat(tcIn)).toFixed(3)
    const esc = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`
    const wavName = exported.find(f => f.includes(c.id)) ?? ''
    return [c.id, tcIn, tcOut, dur, c.track, c.priority, esc(c.description), esc(c.mood ?? ''), esc(c.audioFile ?? ''), esc(wavName)].join(',')
  })
  const csvPath = path.join(exportDir, 'cue_sheet.csv')
  fs.writeFileSync(csvPath, [header, ...rows].join('\n'), 'utf-8')

  const attributed = cues.filter(c => c.freesoundAttribution)
  if (attributed.length > 0) {
    const lines = ['ATRIBUCIONES — SPOTTER export', '================================', '']
    for (const c of attributed) {
      const a = c.freesoundAttribution!
      lines.push(c.description)
      lines.push(`Autor: ${a.author}`)
      lines.push(`Licencia: ${a.license}`)
      lines.push(`URL: ${a.url}`)
      lines.push('')
    }
    fs.writeFileSync(path.join(exportDir, 'atribuciones.txt'), lines.join('\n'), 'utf-8')
  }

  return { exportDir, copiedFiles: exported, csvPath, errors }
})

// ─── Translation ─────────────────────────────────────────────────────────────

ipcMain.handle('translate:toEnglish', async (_e, text: string) => {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=es|en`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Translation error ${res.status}`)
  const data = (await res.json()) as { responseData?: { translatedText?: string }; responseStatus?: number }
  const translated = data.responseData?.translatedText
  if (!translated) throw new Error('No translation returned')
  // MyMemory returns "PLEASE SELECT TWO DISTINCT LANGUAGES" on bad input
  if (translated.toUpperCase().startsWith('PLEASE SELECT')) throw new Error('Translation failed')
  return translated
})

// ─── ElevenLabs SFX generation ───────────────────────────────────────────────

ipcMain.handle(
  'elevenlabs:generate',
  async (_e, projectPath: string, cueId: string, prompt: string, durationSeconds: number) => {
    const key = loadKey('elevenlabs')
    if (!key) throw new Error('No hay clave de ElevenLabs. Añádela en Ajustes.')

    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: prompt, duration_seconds: durationSeconds, prompt_influence: 0.6 })
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`ElevenLabs error ${res.status}: ${body.slice(0, 200)}`)
    }

    const mediaDir = path.join(projectPath, 'media')
    fs.mkdirSync(mediaDir, { recursive: true })

    // Version: count existing files for this cue
    const existing = fs.readdirSync(mediaDir).filter((f) => f.startsWith(`${cueId}_el_v`))
    const version = existing.length + 1
    const filename = `${cueId}_el_v${version}.mp3`
    const filePath = path.join(mediaDir, filename)

    const buffer = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(filePath, buffer)
    return filename
  }
)

// ─── Freesound search ────────────────────────────────────────────────────────

ipcMain.handle('freesound:search', async (_e, query: string) => {
  const key = loadKey('freesound')
  if (!key) throw new Error('No hay clave de Freesound. Añádela en Ajustes.')

  async function doSearch(q: string): Promise<{ results: unknown[]; debug?: string }> {
    const params = new URLSearchParams({
      query: q,
      token: key,
      fields: 'id,name,duration,previews,license,username,url',
      page_size: '12',
      filter: 'duration:[1 TO 60]',
      sort: 'score'
    })
    const url = `https://freesound.org/apiv2/search/text/?${params.toString()}`
    console.log('[freesound:search] GET', url.replace(key, '***'))
    const res = await fetch(url)
    const body = await res.text()
    console.log('[freesound:search] status:', res.status, '| body[:200]:', body.slice(0, 200))
    if (!res.ok) {
      throw new Error(`Freesound ${res.status}: ${body.slice(0, 300)}`)
    }
    const data = JSON.parse(body) as { count?: number; results?: unknown[] }
    return { results: data.results ?? [], debug: `HTTP ${res.status}, count=${data.count ?? '?'}` }
  }

  let data = await doSearch(query)

  if (!data.results?.length) {
    const short = query.split(' ').slice(0, 3).join(' ')
    if (short !== query && short.trim()) {
      const short_data = await doSearch(short)
      if (short_data.results?.length) {
        return { results: short_data.results, fallback: short }
      }
    }
    return { results: [], debug: data.debug }
  }

  return { results: data.results }
})

// ─── Freesound import (download preview) ─────────────────────────────────────

ipcMain.handle(
  'freesound:import',
  async (
    _e,
    projectPath: string,
    cueId: string,
    soundId: number,
    previewUrl: string,
    filename: string
  ) => {
    const mediaDir = path.join(projectPath, 'media')
    fs.mkdirSync(mediaDir, { recursive: true })

    const res = await fetch(previewUrl)
    if (!res.ok) throw new Error(`No se pudo descargar el preview: ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const outName = `${cueId}_fs_${soundId}.mp3`
    fs.writeFileSync(path.join(mediaDir, outName), buffer)
    return outName
  }
)

// ─── File import (user's own file) ───────────────────────────────────────────

ipcMain.handle('audio:import', async (_e, projectPath: string, cueId: string) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Importar audio',
    filters: [{ name: 'Audio', extensions: ['wav', 'aiff', 'aif', 'mp3', 'm4a', 'ogg', 'flac'] }],
    properties: ['openFile']
  })
  if (result.canceled || !result.filePaths[0]) return null

  const src = result.filePaths[0]
  const ext = path.extname(src)
  const outName = `${cueId}_imported${ext}`
  const mediaDir = path.join(projectPath, 'media')
  fs.mkdirSync(mediaDir, { recursive: true })
  fs.copyFileSync(src, path.join(mediaDir, outName))
  return outName
})

// ─── Media URL helper ─────────────────────────────────────────────────────────

ipcMain.handle('audio:getMediaUrl', (_e, projectPath: string, filename: string) => {
  const filePath = path.join(projectPath, 'media', filename)
  const encoded = filePath.split('/').map(encodeURIComponent).join('/')
  return `spotter-media://localhost${encoded}`
})

function setupMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'SPOTTER',
      submenu: [
        { role: 'about', label: 'Acerca de SPOTTER' },
        { type: 'separator' },
        { role: 'services', label: 'Servicios' },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar SPOTTER' },
        { role: 'hideOthers', label: 'Ocultar otros' },
        { role: 'unhide', label: 'Mostrar todo' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir de SPOTTER' }
      ]
    },
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Nuevo proyecto',
          accelerator: 'CmdOrCtrl+N',
          click: () => { mainWindow?.webContents.send('menu:newProject') }
        },
        {
          label: 'Importar vídeo',
          accelerator: 'CmdOrCtrl+O',
          click: async () => { mainWindow?.webContents.send('menu:importVideo') }
        },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
