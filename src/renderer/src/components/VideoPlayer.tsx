import React, { useEffect, useRef, useCallback } from 'react'

interface Props {
  videoPath: string
  aspectRatio: string
  hasAudio: boolean
  onTimeUpdate: (time: number) => void
  onPlayStateChange?: (playing: boolean) => void
  duration: number
  fps?: number
  videoRef: React.RefObject<HTMLVideoElement>
  referenceTrackMuted: boolean
}

function formatTimecode(seconds: number, fps: number): string {
  const totalFrames = Math.floor(seconds * fps)
  const frames = totalFrames % fps
  const totalSecs = Math.floor(seconds)
  const secs = totalSecs % 60
  const mins = Math.floor(totalSecs / 60) % 60
  const hours = Math.floor(totalSecs / 3600)

  const pad2 = (n: number) => n.toString().padStart(2, '0')
  return `${pad2(hours)}:${pad2(mins)}:${pad2(secs)}.${pad2(frames)}`
}

function getAspectRatioCss(ar: string): string {
  const map: Record<string, string> = {
    '16:9': '16/9',
    '9:16': '9/16',
    '4:3': '4/3',
    '1:1': '1/1',
    '21:9': '21/9',
    '2.39:1': '2.39/1'
  }
  return map[ar] || '16/9'
}

