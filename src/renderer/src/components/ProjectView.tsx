import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Project, AnalysisResult, AnalysisProgress } from '../types'
import VideoPlayer from './VideoPlayer'
import Timeline from './Timeline'
import CueList from './CueList'
import Settings from './Settings'

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9', '2.39:1']
type BottomTab = 'cues' | 'timeline'
type AnalysisPhase = 'idle' | 'extracting' | 'pending' | 'loaded'

interface Props {
  project: Project
  onProjectUpdate: (project: Project) => void
  onClose: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ProjectView({ project, onProjectUpdate, onClose }: Props): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timelineStateRef = useRef<any>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [timelineSaved, setTimelineSaved] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [refTrackMuted, setRefTrackMuted] = useState(false)
  const [activeTab, setActiveTab] = useState<BottomTab>('cues')
  const [showSettings, setShowSettings] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [phase, setPhase] = useState<AnalysisPhase>('idle')
  const [progress, setProgress] = useState<AnalysisProgress>({ phase: '', progress: 0, message: '' })
  const [frameCount, setFrameCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const activeAR = project.aspectRatioOverride || project.metadata.aspectRatio

  // On mount: load analysis + timeline state + frames
  useEffect(() => {
    Promise.all([
      window.spotter.loadAnalysis(project.projectPath),
      window.spotter.loadTimeline(project.projectPath),
      window.spotter.framesReady(project.projectPath)
    ]).then(([a, tl, f]) => {
      if (tl) timelineStateRef.current = tl
      if (a) {
        setAnalysis(a)
        setPhase('loaded')
      } else if (f.ready) {
        setFrameCount(f.count)
        setPhase('pending')
      }
    })
  }, [project.projectPath])

  const handleAspectRatioChange = useCallback((ar: string) => {
    onProjectUpdate({ ...project, aspectRatioOverride: ar })
  }, [project, onProjectUpdate])

  const handleReferenceTrackMute = useCallback((muted: boolean) => {
    setRefTrackMuted(muted)
    if (videoRef.current) videoRef.current.muted = muted
  }, [])

  const handleSeek = useCallback((tc: number) => {
    if (videoRef.current) videoRef.current.currentTime = tc
  }, [])

  const handleRunAnalysis = useCallback(async () => {
    setPhase('extracting')
    setError(null)
    setProgress({ phase: 'frames', progress: 0, message: 'Iniciando…' })

    const unsub = window.spotter.onAnalysisProgress((data) => setProgress(data))

    try {
      const result = await window.spotter.runAnalysis(
        project.projectPath,
        project.videoPath,
        project.metadata.duration
      )
      setAnalysis(result)
      setPhase('loaded')
      setActiveTab('cues')
    } catch (err) {
      // Subprocess failed — fall back to pending panel so user can trigger manually
      const msg = err instanceof Error ? err.message : String(err)
      // Check if frames were extracted (partial success)
      const framesState = await window.spotter.framesReady(project.projectPath)
      if (framesState.ready) {
        setFrameCount(framesState.count)
        setPhase('pending')
        setError(`El análisis automático falló. Pídelo manualmente en Claude Code.\n\n${msg}`)
      } else {
        setError(msg)
        setPhase('idle')
      }
    } finally {
      unsub()
    }
  }, [project])

  const handlePrepareFrames = useCallback(async () => {
    setPhase('extracting')
    setError(null)
    setProgress({ phase: 'frames', progress: 0, message: 'Iniciando extracción…' })

    const unsub = window.spotter.onAnalysisProgress((data) => setProgress(data))

    try {
      const result = await window.spotter.prepareFrames(
        project.projectPath,
        project.videoPath,
        project.metadata.duration
      )
      setFrameCount(result.frameCount)
      setPhase('pending')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPhase('idle')
    } finally {
      unsub()
    }
  }, [project])

  const handleLoadAnalysis = useCallback(async () => {
    const a = await window.spotter.loadAnalysis(project.projectPath)
    if (a) {
      setAnalysis(a)
      setPhase('loaded')
      setActiveTab('cues')
    } else {
      setError('No se encontró analysis.json en la carpeta del proyecto. Pide el análisis a Claude Code primero.')
    }
  }, [project.projectPath])

  const handleResetToFrames = useCallback(() => {
    setAnalysis(null)
    setPhase('pending')
  }, [])

  const { metadata } = project

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{
        height: 42,
        flexShrink: 0,
        background: 'rgba(245, 243, 238, 0.02)',
        borderBottom: '1px solid var(--text-15)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 14,
        WebkitAppRegion: 'drag' as React.CSSProperties['WebkitAppRegion']
      }}>
        <button
          className="ghost"
          onClick={onClose}
          onMouseDown={(e) => e.preventDefault()}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            padding: '3px 8px',
            WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion']
          }}
        >
          ← INICIO
        </button>

        <div style={{ width: 1, height: 16, background: 'var(--text-15)' }} />

        <span style={{
          fontFamily: 'var(--font-editorial)',
          fontSize: 16,
          color: 'var(--text-100)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '0.01em'
        }}>
          {project.name}
        </span>

        {/* Right controls */}
        <div style={{
          display: 'flex',
          gap: 6,
          alignItems: 'center',
          WebkitAppRegion: 'no-drag' as React.CSSProperties['WebkitAppRegion'],
          flexShrink: 0
        }}>
          <MetaChip label={formatDuration(metadata.duration)} />
          <MetaChip label={`${metadata.fps} fps`} />
          <MetaChip label={`${metadata.width}×${metadata.height}`} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)', letterSpacing: '0.08em' }}>AR</span>
            <select
              value={activeAR}
              onChange={(e) => handleAspectRatioChange(e.target.value)}
              style={{ fontSize: 10, padding: '3px 22px 3px 7px', height: 24 }}
            >
              {ASPECT_RATIOS.map((ar) => (
                <option key={ar} value={ar}>{ar}</option>
              ))}
            </select>
          </div>

          <div style={{ width: 1, height: 16, background: 'var(--text-15)' }} />

          {/* ANALIZAR — full auto flow (frames + Claude subprocess) */}
          {phase !== 'loaded' && (
            <button
              className="primary"
              onClick={handleRunAnalysis}
              disabled={phase === 'extracting'}
              onMouseDown={(e) => e.preventDefault()}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em', padding: '4px 12px', height: 26 }}
            >
              {phase === 'extracting' ? '…' : 'ANALIZAR'}
            </button>
          )}

          {phase === 'loaded' && (
            <button
              className="ghost"
              onClick={() => { setAnalysis(null); setPhase('idle'); setError(null) }}
              onMouseDown={(e) => e.preventDefault()}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.06em', padding: '4px 10px', height: 26 }}
            >
              ↺ RE-ANALIZAR
            </button>
          )}

          {/* Settings */}
          <button
            className="icon"
            onClick={() => setShowSettings(true)}
            onMouseDown={(e) => e.preventDefault()}
            title="Ajustes"
            style={{ fontSize: 13, padding: '3px 7px' }}
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Video — 55% */}
        <div style={{ flex: '0 0 55%', overflow: 'hidden', minHeight: 0 }}>
          <VideoPlayer
            videoPath={project.videoPath}
            aspectRatio={activeAR}
            hasAudio={metadata.hasAudio}
            onTimeUpdate={setCurrentTime}
            onPlayStateChange={setIsPlaying}
            duration={metadata.duration}
            fps={metadata.fps || 25}
            videoRef={videoRef}
            referenceTrackMuted={refTrackMuted}
          />
        </div>

        {/* Bottom panel — 45% */}
        <div style={{ flex: '0 0 45%', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderTop: '1px solid var(--text-15)' }}>

          {/* Tab bar */}
          <div style={{
            height: 32,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            gap: 2,
            background: 'rgba(245,243,238,0.02)',
            borderBottom: '1px solid var(--text-08)'
          }}>
            <TabButton label="CUES" active={activeTab === 'cues'} count={analysis?.cues.length} onClick={() => setActiveTab('cues')} />
            <TabButton label="TIMELINE" active={activeTab === 'timeline'} onClick={() => setActiveTab('timeline')} />
            <div style={{ flex: 1 }} />
            {activeTab === 'timeline' && timelineSaved !== 'idle' && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                color: 'var(--text-15)', alignSelf: 'center', paddingRight: 14,
              }}>
                {timelineSaved === 'saving' ? '○ guardando…' : '● guardado'}
              </span>
            )}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>

            {activeTab === 'cues' && (
              <>
                {phase === 'extracting' && <ExtractionOverlay progress={progress} />}

                {phase === 'idle' && !error && (
                  <IdleCTA onAnalyze={handleRunAnalysis} onSettings={() => setShowSettings(true)} />
                )}

                {error && (
                  <ErrorPanel message={error} onDismiss={() => setError(null)} />
                )}

                {phase === 'pending' && !error && (
                  <PendingPanel
                    projectPath={project.projectPath}
                    frameCount={frameCount}
                    onLoad={handleLoadAnalysis}
                    onSettings={() => setShowSettings(true)}
                  />
                )}

                {phase === 'loaded' && analysis && (
                  <CueList
                    analysis={analysis}
                    projectPath={project.projectPath}
                    onSeek={handleSeek}
                    onAnalysisUpdate={setAnalysis}
                  />
                )}
              </>
            )}

            {activeTab === 'timeline' && (
              <Timeline
                project={project}
                referenceTrackMuted={refTrackMuted}
                onReferenceTrackMute={handleReferenceTrackMute}
                currentTime={currentTime}
                analysis={analysis}
                isPlaying={isPlaying}
                onSeek={handleSeek}
                initialState={timelineStateRef.current ?? undefined}
                onStateChange={(s) => {
                  timelineStateRef.current = s
                  if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
                  setTimelineSaved('saving')
                  saveTimerRef.current = setTimeout(() => {
                    window.spotter.saveTimeline(project.projectPath, s)
                      .then(() => setTimelineSaved('saved'))
                      .catch(() => setTimelineSaved('idle'))
                  }, 1500)
                }}
              />
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <Settings projectPath={project.projectPath} onClose={() => setShowSettings(false)} />
      )}
    </div>
  )
}

