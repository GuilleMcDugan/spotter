import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Project, AnalysisResult } from '../types'

interface Clip {
  id: string
  cueId: string
  trackId: string
  startTime: number
  endTime: number
  label: string
  audioFile?: string
  priority: 'A' | 'B' | 'C'
  gain?: number
  fadeIn?: number
  fadeOut?: number
}

interface TrackDef {
  id: string
  label: string
  displayName: string
  isReference: boolean
}

interface DragState {
  clipId: string
  mode: 'move' | 'trim-left' | 'trim-right' | 'fade-in' | 'fade-out'
  startX: number
  origStart: number
  origEnd: number
  origTrackId: string
  origFadeIn: number
  origFadeOut: number
  clipsSnapshot: Clip[]
}

interface TimelineState {
  clips: Clip[]
  history: Clip[][]
  extraTracks: TrackDef[]
}

interface Props {
  project: Project
  referenceTrackMuted: boolean
  onReferenceTrackMute: (muted: boolean) => void
  currentTime: number
  analysis?: AnalysisResult | null
  isPlaying?: boolean
  onSeek?: (tc: number) => void
  initialState?: TimelineState
  onStateChange?: (s: TimelineState) => void
}

const TRACK_HEIGHT = 52
const LABEL_WIDTH = 168
const RULER_HEIGHT = 32
const MIN_CLIP_DURATION = 0.5

const BASE_TRACKS: TrackDef[] = [
  { id: 'amb1',      label: 'AMB',   displayName: 'AMB 1',     isReference: false },
  { id: 'amb2',      label: 'AMB',   displayName: 'AMB 2',     isReference: false },
  { id: 'amb3',      label: 'AMB',   displayName: 'AMB 3',     isReference: false },
  { id: 'amb4',      label: 'AMB',   displayName: 'AMB 4',     isReference: false },
  { id: 'amb5',      label: 'AMB',   displayName: 'AMB 5',     isReference: false },
  { id: 'amb6',      label: 'AMB',   displayName: 'AMB 6',     isReference: false },
  { id: 'foley1',    label: 'FOLEY', displayName: 'FOLEY 1',   isReference: false },
  { id: 'foley2',    label: 'FOLEY', displayName: 'FOLEY 2',   isReference: false },
  { id: 'foley3',    label: 'FOLEY', displayName: 'FOLEY 3',   isReference: false },
  { id: 'foley4',    label: 'FOLEY', displayName: 'FOLEY 4',   isReference: false },
  { id: 'foley5',    label: 'FOLEY', displayName: 'FOLEY 5',   isReference: false },
  { id: 'foley6',    label: 'FOLEY', displayName: 'FOLEY 6',   isReference: false },
  { id: 'diseno1',   label: 'DSÑ',   displayName: 'Diseño 1',  isReference: false },
  { id: 'diseno2',   label: 'DSÑ',   displayName: 'Diseño 2',  isReference: false },
  { id: 'diseno3',   label: 'DSÑ',   displayName: 'Diseño 3',  isReference: false },
  { id: 'diseno4',   label: 'DSÑ',   displayName: 'Diseño 4',  isReference: false },
  { id: 'practico1', label: 'PRC',   displayName: 'Práctico 1',isReference: false },
  { id: 'practico2', label: 'PRC',   displayName: 'Práctico 2',isReference: false },
  { id: 'practico3', label: 'PRC',   displayName: 'Práctico 3',isReference: false },
  { id: 'practico4', label: 'PRC',   displayName: 'Práctico 4',isReference: false },
]

const FAMILY_TRACKS: Record<string, string[]> = {
  AMB:      ['amb1', 'amb2', 'amb3', 'amb4', 'amb5', 'amb6'],
  FOLEY:    ['foley1', 'foley2', 'foley3', 'foley4', 'foley5', 'foley6'],
  DISEÑO:   ['diseno1', 'diseno2', 'diseno3', 'diseno4'],
  PRÁCTICO: ['practico1', 'practico2', 'practico3', 'practico4'],
}

const FAMILY_LABELS: { label: string; family: string; displayPrefix: string }[] = [
  { label: 'AMB',   family: 'AMB',      displayPrefix: 'AMB' },
  { label: 'FOLEY', family: 'FOLEY',    displayPrefix: 'FOLEY' },
  { label: 'DSÑ',   family: 'DISEÑO',   displayPrefix: 'Diseño' },
  { label: 'PRC',   family: 'PRÁCTICO', displayPrefix: 'Práctico' },
]