export default function VideoPlayer({
  videoPath,
  aspectRatio,
  hasAudio,
  onTimeUpdate,
  onPlayStateChange,
  duration,
  fps = 25,
  videoRef,
  referenceTrackMuted
}: Props): JSX.Element {
  const isPlayingRef = useRef(false)
  const fpsRef = useRef(fps)
  const jIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const videoUrl = (() => {
    const encoded = videoPath.split('/').map(encodeURIComponent).join('/')
    return `spotter-media://localhost${encoded}`
  })()

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
    } else {
      video.pause()
    }
  }, [videoRef])

  const goToStart = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const wasPlaying = !video.paused
    video.currentTime = 0
    if (!wasPlaying) video.pause()
  }, [videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = referenceTrackMuted
  }, [referenceTrackMuted, videoRef])

  useEffect(() => { fpsRef.current = fps }, [fps])

  const nudge = useCallback((delta: number) => {
    const video = videoRef.current
    if (!video) return
    const dur = isFinite(video.duration) && video.duration > 0 ? video.duration : Infinity
    video.currentTime = Math.max(0, Math.min(dur, video.currentTime + delta))
  }, [videoRef])

  useEffect(() => {
    const stopJ = () => {
      if (jIntervalRef.current !== null) {
        clearInterval(jIntervalRef.current)
        jIntervalRef.current = null
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return

      const video = videoRef.current
      if (!video) return
      const frameDur = 1 / (fpsRef.current || 25)

      switch (e.code) {
        case 'Space':
          if (e.repeat) return
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          nudge(e.shiftKey ? -1 : -frameDur)
          break
        case 'ArrowRight':
          e.preventDefault()
          nudge(e.shiftKey ? 1 : frameDur)
          break
        case 'Comma':
          e.preventDefault()
          nudge(-0.5)
          break
        case 'Period':
          e.preventDefault()
          nudge(0.5)
          break
        case 'Home':
          if (e.repeat) return
          e.preventDefault()
          goToStart()
          break
        case 'KeyJ':
          if (e.repeat) return
          e.preventDefault()
          stopJ()
          jIntervalRef.current = setInterval(() => {
            const v = videoRef.current
            if (!v) return
            v.currentTime = Math.max(0, v.currentTime - 0.1)
          }, 100)
          break
        case 'KeyK':
          if (e.repeat) return
          e.preventDefault()
          stopJ()
          video.pause()
          video.playbackRate = 1
          break
        case 'KeyL': {
          if (e.repeat) return
          e.preventDefault()
          const rates = [1, 1.5, 2, 0.5]
          const idx = rates.indexOf(video.playbackRate)
          video.playbackRate = rates[(idx + 1) % rates.length]
          if (video.paused) video.play()
          break
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyJ') {
        if (jIntervalRef.current !== null) {
          clearInterval(jIntervalRef.current)
          jIntervalRef.current = null
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      stopJ()
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [togglePlay, goToStart, nudge, videoRef])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      onTimeUpdate(video.currentTime)
      const tc = document.getElementById('spotter-timecode')
      if (tc) tc.textContent = formatTimecode(video.currentTime, fpsRef.current)
    }

    const handlePlay = () => {
      isPlayingRef.current = true
      const btn = document.getElementById('spotter-play-btn')
      if (btn) btn.textContent = '⏸'
      onPlayStateChange?.(true)
    }

    const handlePause = () => {
      if (video.seeking) return  // pause fired by seek, not by user — don't update play state
      isPlayingRef.current = false
      video.playbackRate = 1
      const btn = document.getElementById('spotter-play-btn')
      if (btn) btn.textContent = '▶'
      onPlayStateChange?.(false)
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
    }
  }, [onTimeUpdate, onPlayStateChange, videoRef])

  const arCss = getAspectRatioCss(aspectRatio)
  const isPortrait = aspectRatio === '9:16'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#000',
      overflow: 'hidden'
    }}>
      {/* Video area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        background: '#000'
      }}>
        <div style={{
          aspectRatio: arCss,
          maxHeight: '100%',
          maxWidth: isPortrait ? '60%' : '100%',
          position: 'relative',
          background: '#000'
        }}>
          <video
            ref={videoRef}
            src={videoUrl}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              objectFit: 'contain'
            }}
            preload="auto"
            playsInline
            tabIndex={-1}
            onKeyDown={(e) => e.preventDefault()}
          />
        </div>
      </div>

      {/* Controles de transporte */}
      <div style={{
        height: 56,
        flexShrink: 0,
        background: 'rgba(245, 243, 238, 0.02)',
        borderTop: '1px solid var(--text-15)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12
      }}>
        {/* Ir al inicio */}
        <button
          className="icon"
          onClick={goToStart}
          onMouseDown={(e) => e.preventDefault()}
          style={{ fontSize: 15, padding: '4px 8px', minWidth: 32 }}
          title="Ir al inicio"
        >
          ⏮
        </button>

        {/* Play/Pause */}
        <button
          id="spotter-play-btn"
          className="icon"
          onClick={togglePlay}
          onMouseDown={(e) => e.preventDefault()}
          style={{ fontSize: 18, padding: '4px 10px', minWidth: 40, color: 'var(--text-100)' }}
          title="Reproducir / Pausar (Espacio)"
        >
          ▶
        </button>

        {/* Timecode — grande, JetBrains Mono */}
        <div
          id="spotter-timecode"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 22,
            fontWeight: 400,
            color: 'var(--text-100)',
            letterSpacing: '0.05em',
            minWidth: 170,
            userSelect: 'text'
          }}
        >
          {formatTimecode(0, 25)}
        </div>

        {/* Shortcut hints */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 9,
          color: 'var(--text-15)', letterSpacing: '0.06em',
          display: 'flex', gap: 10, userSelect: 'none'
        }}>
          <span title="Back/forward 1 frame">← →</span>
          <span title="Back/forward 0.5s">, .</span>
          <span title="Shuttle rewind / stop / fast forward">J K L</span>
          <span title="Go to start">Home</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Chips técnicos — JetBrains Mono */}
        {!hasAudio && (
          <div style={{
            background: 'var(--text-04)',
            border: '1px solid var(--text-15)',
            borderRadius: 3,
            padding: '3px 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-50)',
            letterSpacing: '0.04em'
          }}>
            sin audio
          </div>
        )}

        <div style={{
          background: 'var(--text-04)',
          border: '1px solid var(--text-15)',
          borderRadius: 3,
          padding: '3px 8px',
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-50)',
          letterSpacing: '0.04em'
        }}>
          {aspectRatio}
        </div>
      </div>
    </div>
  )
}

export { formatTimecode }