function MetaChip({ label }: { label: string }): JSX.Element {
  return (
    <div style={{
      background: 'var(--text-04)',
      border: '1px solid var(--text-15)',
      borderRadius: 3,
      padding: '2px 7px',
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.04em',
      color: 'var(--text-50)'
    }}>
      {label}
    </div>
  )
}

function TabButton({ label, active, count, onClick }: {
  label: string
  active: boolean
  count?: number
  onClick: () => void
}): JSX.Element {
  return (
    <button
      className={`icon ${active ? 'active' : ''}`}
      onClick={onClick}
      tabIndex={-1}
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.08em',
        padding: '3px 10px',
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 5
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{ opacity: 0.6, fontSize: 9 }}>({count})</span>
      )}
    </button>
  )
}

function ExtractionOverlay({ progress }: { progress: AnalysisProgress }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
      <div className="spinner" style={{ width: 24, height: 24 }} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-78)', letterSpacing: '0.04em' }}>
          {progress.message}
        </div>
        <div style={{ width: 200, height: 2, background: 'var(--text-08)', borderRadius: 1, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress.progress}%`, background: 'var(--senal)', transition: 'width 0.3s ease', borderRadius: 1 }} />
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)', letterSpacing: '0.04em' }}>
          {progress.progress}%
        </div>
      </div>
    </div>
  )
}

function IdleCTA({ onAnalyze, onSettings }: { onAnalyze: () => void; onSettings: () => void }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14 }}>
      <div style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 15, color: 'var(--text-50)', textAlign: 'center', lineHeight: 1.6, maxWidth: 340 }}>
        Extrae fotogramas y genera la cue list<br />
        de diseño sonoro con Claude Code.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="primary" onClick={onAnalyze} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', padding: '8px 20px' }}>
          ANALIZAR
        </button>
        <button className="ghost" onClick={onSettings} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '8px 14px' }}>
          ⚙ CRITERIO
        </button>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-15)', letterSpacing: '0.04em' }}>
        Usa tu suscripción Claude · sin API key
      </div>
    </div>
  )
}

function PendingPanel({ projectPath, frameCount, onLoad, onSettings }: {
  projectPath: string
  frameCount: number
  onLoad: () => void
  onSettings: () => void
}): JSX.Element {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(projectPath)
  }, [projectPath])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20, padding: '0 40px' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-50)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-50)', letterSpacing: '0.04em' }}>
          {frameCount} fotogramas listos · esperando análisis
        </span>
      </div>

      <div style={{
        width: '100%',
        maxWidth: 500,
        background: 'var(--text-04)',
        border: '1px solid var(--text-15)',
        borderRadius: 4,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Pide el análisis en Claude Code
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          color: 'var(--text-78)',
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}>
          {`Analiza el proyecto SPOTTER en:\n${projectPath}`}
        </div>
        <button
          className="ghost"
          onClick={handleCopy}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, alignSelf: 'flex-start', padding: '3px 10px' }}
        >
          Copiar ruta
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="primary"
          onClick={onLoad}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', padding: '8px 20px' }}
        >
          CARGAR ANÁLISIS
        </button>
        <button
          className="ghost"
          onClick={onSettings}
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '8px 14px' }}
        >
          ⚙ CRITERIO
        </button>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-15)', letterSpacing: '0.04em', textAlign: 'center' }}>
        Claude Code escribe analysis.json · SPOTTER lo carga
      </div>
    </div>
  )
}

function ErrorPanel({ message, onDismiss }: { message: string; onDismiss: () => void }): JSX.Element {
  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{
        background: 'var(--text-04)',
        border: '1px solid var(--text-15)',
        borderRadius: 3,
        padding: '10px 14px',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--text-78)',
        lineHeight: 1.6,
        letterSpacing: '0.02em'
      }}>
        {message}
      </div>
      <button onClick={onDismiss} style={{ alignSelf: 'flex-start', fontSize: 11 }}>
        Cerrar
      </button>
    </div>
  )
}
