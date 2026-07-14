import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('spotter', {
  // Video & projects
  openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
  getVideoMetadata: (p: string) => ipcRenderer.invoke('video:getMetadata', p),
  createProject: (videoPath: string) => ipcRenderer.invoke('project:create', videoPath),
  getRecentProjects: () => ipcRenderer.invoke('project:getRecent'),
  loadProject: (projectPath: string) => ipcRenderer.invoke('project:load', projectPath),
  saveProject: (project: object) => ipcRenderer.invoke('project:save', project),
  onMenuEvent: (channel: string, callback: () => void) => {
    ipcRenderer.on(channel, callback)
    return () => ipcRenderer.removeListener(channel, callback)
  },

  // Criterio del director (per project)
  getCriterio: (projectPath: string) => ipcRenderer.invoke('criterio:get', projectPath),
  saveCriterio: (projectPath: string, text: string) =>
    ipcRenderer.invoke('criterio:save', projectPath, text),

  // Analysis — full run (frames + Claude Code subprocess → analysis.json)
  runAnalysis: (projectPath: string, videoPath: string, duration: number) =>
    ipcRenderer.invoke('analysis:run', projectPath, videoPath, duration),
  // Frame extraction only (for manual / fallback flow)
  prepareFrames: (projectPath: string, videoPath: string, duration: number) =>
    ipcRenderer.invoke('analysis:prepareFrames', projectPath, videoPath, duration),
  framesReady: (projectPath: string) =>
    ipcRenderer.invoke('analysis:framesReady', projectPath),
  loadAnalysis: (projectPath: string) => ipcRenderer.invoke('analysis:load', projectPath),
  saveAnalysis: (projectPath: string, analysis: object) =>
    ipcRenderer.invoke('analysis:save', projectPath, analysis),
  onAnalysisProgress: (
    callback: (data: { phase: string; progress: number; message: string }) => void
  ) => {
    const handler = (_: Electron.IpcRendererEvent, data: unknown) =>
      callback(data as { phase: string; progress: number; message: string })
    ipcRenderer.on('analysis:progress', handler)
    return () => ipcRenderer.removeListener('analysis:progress', handler)
  },

  // Secure key storage
  getKey: (key: string) => ipcRenderer.invoke('settings:getKey', key),
  setKey: (key: string, value: string) => ipcRenderer.invoke('settings:setKey', key, value),
  deleteKey: (key: string) => ipcRenderer.invoke('settings:deleteKey', key),

  // Audio acquisition
  generateSfx: (projectPath: string, cueId: string, prompt: string, durationSeconds: number) =>
    ipcRenderer.invoke('elevenlabs:generate', projectPath, cueId, prompt, durationSeconds),
  searchFreesound: (query: string) => ipcRenderer.invoke('freesound:search', query),
  importFreesound: (projectPath: string, cueId: string, result: object) =>
    ipcRenderer.invoke(
      'freesound:import',
      projectPath,
      cueId,
      (result as { id: number }).id,
      (result as { previews: { 'preview-hq-mp3': string } }).previews['preview-hq-mp3'],
      ''
    ),
  importAudioFile: (projectPath: string, cueId: string) =>
    ipcRenderer.invoke('audio:import', projectPath, cueId),
  getMediaUrl: (projectPath: string, filename: string) =>
    ipcRenderer.invoke('audio:getMediaUrl', projectPath, filename),

  // Translation
  translateToEnglish: (text: string) => ipcRenderer.invoke('translate:toEnglish', text),

  // Timeline persistence
  saveTimeline: (projectPath: string, state: object) =>
    ipcRenderer.invoke('timeline:save', projectPath, state),
  loadTimeline: (projectPath: string) =>
    ipcRenderer.invoke('timeline:load', projectPath),

  // Export
  exportProject: (projectPath: string, cues: object[], videoDuration: number, format?: { codec: string; sampleRate: number }) =>
    ipcRenderer.invoke('export:project', projectPath, cues, videoDuration, format)
})