function cuesToClips(cues: AnalysisResult['cues']): Clip[] {
  const trackEnds: Record<string, number> = {}
  for (const ids of Object.values(FAMILY_TRACKS)) for (const id of ids) trackEnds[id] = 0

  // Sort by start time so greedy assignment is correct
  const sorted = [...cues].sort((a, b) => a.tc_in - b.tc_in)

  return sorted.map(cue => {
    const candidates = FAMILY_TRACKS[cue.track] ?? FAMILY_TRACKS['AMB']

    // Pick the first track whose end time doesn't overlap this cue
    let trackId = candidates[0]
    for (const id of candidates) {
      if (trackEnds[id] <= cue.tc_in) { trackId = id; break }
    }
    // If all overlap, fall back to track with smallest end time
    if (trackEnds[trackId] > cue.tc_in) {
      trackId = candidates.reduce((best, id) => trackEnds[id] < trackEnds[best] ? id : best, candidates[0])
    }
    trackEnds[trackId] = cue.tc_out

    return {
      id: cue.id,
      cueId: cue.id,
      trackId,
      startTime: cue.tc_in,
      endTime: cue.tc_out,
      label: cue.description,
      audioFile: cue.audioFile,
      priority: cue.priority,
    }
  })
}

function formatRulerTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function buildRulerMarks(duration: number, width: number) {
  if (!duration || !width) return [] as { time: number; x: number; label: string }[]
  const pps = width / duration
  const intervals = [1, 2, 5, 10, 15, 30, 60]
  let interval = intervals[intervals.length - 1]
  for (const iv of intervals) {
    if (iv * pps >= 60) { interval = iv; break }
  }
  const marks: { time: number; x: number; label: string }[] = []
  for (let t = 0; t <= duration; t += interval) {
    marks.push({ time: t, x: t * pps, label: formatRulerTime(t) })
  }
  return marks
}

