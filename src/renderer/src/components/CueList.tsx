import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Cue, CueTrack, CueStatus, AnalysisResult, FreesoundAttribution } from '../types'
import ElevenLabsModal from './ElevenLabsModal'
import FreesoundModal from './FreesoundModal'

interface Props {
  analysis: AnalysisResult
  projectPath: string
  onSeek?: (tc: number) => void
  onAnalysisUpdate: (updated: AnalysisResult) => void
}

const TRACK_ORDER: CueTrack[] = ['AMB', 'FOLEY', 'DISEÑO', 'PRÁCTICO']
const STATUS_CYCLE: CueStatus[] = ['pending', 'in_progress', 'done', 'skipped']
const STATUS_LABEL: Record<CueStatus, string> = {
  pending: '○',
  in_progress: '◑',
  done: '●',
  skipped: '–'
}
const STATUS_COLOR: Record<CueStatus, string> = {
  pending: 'var(--text-15)',
  in_progress: 'var(--text-78)',
  done: 'var(--text-50)',
  skipped: 'var(--text-08)'
}
const PRIORITY_LABEL: Record<string, string> = { A: 'A', B: 'B', C: 'C' }

function formatTc(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function TrackBadge({ track }: { track: CueTrack }): JSX.Element {
  const colors: Record<CueTrack, string> = {
    AMB: 'rgba(245,243,238,0.10)',
    FOLEY: 'rgba(245,243,238,0.07)',
    DISEÑO: 'rgba(245,243,238,0.05)',
    PRÁCTICO: 'rgba(245,243,238,0.04)'
  }
  return (
    <span style={{
      background: colors[track],
      border: '1px solid var(--text-08)',
      borderRadius: 2,
      padding: '1px 6px',
      fontFamily: 'var(--font-mono)',
      fontSize: 9,
      letterSpacing: '0.08em',
      color: 'var(--text-78)',
      whiteSpace: 'nowrap'
    }}>
      {track}
    </span>
  )
}

function EditableCell({
  value,
  onChange,
  multiline = false,
  style
}: {
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  style?: React.CSSProperties
}): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = useCallback(() => {
    setEditing(false)
    if (draft !== value) onChange(draft)
  }, [draft, value, onChange])

  if (editing) {
    const base: React.CSSProperties = {
      background: 'var(--text-08)',
      border: '1px solid var(--text-50)',
      borderRadius: 2,
      color: 'var(--text-100)',
      fontFamily: 'var(--font-ui)',
      fontSize: 12,
      padding: '3px 6px',
      lineHeight: 1.4,
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box',
      ...style
    }
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); setDraft(value) } }}
          rows={3}
          style={{ ...base, resize: 'vertical' }}
        />
      )
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setEditing(false); setDraft(value) }
        }}
        style={base}
      />
    )
  }

  return (
    <div
      onClick={() => { setEditing(true); setDraft(value) }}
      title="Click para editar"
      style={{
        cursor: 'text',
        lineHeight: 1.4,
        color: value ? 'var(--text-78)' : 'var(--text-15)',
        ...style
      }}
    >
      {value || '—'}
    </div>
  )
}

// ─── Audio panel (expandable per row) ────────────────────────────────────────

