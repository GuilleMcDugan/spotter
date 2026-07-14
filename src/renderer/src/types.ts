export interface VideoMetadata {
  duration: number
  width: number
  height: number
  fps: number
  hasAudio: boolean
  aspectRatio: string
}

export interface Project {
  id: string
  name: string
  createdAt: string
  videoPath: string
  videoFileName: string
  metadata: VideoMetadata
  aspectRatioOverride: string | null
  projectPath: string
}

export interface RecentProject {
  id: string
  name: string
  createdAt: string
  projectPath: string
}

export type TrackFamily = 'AMB' | 'FOLEY' | 'DISEÑO' | 'PRÁCTICO' | 'REF'

export interface Track {
  id: string
  name: string
  family: TrackFamily
  muted: boolean
  isReference: boolean
}

export interface NarrativeAnalysis {
  synopsis: string
  mood: string
  pacing: string
  keyMoments: Array<{ tc: number; description: string }>
  soundscapeNotes: string
}

export type CueTrack = 'AMB' | 'FOLEY' | 'DISEÑO' | 'PRÁCTICO'
export type CuePriority = 'A' | 'B' | 'C'
export type CueStatus = 'pending' | 'in_progress' | 'done' | 'skipped'

export interface FreesoundAttribution {
  author: string
  license: string
  url: string
  soundId: number
}

export interface Cue {
  id: string
  tc_in: number
  tc_out: number
  track: CueTrack
  description: string
  mood: string
  priority: CuePriority
  notes: string
  status: CueStatus
  audioFile?: string
  audioSource?: 'generated' | 'freesound' | 'imported'
  audioVersions?: string[]
  freesoundAttribution?: FreesoundAttribution
}

export interface FreesoundResult {
  id: number
  name: string
  duration: number
  username: string
  license: string
  previews: { 'preview-hq-mp3': string; 'preview-lq-mp3': string }
  url: string
}

export interface AnalysisResult {
  narrative: NarrativeAnalysis
  cues: Cue[]
  analyzedAt: string
  modelUsed: string
}

export interface AnalysisProgress {
  phase: string
  progress: number
  message: string
}

declare global {
  interface Window {
    spotter: {
      openVideo: () => Promise<{ canceled: boolean; filePath?: string | null }>
      getVideoMetadata: (path: string) => Promise<VideoMetadata>
      createProject: (videoPath: string) => Promise<Project>
      getRecentProjects: () => Promise<RecentProject[]>
      loadProject: (projectPath: string) => Promise<Project>
      saveProject: (project: object) => Promise<void>
      onMenuEvent: (channel: string, callback: () => void) => () => void
      getCriterio: (projectPath: string) => Promise<string>
      saveCriterio: (projectPath: string, text: string) => Promise<void>
      runAnalysis: (
        projectPath: string,
        videoPath: string,
        duration: number
      ) => Promise<AnalysisResult>
      prepareFrames: (
        projectPath: string,
        videoPath: string,
        duration: number
      ) => Promise<{ framesDir: string; frameCount: number; projectPath: string }>
      framesReady: (projectPath: string) => Promise<{ ready: boolean; count: number }>
      loadAnalysis: (projectPath: string) => Promise<AnalysisResult | null>
      saveAnalysis: (projectPath: string, analysis: AnalysisResult) => Promise<void>
      onAnalysisProgress: (callback: (data: AnalysisProgress) => void) => () => void
      // Secure key storage
      getKey: (key: 'elevenlabs' | 'freesound') => Promise<string | null>
      setKey: (key: 'elevenlabs' | 'freesound', value: string) => Promise<void>
      deleteKey: (key: 'elevenlabs' | 'freesound') => Promise<void>
      // Audio acquisition
      generateSfx: (
        projectPath: string,
        cueId: string,
        prompt: string,
        durationSeconds: number
      ) => Promise<string>
      searchFreesound: (query: string) => Promise<{ results: FreesoundResult[]; fallback?: string }>
      importFreesound: (
        projectPath: string,
        cueId: string,
        result: FreesoundResult
      ) => Promise<string>
      importAudioFile: (projectPath: string, cueId: string) => Promise<string | null>
      getMediaUrl: (projectPath: string, filename: string) => Promise<string>
      translateToEnglish: (text: string) => Promise<string>
      saveTimeline: (projectPath: string, state: object) => Promise<void>
      loadTimeline: (projectPath: string) => Promise<object | null>
      exportProject: (
        projectPath: string,
        cues: object[],
        videoDuration: number,
        format?: { codec: string; sampleRate: number }
      ) => Promise<{ exportDir: string; copiedFiles: string[]; csvPath: string; errors: string[] }>
    }
  }
}