export default function Timeline({
  project,
  referenceTrackMuted,
  onReferenceTrackMute,
  currentTime,
  analysis,
  isPlaying = false,
  onSeek,
  initialState,
  onStateChange,
}: Props): JSX.Element {
  const { metadata } = project

  // --- State & refs first (useMemo/useCallback below depend on these) ---
  const [mutedTracks, setMutedTracks] = useState<Record<string, boolean>>({})
  const [extraTracks, setExtraTracks] = useState<TrackDef[]>(() => initialState?.extraTracks ?? [])
  const clipAreaRef = useRef<HTMLDivElement>(null)
  const [clipAreaWidth, setClipAreaWidth] = useState(0)
  const [clips, setClips] = useState<Clip[]>(() => initialState?.clips ?? (analysis ? cuesToClips(analysis.cues) : []))
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<string | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportCodec, setExportCodec] = useState<'pcm_s16le' | 'pcm_s24le' | 'libmp3lame'>('pcm_s24le')
  const [exportSampleRate, setExportSampleRate] = useState<44100 | 48000>(48000)
  const [history, setHistory] = useState<Clip[][]>(() => initialState?.history ?? [])
  const dragRef = useRef<DragState | null>(null)
  const dragContainerRef = useRef<HTMLDivElement>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
  const clipsRef = useRef(clips)
  const currentTimeRef = useRef(currentTime)
  const isPlayingRef = useRef(isPlaying)
  const mutedTracksRef = useRef(mutedTracks)
  const referenceTrackMutedRef = useRef(referenceTrackMuted)
  const pixPerSecRef = useRef(0)
  const durationRef = useRef(metadata.duration || 60)
  const prevTimeRef = useRef(currentTime)

  // --- Derived / memoized values ---
  const allTracks = useMemo(() => {
    const tracks: TrackDef[] = []
    if (metadata.hasAudio) tracks.push({ id: 'ref', label: 'REF', displayName: 'Referencia', isReference: true })
    return [...tracks, ...BASE_TRACKS, ...extraTracks]
  }, [metadata.hasAudio, extraTracks])

  const addTrack = useCallback((familyLabel: string) => {
    const info = FAMILY_LABELS.find(f => f.label === familyLabel)
    if (!info) return
    const existingCount = allTracks.filter(t => t.label === familyLabel).length
    const id = `${familyLabel.toLowerCase().replace('dsñ', 'diseno')}-x${Date.now()}`
    setExtraTracks(prev => [...prev, {
      id,
      label: familyLabel,
      displayName: `${info.displayPrefix} ${existingCount + 1}`,
      isReference: false,
    }])
  }, [allTracks])

  const trackLayout = useMemo(() => {
    const list: { id: string; yTop: number }[] = []
    let y = 0
    allTracks.filter(t => t.isReference).forEach(t => { list.push({ id: t.id, yTop: y }); y += TRACK_HEIGHT })
    for (const { label } of FAMILY_LABELS) {
      allTracks.filter(t => !t.isReference && t.label === label).forEach(t => { list.push({ id: t.id, yTop: y }); y += TRACK_HEIGHT })
      y += 22
    }
    return list
  }, [allTracks])

  const getTrackIdAtY = useCallback((clientY: number): string | null => {
    const el = dragContainerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const yInContainer = clientY - rect.top + el.scrollTop
    const hit = trackLayout.find(({ yTop }) => yInContainer >= yTop && yInContainer < yTop + TRACK_HEIGHT)
    return hit?.id ?? null
  }, [trackLayout])

  useEffect(() => { clipsRef.current = clips }, [clips])
  useEffect(() => { currentTimeRef.current = currentTime }, [currentTime])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { mutedTracksRef.current = mutedTracks }, [mutedTracks])
  useEffect(() => { referenceTrackMutedRef.current = referenceTrackMuted }, [referenceTrackMuted])
  useEffect(() => { durationRef.current = metadata.duration || 60 }, [metadata.duration])

  const onStateChangeRef = useRef(onStateChange)
  useEffect(() => { onStateChangeRef.current = onStateChange }, [onStateChange])
  useEffect(() => {
    onStateChangeRef.current?.({ clips, history, extraTracks })
  }, [clips, history, extraTracks])

  // Update clips from analysis: preserve positions on cue update, reset on new analysis
  useEffect(() => {
    if (!analysis) return
    const validTrackIds = new Set(BASE_TRACKS.map(t => t.id))
    setClips(prev => {
      const prevIds = new Set(prev.map(c => c.id))
      const newIds = new Set(analysis.cues.map(c => c.id))
      const sameSet = prevIds.size === newIds.size && [...prevIds].every(id => newIds.has(id))
      if (sameSet && prev.length > 0) {
        // Re-derive fresh assignments to fix stale trackIds (e.g. after track layout changes)
        const fresh = cuesToClips(analysis.cues)
        return prev.map(c => {
          const cue = analysis.cues.find(q => q.id === c.id)
          if (!cue) return c
          const freshClip = fresh.find(f => f.id === c.id)
          return {
            ...c,
            audioFile: cue.audioFile,
            priority: cue.priority,
            // If clip's trackId no longer exists, use fresh derived assignment
            trackId: validTrackIds.has(c.trackId) ? c.trackId : (freshClip?.trackId ?? c.trackId),
          }
        })
      }
      // New/different cues — full re-derive
      setHistory([])
      return cuesToClips(analysis.cues)
    })
  }, [analysis])

  // Resize observer
  useEffect(() => {
    if (!clipAreaRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 0
      setClipAreaWidth(w)
      pixPerSecRef.current = w / (durationRef.current || 60)
    })
    ro.observe(clipAreaRef.current)
    return () => ro.disconnect()
  }, [])

  // Stable sync function using refs — never recreated
  const syncAudios = useCallback(() => {
    const ct = currentTimeRef.current
    const playing = isPlayingRef.current
    for (const [clipId, audio] of audioRefs.current.entries()) {
      const clip = clipsRef.current.find(c => c.id === clipId)
      if (!clip) { audio.pause(); continue }
      const isRef = clip.trackId === 'ref'
      const muted = isRef
        ? referenceTrackMutedRef.current
        : (mutedTracksRef.current[clip.trackId] ?? false)
      const inRange = ct >= clip.startTime && ct < clip.endTime
      if (playing && inRange && !muted) {
        const target = Math.max(0, ct - clip.startTime)
        const dur = audio.duration
        // If audio is loaded and target is past its duration, let it play from start (loop-once behavior)
        const safeTarget = isFinite(dur) && dur > 0 && target >= dur ? 0 : target
        if (Math.abs(audio.currentTime - safeTarget) > 0.15) audio.currentTime = safeTarget
        const gain = clip.gain ?? 1
        const elapsed = ct - clip.startTime
        const clipDur = clip.endTime - clip.startTime
        const fi = clip.fadeIn ?? 0
        const fo = clip.fadeOut ?? 0
        let vol = gain
        if (fi > 0 && elapsed < fi) vol = gain * (elapsed / fi)
        else if (fo > 0 && elapsed > clipDur - fo) vol = gain * Math.max(0, (clipDur - elapsed) / fo)
        audio.volume = Math.max(0, Math.min(1, vol))
        if (audio.paused) audio.play().catch(err => console.warn('[syncAudios] play failed:', clipId, err))
      } else {
        if (!audio.paused) audio.pause()
      }
    }
  }, [])

  // After drag ends: clipsRef already updated (clipsRef effect runs first), then re-sync audio
  useEffect(() => { if (!draggingId) syncAudios() }, [draggingId, syncAudios])

  // Manage audio element map when clips change
  useEffect(() => {
    const map = audioRefs.current
    // Remove stale elements
    for (const [id, audio] of [...map.entries()]) {
      if (!clips.find(c => c.id === id && c.audioFile)) {
        audio.pause()
        map.delete(id)
      }
    }
    // Add new elements
    for (const clip of clips) {
      if (clip.audioFile && !map.has(clip.id)) {
        window.spotter.getMediaUrl(project.projectPath, clip.audioFile).then(url => {
          if (map.has(clip.id)) return  // added by a concurrent promise — noop
          const a = new Audio(url)
          a.preload = 'auto'
          a.onerror = (e) => console.error('[spotter] audio load error:', clip.id, e)
          map.set(clip.id, a)
          if (isPlayingRef.current) syncAudios()
        })
      }
    }
  }, [clips, project.projectPath, syncAudios])

  // Unmount: pause all
  useEffect(() => {
    return () => { for (const a of audioRefs.current.values()) a.pause() }
  }, [])

  // Sync on play/pause change
  useEffect(() => { syncAudios() }, [isPlaying, syncAudios])

  // Sync on any meaningful time change — catches nudges, seeks, and normal playback drift
  useEffect(() => {
    const delta = Math.abs(currentTime - prevTimeRef.current)
    prevTimeRef.current = currentTime
    if (delta > 0.04) syncAudios()
  }, [currentTime, syncAudios])

  // Undo (Cmd+Z)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        setHistory(h => {
          if (!h.length) return h
          setClips(h[h.length - 1])
          return h.slice(0, -1)
        })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Split clip at playhead (S)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'KeyS') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const ct = currentTimeRef.current
      const current = clipsRef.current
      const toSplit = current.filter(c => c.startTime < ct && ct < c.endTime)
      if (!toSplit.length) return
      e.preventDefault()
      setHistory(h => [...h.slice(-49), current])
      setClips(prev => {
        const result: Clip[] = []
        for (const c of prev) {
          const split = toSplit.find(s => s.id === c.id)
          if (!split) { result.push(c); continue }
          result.push({ ...c, id: c.id + '_L', endTime: ct })
          result.push({ ...c, id: c.id + '_R', startTime: ct })
        }
        return result
      })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const toggleMute = useCallback((trackId: string, isRef: boolean) => {
    if (isRef) { onReferenceTrackMute(!referenceTrackMuted); return }
    setMutedTracks(prev => ({ ...prev, [trackId]: !prev[trackId] }))
  }, [onReferenceTrackMute, referenceTrackMuted])

  // Drag: document-level listeners for reliability
  const startDrag = useCallback((
    e: React.MouseEvent,
    clipId: string,
    mode: 'move' | 'trim-left' | 'trim-right' | 'fade-in' | 'fade-out'
  ) => {
    e.stopPropagation()
    e.preventDefault()
    const clip = clipsRef.current.find(c => c.id === clipId)
    if (!clip) return

    dragRef.current = {
      clipId, mode,
      startX: e.clientX,
      origStart: clip.startTime,
      origEnd: clip.endTime,
      origTrackId: clip.trackId,
      origFadeIn: clip.fadeIn ?? 0,
      origFadeOut: clip.fadeOut ?? 0,
      clipsSnapshot: clipsRef.current,
    }
    setDraggingId(clipId)

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const pps = pixPerSecRef.current
      if (pps === 0) return
      const dur = durationRef.current
      const dt = (ev.clientX - d.startX) / pps
      const len = d.origEnd - d.origStart

      setClips(prev => prev.map(c => {
        if (c.id !== d.clipId) return c
        if (d.mode === 'move') {
          const ns = Math.max(0, Math.min(d.origStart + dt, dur - len))
          const targetTrack = getTrackIdAtY(ev.clientY)
          return { ...c, startTime: ns, endTime: ns + len, trackId: targetTrack ?? c.trackId }
        }
        if (d.mode === 'trim-left') {
          return { ...c, startTime: Math.max(0, Math.min(d.origStart + dt, d.origEnd - MIN_CLIP_DURATION)) }
        }
        if (d.mode === 'trim-right') {
          return { ...c, endTime: Math.min(dur, Math.max(d.origEnd + dt, d.origStart + MIN_CLIP_DURATION)) }
        }
        const clipDur = d.origEnd - d.origStart
        if (d.mode === 'fade-in') {
          const fi = Math.max(0, Math.min(d.origFadeIn + dt, clipDur - (c.fadeOut ?? 0) - 0.05))
          return { ...c, fadeIn: Math.round(fi * 100) / 100 }
        }
        if (d.mode === 'fade-out') {
          const fo = Math.max(0, Math.min(d.origFadeOut - dt, clipDur - (c.fadeIn ?? 0) - 0.05))
          return { ...c, fadeOut: Math.round(fo * 100) / 100 }
        }
        return c
      }))
    }

    const onUp = () => {
      if (dragRef.current) {
        const snap = dragRef.current.clipsSnapshot
        setHistory(h => [...h.slice(-49), snap])
        dragRef.current = null
      }
      setDraggingId(null)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      // syncAudios is called via useEffect([draggingId]) once state settles
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [getTrackIdAtY])

  // Ruler click → seek
  const handleRulerClick = useCallback((e: React.MouseEvent) => {
    if (!clipAreaRef.current || !onSeek || pixPerSecRef.current === 0) return
    const rect = clipAreaRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    onSeek(Math.max(0, Math.min(x / pixPerSecRef.current, durationRef.current)))
  }, [onSeek])

  const handleExport = useCallback(async (codec: 'pcm_s16le' | 'pcm_s24le' | 'libmp3lame', sampleRate: 44100 | 48000) => {
    if (!analysis) return
    setShowExportModal(false)
    setExporting(true)
    setExportMsg(null)
    try {
      const cuesWithPositions = analysis.cues.map(cue => {
        const clip = clips.find(c => c.cueId === cue.id)
        return {
          ...cue,
          audioFile: clip?.audioFile,
          startTime: clip?.startTime ?? cue.tc_in,
          endTime: clip?.endTime ?? cue.tc_out,
          trackId: clip?.trackId ?? '',
          freesoundAttribution: cue.freesoundAttribution,
          fadeIn: clip?.fadeIn ?? 0,
          fadeOut: clip?.fadeOut ?? 0,
        }
      })
      const result = await window.spotter.exportProject(
        project.projectPath,
        cuesWithPositions,
        metadata.duration || 60,
        { codec, sampleRate }
      )
      const { exportDir, copiedFiles, errors } = result
      const ext = codec === 'libmp3lame' ? 'MP3' : 'WAV'
      const errTxt = errors?.length ? ` (${errors.length} errores)` : ''
      setExportMsg(`✓ ${copiedFiles.length} ${ext}s + cue_sheet.csv → ${exportDir}${errTxt}`)
    } catch (e) {
      setExportMsg(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
    } finally {
      setExporting(false)
    }
  }, [analysis, clips, project.projectPath])

  const duration = metadata.duration || 60
  const pixPerSec = clipAreaWidth > 0 ? clipAreaWidth / duration : 0
  const playheadX = currentTime * pixPerSec
  const rulerMarks = buildRulerMarks(duration, clipAreaWidth)

  // Flat ordered list: REF tracks, then each family group followed by an add-track row
  type TrackItem = { kind: 'track'; track: TrackDef } | { kind: 'add'; familyLabel: string }
  const trackItems: TrackItem[] = []
  allTracks.filter(t => t.isReference).forEach(t => trackItems.push({ kind: 'track', track: t }))
  for (const { label } of FAMILY_LABELS) {
    allTracks.filter(t => !t.isReference && t.label === label).forEach(t => trackItems.push({ kind: 'track', track: t }))
    trackItems.push({ kind: 'add', familyLabel: label })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg)',
      overflow: 'hidden',
      userSelect: draggingId ? 'none' : undefined,
    }}>

      {/* Ruler */}
      <div style={{ display: 'flex', height: RULER_HEIGHT, flexShrink: 0, borderBottom: '1px solid var(--text-15)' }}>
        <div style={{
          width: LABEL_WIDTH, flexShrink: 0,
          borderRight: '1px solid var(--text-15)',
          display: 'flex', alignItems: 'center', paddingLeft: 14
        }}>
          <span className="section-label">02 — Pistas</span>
        </div>
        <div
          ref={clipAreaRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: onSeek ? 'crosshair' : 'default' }}
          onClick={handleRulerClick}
        >
          {rulerMarks.filter(m => m.time > 0).map(mark => (
            <div key={mark.time} style={{ position: 'absolute', left: mark.x, top: 0, height: '100%' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, width: 1,
                height: mark.time % 10 === 0 ? '55%' : '35%',
                background: 'var(--text-15)'
              }} />
              <span style={{
                position: 'absolute', bottom: 6, left: 3,
                fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)',
                userSelect: 'none', whiteSpace: 'nowrap'
              }}>
                {mark.label}
              </span>
            </div>
          ))}
          {clipAreaWidth > 0 && (
            <div style={{
              position: 'absolute', left: playheadX, top: 0,
              width: 1, height: '100%',
              background: 'var(--senal)', zIndex: 10, pointerEvents: 'none'
            }} />
          )}
        </div>
      </div>

      {/* Export bar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '6px 14px', borderBottom: '1px solid var(--text-08)',
        }}>
          <button
            className="ghost"
            onClick={() => setShowExportModal(v => !v)}
            disabled={exporting || !analysis}
            onMouseDown={(e) => e.preventDefault()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 12px' }}
          >
            {exporting ? 'EXPORTANDO…' : '↓ EXPORTAR'}
          </button>
          {exportMsg && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)', flex: 1 }}>
              {exportMsg}
            </span>
          )}
        </div>

        {/* Export format modal */}
        {showExportModal && (
          <div style={{
            position: 'absolute', top: '100%', left: 14, zIndex: 100,
            background: 'var(--bg)', border: '1px solid var(--text-15)',
            borderRadius: 4, padding: '14px 16px', minWidth: 280,
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)', letterSpacing: '0.10em', marginBottom: 10 }}>
              FORMATO DE EXPORTACIÓN
            </div>

            {/* Codec */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-15)', letterSpacing: '0.06em', marginBottom: 6 }}>FORMATO</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([
                  { codec: 'pcm_s16le', label: 'WAV 16-bit' },
                  { codec: 'pcm_s24le', label: 'WAV 24-bit' },
                  { codec: 'libmp3lame', label: 'MP3 320k' },
                ] as const).map(({ codec, label }) => (
                  <button
                    key={codec}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setExportCodec(codec)}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '4px 8px',
                      background: exportCodec === codec ? 'var(--text-15)' : 'transparent',
                      border: `1px solid ${exportCodec === codec ? 'var(--text-50)' : 'var(--text-08)'}`,
                      color: exportCodec === codec ? 'var(--text-100)' : 'var(--text-50)',
                      borderRadius: 2, cursor: 'pointer',
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>

            {/* Sample rate */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-15)', letterSpacing: '0.06em', marginBottom: 6 }}>SAMPLE RATE</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {([44100, 48000] as const).map(sr => (
                  <button
                    key={sr}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setExportSampleRate(sr)}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, padding: '4px 8px',
                      background: exportSampleRate === sr ? 'var(--text-15)' : 'transparent',
                      border: `1px solid ${exportSampleRate === sr ? 'var(--text-50)' : 'var(--text-08)'}`,
                      color: exportSampleRate === sr ? 'var(--text-100)' : 'var(--text-50)',
                      borderRadius: 2, cursor: 'pointer',
                    }}
                  >{sr === 44100 ? '44.1 kHz' : '48 kHz'}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="ghost"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleExport(exportCodec, exportSampleRate)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '4px 16px', flex: 1 }}
              >
                EXPORTAR
              </button>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowExportModal(false)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, padding: '4px 10px',
                  background: 'transparent', border: '1px solid var(--text-08)',
                  color: 'var(--text-50)', borderRadius: 2, cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Track rows */}
      <div ref={dragContainerRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {trackItems.map(item => {
          if (item.kind === 'add') {
            return (
              <div key={`add-${item.familyLabel}`} style={{
                display: 'flex', height: 22, flexShrink: 0,
                borderBottom: '1px solid var(--text-08)',
                background: 'rgba(245,243,238,0.01)',
              }}>
                <div style={{ width: LABEL_WIDTH, flexShrink: 0, borderRight: '1px solid var(--text-15)', display: 'flex', alignItems: 'center', paddingLeft: 10 }}>
                  <button
                    className="ghost"
                    onClick={() => addTrack(item.familyLabel)}
                    onMouseDown={(e) => e.preventDefault()}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 8px', letterSpacing: '0.08em', opacity: 0.5 }}
                  >
                    + {item.familyLabel}
                  </button>
                </div>
                <div style={{ flex: 1 }} />
              </div>
            )
          }
          const track = item.track
          const isRef = track.isReference
          const isMuted = isRef ? referenceTrackMuted : (mutedTracks[track.id] || false)
          const trackClips = clips.filter(c => c.trackId === track.id)

          return (
            <div
              key={track.id}
              style={{
                display: 'flex', height: TRACK_HEIGHT,
                borderBottom: '1px solid var(--text-08)',
                opacity: isMuted ? 0.4 : 1,
                transition: 'opacity 0.1s'
              }}
            >
              {/* Track header */}
              <div style={{
                width: LABEL_WIDTH, flexShrink: 0,
                borderRight: '1px solid var(--text-15)',
                display: 'flex', alignItems: 'center',
                padding: '0 10px', gap: 8,
                background: 'rgba(245,243,238,0.02)'
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.10em',
                  color: isMuted ? 'var(--text-15)' : 'var(--text-50)',
                  minWidth: 36, userSelect: 'none'
                }}>
                  {track.label}
                </span>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: 11,
                  color: isMuted ? 'var(--text-15)' : 'var(--text-78)',
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap', userSelect: 'none'
                }}>
                  {track.displayName}
                </span>
                <button
                  className="icon"
                  onClick={() => toggleMute(track.id, isRef)}
                  onMouseDown={(e) => e.preventDefault()}
                  title={isMuted ? 'Activar' : 'Silenciar'}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em',
                    padding: '3px 5px', opacity: isMuted ? 1 : 0.6,
                    background: isMuted ? 'var(--text-15)' : 'transparent',
                    color: isMuted ? 'var(--text-100)' : 'var(--text-50)',
                    borderColor: isMuted ? 'var(--text-50)' : 'transparent'
                  }}
                >
                  {isMuted ? 'SIL' : 'M'}
                </button>
              </div>

              {/* Clip area */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'rgba(245,243,238,0.015)' }}>

                {/* Grid lines */}
                {rulerMarks.filter(m => m.time > 0).map(mark => (
                  <div key={mark.time} style={{
                    position: 'absolute', left: mark.x, top: 0,
                    width: 1, height: '100%', background: 'var(--text-08)', pointerEvents: 'none'
                  }} />
                ))}

                {/* Empty label */}
                {!isRef && trackClips.length === 0 && (
                  <div style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-15)',
                    pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none'
                  }}>
                    {analysis ? 'Vacío' : 'Analiza el vídeo para ver las cues'}
                  </div>
                )}
                {isRef && (
                  <div style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)',
                    pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none'
                  }}>
                    Audio original · no se exporta
                  </div>
                )}

                {/* Clips */}
                {trackClips.map(clip => {
                  const x = clip.startTime * pixPerSec
                  const w = Math.max(4, (clip.endTime - clip.startTime) * pixPerSec)
                  const isDragging = draggingId === clip.id
                  const hasAudio = !!clip.audioFile

                  return (
                    <div
                      key={clip.id}
                      title={clip.label}
                      onMouseDown={e => startDrag(e, clip.id, 'move')}
                      style={{
                        position: 'absolute',
                        left: x, top: 4,
                        width: w, height: TRACK_HEIGHT - 8,
                        background: hasAudio ? 'rgba(245,243,238,0.16)' : 'rgba(245,243,238,0.07)',
                        border: `1px solid ${hasAudio ? 'rgba(245,243,238,0.40)' : 'rgba(245,243,238,0.18)'}`,
                        borderRadius: 2, boxSizing: 'border-box', overflow: 'hidden',
                        cursor: isDragging ? 'grabbing' : 'grab',
                        opacity: isDragging ? 0.7 : 1,
                        transition: isDragging ? 'none' : 'opacity 0.1s',
                      }}
                    >
                      {/* Left trim handle */}
                      <div
                        onMouseDown={e => startDrag(e, clip.id, 'trim-left')}
                        style={{
                          position: 'absolute', left: 0, top: 0, width: 5, height: '100%',
                          cursor: 'ew-resize', zIndex: 2, background: 'rgba(245,243,238,0.1)'
                        }}
                      />

                      {/* Label */}
                      {w > 32 && (
                        <div style={{
                          position: 'absolute', left: 8, right: 14, top: '50%', transform: 'translateY(-50%)',
                          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.03em',
                          color: hasAudio ? 'var(--text-78)' : 'var(--text-50)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          pointerEvents: 'none', userSelect: 'none',
                        }}>
                          {hasAudio && '♪ '}{clip.label}
                        </div>
                      )}

                      {/* Gain slider */}
                      {w > 60 && clip.audioFile && (
                        <input
                          type="range"
                          min="0.1"
                          max="2"
                          step="0.05"
                          value={clip.gain ?? 1}
                          title={`Volumen: ${Math.round((clip.gain ?? 1) * 100)}%`}
                          onMouseDown={e => e.stopPropagation()}
                          onChange={e => {
                            const gain = parseFloat(e.target.value)
                            setClips(prev => prev.map(c => c.id === clip.id ? { ...c, gain } : c))
                          }}
                          style={{
                            position: 'absolute', bottom: 3, left: 8, right: 8,
                            height: 3, padding: 0, margin: 0,
                            cursor: 'ew-resize', accentColor: 'var(--senal)', opacity: 0.5,
                          }}
                        />
                      )}

                      {/* Priority dot */}
                      {w > 20 && (
                        <div style={{
                          position: 'absolute', right: 5, top: 5, width: 4, height: 4, borderRadius: '50%',
                          background: clip.priority === 'A'
                            ? 'rgba(245,243,238,0.9)'
                            : clip.priority === 'B'
                              ? 'rgba(245,243,238,0.5)'
                              : 'rgba(245,243,238,0.2)',
                          pointerEvents: 'none',
                        }} />
                      )}

                      {/* Fade-in gradient */}
                      {(clip.fadeIn ?? 0) > 0 && (
                        <div style={{
                          position: 'absolute', left: 5, top: 0,
                          width: Math.min((clip.fadeIn ?? 0) * pixPerSec, w - 10),
                          height: '100%',
                          background: 'linear-gradient(to right, rgba(15,15,15,0.55), transparent)',
                          pointerEvents: 'none', zIndex: 1,
                        }} />
                      )}
                      {/* Fade-out gradient */}
                      {(clip.fadeOut ?? 0) > 0 && (
                        <div style={{
                          position: 'absolute', right: 5, top: 0,
                          width: Math.min((clip.fadeOut ?? 0) * pixPerSec, w - 10),
                          height: '100%',
                          background: 'linear-gradient(to left, rgba(15,15,15,0.55), transparent)',
                          pointerEvents: 'none', zIndex: 1,
                        }} />
                      )}

                      {/* Fade-in handle — drag right to extend */}
                      {hasAudio && w > 24 && (
                        <div
                          onMouseDown={e => startDrag(e, clip.id, 'fade-in')}
                          title={`Fade in: ${((clip.fadeIn ?? 0)).toFixed(2)}s`}
                          style={{
                            position: 'absolute',
                            left: Math.max(5, Math.min((clip.fadeIn ?? 0) * pixPerSec, w - 14)),
                            top: 0, width: 0, height: 0, zIndex: 4,
                            borderLeft: '5px solid transparent',
                            borderRight: '5px solid transparent',
                            borderTop: '7px solid rgba(245,243,238,0.5)',
                            cursor: 'ew-resize',
                          }}
                        />
                      )}
                      {/* Fade-out handle — drag left to extend */}
                      {hasAudio && w > 24 && (
                        <div
                          onMouseDown={e => startDrag(e, clip.id, 'fade-out')}
                          title={`Fade out: ${((clip.fadeOut ?? 0)).toFixed(2)}s`}
                          style={{
                            position: 'absolute',
                            right: Math.max(5, Math.min((clip.fadeOut ?? 0) * pixPerSec, w - 14)),
                            top: 0, width: 0, height: 0, zIndex: 4,
                            borderLeft: '5px solid transparent',
                            borderRight: '5px solid transparent',
                            borderTop: '7px solid rgba(245,243,238,0.5)',
                            cursor: 'ew-resize',
                          }}
                        />
                      )}

                      {/* Right trim handle */}
                      <div
                        onMouseDown={e => startDrag(e, clip.id, 'trim-right')}
                        style={{
                          position: 'absolute', right: 0, top: 0, width: 5, height: '100%',
                          cursor: 'ew-resize', zIndex: 2, background: 'rgba(245,243,238,0.1)'
                        }}
                      />
                    </div>
                  )
                })}

                {/* Playhead */}
                {clipAreaWidth > 0 && (
                  <div style={{
                    position: 'absolute', left: playheadX, top: 0,
                    width: 1, height: '100%',
                    background: 'var(--senal)', zIndex: 10, pointerEvents: 'none'
                  }} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