function AudioPanel({
  cue,
  projectPath,
  onGenerate,
  onSearch,
  onImport,
  onRemove
}: {
  cue: Cue
  projectPath: string
  onGenerate: () => void
  onSearch: () => void
  onImport: () => void
  onRemove: () => void
}): JSX.Element {
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    if (cue.audioFile) {
      window.spotter.getMediaUrl(projectPath, cue.audioFile).then(setAudioUrl)
    } else {
      setAudioUrl(null)
    }
  }, [cue.audioFile, projectPath])

  const sourceLabel: Record<string, string> = {
    generated: 'ElevenLabs',
    freesound: 'Freesound',
    imported: 'Importado'
  }

  return (
    <div style={{
      gridColumn: '1 / -1',
      padding: '8px 12px 10px 68px',
      borderTop: '1px solid var(--text-04)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }}>
      {cue.audioFile && audioUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)', letterSpacing: '0.04em' }}>
              {cue.audioSource ? sourceLabel[cue.audioSource] : 'Audio'} — {cue.audioFile}
            </span>
            {cue.freesoundAttribution && (
              <span
                title={`${cue.freesoundAttribution.author} · ${cue.freesoundAttribution.license}`}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)', border: '1px solid var(--text-08)', borderRadius: 2, padding: '1px 4px' }}
              >
                CC
              </span>
            )}
            <button
              className="ghost"
              onClick={onRemove}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '1px 6px', marginLeft: 'auto', color: 'var(--text-50)' }}
            >
              ✕ QUITAR
            </button>
          </div>
          <audio src={audioUrl} controls style={{ width: '100%', height: 28 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-15)', letterSpacing: '0.04em', marginRight: 4 }}>
            OBTENER AUDIO
          </span>
          <button
            className="ghost"
            onClick={onGenerate}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 10px' }}
          >
            ⚡ GENERAR
          </button>
          <button
            className="ghost"
            onClick={onSearch}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 10px' }}
          >
            🔍 BUSCAR
          </button>
          <button
            className="ghost"
            onClick={onImport}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '3px 10px' }}
          >
            ↑ IMPORTAR
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function CueList({ analysis, projectPath, onSeek, onAnalysisUpdate }: Props): JSX.Element {
  const [filterTrack, setFilterTrack] = useState<CueTrack | 'ALL'>('ALL')
  const [filterStatus, setFilterStatus] = useState<CueStatus | 'ALL'>('ALL')
  const [sortBy] = useState<'tc_in' | 'priority' | 'track'>('tc_in')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [elModal, setElModal] = useState<{ cueId: string; description: string; duration: number } | null>(null)
  const [fsModal, setFsModal] = useState<{ cueId: string; description: string } | null>(null)

  const updateCue = useCallback((id: string, patch: Partial<Cue>) => {
    const updated: AnalysisResult = {
      ...analysis,
      cues: analysis.cues.map((c) => c.id === id ? { ...c, ...patch } : c)
    }
    onAnalysisUpdate(updated)
    window.spotter.saveAnalysis(projectPath, updated)
  }, [analysis, projectPath, onAnalysisUpdate])

  const cycleStatus = useCallback((cue: Cue) => {
    const idx = STATUS_CYCLE.indexOf(cue.status)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    updateCue(cue.id, { status: next })
  }, [updateCue])

  const cyclePriority = useCallback((cue: Cue) => {
    const order: Cue['priority'][] = ['A', 'B', 'C']
    const idx = order.indexOf(cue.priority)
    updateCue(cue.id, { priority: order[(idx + 1) % 3] })
  }, [updateCue])

  const handleAudioDone = useCallback((cueId: string, filename: string, source: Cue['audioSource'], attribution?: FreesoundAttribution) => {
    updateCue(cueId, {
      audioFile: filename,
      audioSource: source,
      status: 'done',
      ...(attribution ? { freesoundAttribution: attribution } : {})
    })
    setElModal(null)
    setFsModal(null)
  }, [updateCue])

  const handleImportFile = useCallback(async (cueId: string) => {
    const filename = await window.spotter.importAudioFile(projectPath, cueId)
    if (filename) {
      updateCue(cueId, { audioFile: filename, audioSource: 'imported', status: 'done' })
    }
  }, [projectPath, updateCue])

  const visible = useMemo(() => {
    let cues = [...analysis.cues]
    if (filterTrack !== 'ALL') cues = cues.filter((c) => c.track === filterTrack)
    if (filterStatus !== 'ALL') cues = cues.filter((c) => c.status === filterStatus)
    if (sortBy === 'tc_in') cues.sort((a, b) => a.tc_in - b.tc_in)
    else if (sortBy === 'priority') cues.sort((a, b) => a.priority.localeCompare(b.priority))
    else if (sortBy === 'track') cues.sort((a, b) => TRACK_ORDER.indexOf(a.track) - TRACK_ORDER.indexOf(b.track))
    return cues
  }, [analysis.cues, filterTrack, filterStatus, sortBy])

  const stats = useMemo(() => {
    const total = analysis.cues.length
    const done = analysis.cues.filter((c) => c.status === 'done').length
    const withAudio = analysis.cues.filter((c) => c.audioFile).length
    return { total, done, withAudio }
  }, [analysis.cues])

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Narrative summary bar */}
        <div style={{
          padding: '10px 16px',
          background: 'var(--text-04)',
          borderBottom: '1px solid var(--text-08)',
          display: 'flex',
          gap: 16,
          alignItems: 'flex-start',
          flexShrink: 0
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-editorial)', fontStyle: 'italic', fontSize: 13, color: 'var(--text-78)', lineHeight: 1.5 }}>
              {analysis.narrative.synopsis}
            </div>
            <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)', letterSpacing: '0.04em' }}>
              {analysis.narrative.mood} · {analysis.narrative.pacing}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexShrink: 0, alignItems: 'center' }}>
            <StatChip label="total" value={stats.total} />
            <StatChip label="audio" value={stats.withAudio} />
            <StatChip label="done" value={stats.done} />
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          borderBottom: '1px solid var(--text-08)',
          background: 'var(--text-04)'
        }}>
          <span className="section-label">FILTRAR POR</span>

          <div style={{ display: 'flex', gap: 4 }}>
            {(['ALL', ...TRACK_ORDER] as const).map((t) => (
              <button
                key={t}
                className={`icon ${filterTrack === t ? 'active' : ''}`}
                onClick={() => setFilterTrack(t)}
                style={{ fontSize: 10, padding: '2px 7px', letterSpacing: '0.04em' }}
              >
                {t === 'ALL' ? 'TODOS' : t}
              </button>
            ))}
          </div>

          <div style={{ width: 1, height: 14, background: 'var(--text-15)' }} />

          <div style={{ display: 'flex', gap: 4 }}>
            {(['ALL', ...STATUS_CYCLE] as const).map((s) => (
              <button
                key={s}
                className={`icon ${filterStatus === s ? 'active' : ''}`}
                onClick={() => setFilterStatus(s)}
                style={{ fontSize: 10, padding: '2px 7px' }}
              >
                {s === 'ALL' ? '◯ TODOS' : STATUS_LABEL[s as CueStatus]}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)' }}>
            {visible.length} / {analysis.cues.length}
          </span>
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '56px 56px 72px 1fr 120px 36px 28px 20px',
          padding: '6px 12px',
          gap: 8,
          flexShrink: 0,
          borderBottom: '1px solid var(--text-08)'
        }}>
          {['TC IN', 'TC OUT', 'TRACK', 'DESCRIPCIÓN', 'MOOD', 'PRI', 'ST', ''].map((h, i) => (
            <span key={i} className="section-label">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {visible.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-15)' }}>
              Sin cues en este filtro
            </div>
          )}
          {visible.map((cue, i) => {
            const expanded = expandedId === cue.id
            return (
              <div
                key={cue.id}
                style={{
                  background: i % 2 === 1 ? 'var(--text-04)' : 'transparent',
                  borderBottom: '1px solid var(--text-04)',
                  opacity: cue.status === 'skipped' ? 0.35 : 1
                }}
              >
                {/* Main row */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 56px 72px 1fr 120px 36px 28px 20px',
                  padding: '7px 12px',
                  gap: 8,
                  alignItems: 'start'
                }}>
                  <button
                    className="ghost"
                    onClick={() => onSeek && onSeek(cue.tc_in)}
                    title={`Ir a ${formatTc(cue.tc_in)}`}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '1px 4px', color: 'var(--text-60)', letterSpacing: '0.03em', textAlign: 'left' }}
                  >
                    {formatTc(cue.tc_in)}
                  </button>

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-50)', paddingTop: 3, letterSpacing: '0.03em' }}>
                    {formatTc(cue.tc_out)}
                  </div>

                  <div style={{ paddingTop: 2 }}>
                    <TrackBadge track={cue.track} />
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <EditableCell
                      value={cue.description}
                      onChange={(v) => updateCue(cue.id, { description: v })}
                      style={{ fontSize: 12 }}
                    />
                    {cue.notes && (
                      <div style={{ marginTop: 3, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)', letterSpacing: '0.02em', lineHeight: 1.4 }}>
                        {cue.notes}
                      </div>
                    )}
                    {cue.audioFile && (
                      <div style={{ marginTop: 3, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)', letterSpacing: '0.02em' }}>
                        ♪ {cue.audioFile}
                      </div>
                    )}
                  </div>

                  <EditableCell
                    value={cue.mood}
                    onChange={(v) => updateCue(cue.id, { mood: v })}
                    style={{ fontSize: 11, color: 'var(--text-60)', fontStyle: 'italic' }}
                  />

                  <button
                    className="icon"
                    onClick={() => cyclePriority(cue)}
                    title="Ciclar prioridad"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      padding: '1px 4px',
                      letterSpacing: '0.04em',
                      color: cue.priority === 'A' ? 'var(--text-100)' : cue.priority === 'B' ? 'var(--text-60)' : 'var(--text-50)',
                      fontWeight: cue.priority === 'A' ? 700 : 400
                    }}
                  >
                    {PRIORITY_LABEL[cue.priority]}
                  </button>

                  <button
                    className="icon"
                    onClick={() => cycleStatus(cue)}
                    title={`Estado: ${cue.status}`}
                    style={{ fontSize: 14, padding: '1px 2px', color: STATUS_COLOR[cue.status] }}
                  >
                    {STATUS_LABEL[cue.status]}
                  </button>

                  {/* Expand toggle */}
                  <button
                    className="icon"
                    onClick={() => setExpandedId(expanded ? null : cue.id)}
                    title={expanded ? 'Cerrar' : 'Obtener audio'}
                    style={{ fontSize: 10, padding: '1px 2px', color: cue.audioFile ? 'var(--text-78)' : 'var(--text-15)' }}
                  >
                    {expanded ? '▴' : '▾'}
                  </button>
                </div>

                {/* Audio panel */}
                {expanded && (
                  <AudioPanel
                    cue={cue}
                    projectPath={projectPath}
                    onGenerate={() => setElModal({ cueId: cue.id, description: cue.description, duration: cue.tc_out - cue.tc_in })}
                    onSearch={() => setFsModal({ cueId: cue.id, description: cue.description })}
                    onImport={() => handleImportFile(cue.id)}
                    onRemove={() => updateCue(cue.id, { audioFile: undefined, audioSource: undefined, freesoundAttribution: undefined })}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ElevenLabs modal */}
      {elModal && (
        <ElevenLabsModal
          cueId={elModal.cueId}
          cueDescription={elModal.description}
          duration={elModal.duration}
          projectPath={projectPath}
          onDone={(filename) => handleAudioDone(elModal.cueId, filename, 'generated')}
          onClose={() => setElModal(null)}
        />
      )}

      {/* Freesound modal */}
      {fsModal && (
        <FreesoundModal
          cueId={fsModal.cueId}
          cueDescription={fsModal.description}
          projectPath={projectPath}
          onDone={(filename, attribution) => handleAudioDone(fsModal.cueId, filename, 'freesound', attribution)}
          onClose={() => setFsModal(null)}
        />
      )}
    </>
  )
}

function StatChip({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, color: 'var(--text-78)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}
