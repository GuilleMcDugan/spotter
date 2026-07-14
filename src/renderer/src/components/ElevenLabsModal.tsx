import React, { useState, useRef, useCallback } from 'react'
import { toSoundQuery } from '../utils/soundQuery'

interface Props {
  cueId: string
  cueDescription: string
  duration: number
  projectPath: string
  onDone: (filename: string) => void
  onClose: () => void
}

export default function ElevenLabsModal({
  cueId,
  cueDescription,
  duration,
  projectPath,
  onDone,
  onClose
}: Props): JSX.Element {
  const [prompt, setPrompt] = useState(() => toSoundQuery(cueDescription))
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultFile, setResultFile] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const targetDuration = Math.max(0.5, Math.min(22, Math.round(duration)))

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setResultFile(null)
    setAudioUrl(null)
    try {
      const filename = await window.spotter.generateSfx(projectPath, cueId, prompt, targetDuration)
      const url = await window.spotter.getMediaUrl(projectPath, filename)
      setResultFile(filename)
      setAudioUrl(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setGenerating(false)
    }
  }, [projectPath, cueId, prompt, targetDuration])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 200
    }}>
      <div style={{
        background: 'var(--bg)',
        border: '1px solid var(--text-15)',
        borderRadius: 4,
        width: 480,
        padding: '24px 28px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-label">GENERAR SFX — ELEVENLABS</span>
          <button
            className="ghost"
            onClick={onClose}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 6px' }}
          >
            ✕
          </button>
        </div>

        {/* Prompt */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)', letterSpacing: '0.04em' }}>
            DESCRIPCIÓN DEL SONIDO (en inglés funciona mejor)
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            style={{
              background: 'var(--text-04)',
              border: '1px solid var(--text-15)',
              borderRadius: 3,
              color: 'var(--text-100)',
              fontFamily: 'var(--font-editorial)',
              fontSize: 14,
              padding: '8px 10px',
              lineHeight: 1.5,
              resize: 'vertical',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--text-50)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--text-15)' }}
          />
        </div>

        {/* Duration + cost */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)', letterSpacing: '0.06em' }}>DURACIÓN</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-78)' }}>{targetDuration}s</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-50)', letterSpacing: '0.06em' }}>COSTE ESTIMADO</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-78)' }}>~{targetDuration} créditos EL</span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '8px 12px',
            background: 'var(--text-04)',
            border: '1px solid var(--text-15)',
            borderRadius: 3,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-78)',
            lineHeight: 1.5
          }}>
            {error}
          </div>
        )}

        {/* Result player */}
        {audioUrl && (
          <div style={{
            padding: '10px 12px',
            background: 'var(--text-04)',
            border: '1px solid var(--text-08)',
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)', letterSpacing: '0.04em' }}>
              RESULTADO — {resultFile}
            </span>
            <audio ref={audioRef} src={audioUrl} controls style={{ width: '100%', height: 32 }} />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          {resultFile && (
            <button
              className="ghost"
              onClick={handleGenerate}
              disabled={generating}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '6px 14px' }}
            >
              REGENERAR
            </button>
          )}
          <button
            className={resultFile ? 'primary' : 'ghost'}
            onClick={generating ? undefined : resultFile ? () => onDone(resultFile) : handleGenerate}
            disabled={generating || !prompt.trim()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '6px 14px' }}
          >
            {generating ? 'GENERANDO…' : resultFile ? 'USAR ESTE' : 'GENERAR'}
          </button>
        </div>
      </div>
    </div>
  )
}
