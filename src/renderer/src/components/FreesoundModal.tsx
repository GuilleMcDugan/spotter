import React, { useState, useCallback, useRef } from 'react'
import { FreesoundResult, FreesoundAttribution } from '../types'
import { toSoundQuery } from '../utils/soundQuery'

interface Props {
  cueId: string
  cueDescription: string
  projectPath: string
  onDone: (filename: string, attribution: FreesoundAttribution) => void
  onClose: () => void
}

function licenseBadge(license: string): string {
  if (license.includes('publicdomain') || license.includes('CC0')) return 'CC0'
  if (license.includes('by-nc')) return 'CC-BY-NC'
  if (license.includes('by')) return 'CC-BY'
  return license.split('/').filter(Boolean).slice(-2, -1)[0]?.toUpperCase() ?? 'CC'
}

function licenseHint(license: string): string {
  const badge = licenseBadge(license)
  if (badge === 'CC0') return 'Dominio público, sin restricciones'
  if (badge === 'CC-BY') return 'Libre citando al autor'
  if (badge === 'CC-BY-NC') return 'Solo uso no comercial, citar autor'
  return badge
}

function formatDur(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`
}


export default function FreesoundModal({
  cueId,
  cueDescription,
  projectPath,
  onDone,
  onClose
}: Props): JSX.Element {
  const [query, setQuery] = useState(() => toSoundQuery(cueDescription))
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<FreesoundResult[]>([])
  const [fallbackQuery, setFallbackQuery] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [importingId, setImportingId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    setError(null)
    setResults([])
    setFallbackQuery(null)
    try {
      const res = await window.spotter.searchFreesound(query)
      const data = res as { results: FreesoundResult[]; fallback?: string }
      setResults(data.results ?? [])
      if (data.fallback) setFallbackQuery(data.fallback)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al buscar')
    } finally {
      setSearching(false)
    }
  }, [query])

  const togglePreview = useCallback((result: FreesoundResult) => {
    if (playingId === result.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }
    if (audioRef.current) audioRef.current.pause()
    const audio = new Audio(result.previews['preview-lq-mp3'])
    audio.play()
    audio.onended = () => setPlayingId(null)
    audioRef.current = audio
    setPlayingId(result.id)
  }, [playingId])

  const handleImport = useCallback(async (result: FreesoundResult) => {
    setImportingId(result.id)
    try {
      const filename = await window.spotter.importFreesound(projectPath, cueId, result)
      const attribution: FreesoundAttribution = {
        author: result.username,
        license: result.license,
        url: result.url,
        soundId: result.id
      }
      onDone(filename, attribution)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar')
    } finally {
      setImportingId(null)
    }
  }, [projectPath, cueId, onDone])

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
        width: 560,
        maxHeight: '82vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--text-08)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="section-label">BUSCAR EN FREESOUND</span>
            <button
              className="ghost"
              onClick={onClose}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 6px' }}
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Buscar sonido…"
              style={{
                flex: 1,
                background: 'var(--text-04)',
                border: '1px solid var(--text-15)',
                borderRadius: 3,
                color: 'var(--text-100)',
                fontFamily: 'var(--font-ui)',
                fontSize: 13,
                padding: '6px 10px',
                outline: 'none'
              }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--text-50)' }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--text-15)' }}
            />
            <button
              className="primary"
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '6px 14px' }}
            >
              {searching ? '…' : 'BUSCAR'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {error && (
            <div style={{ padding: '12px 24px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-78)' }}>
              {error}
            </div>
          )}

          {fallbackQuery && results.length > 0 && (
            <div style={{ padding: '8px 24px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)', letterSpacing: '0.03em' }}>
              SIN RESULTADOS PARA QUERY COMPLETA — MOSTRANDO: "{fallbackQuery}"
            </div>
          )}

          {!searching && results.length === 0 && !error && (
            <div style={{ padding: '32px 24px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-15)' }}>
              {query.trim() ? 'Sin resultados — prueba con 1-2 palabras en inglés' : 'Pulsa BUSCAR para explorar Freesound'}
            </div>
          )}

          {results.map((r) => (
            <div
              key={r.id}
              style={{
                padding: '10px 24px',
                borderBottom: '1px solid var(--text-04)',
                display: 'flex',
                gap: 12,
                alignItems: 'center'
              }}
            >
              {/* Preview button */}
              <button
                className="icon"
                onClick={() => togglePreview(r)}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  padding: '4px 6px',
                  flexShrink: 0,
                  color: playingId === r.id ? 'var(--text-100)' : 'var(--text-50)'
                }}
                title={playingId === r.id ? 'Parar' : 'Escuchar preview'}
              >
                {playingId === r.id ? '■' : '▶'}
              </button>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: 12,
                  color: 'var(--text-78)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {r.name}
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 3, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)' }}>
                    {formatDur(r.duration)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)' }}>
                    {r.username}
                  </span>
                  <span
                    title={licenseHint(r.license)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 9,
                      color: 'var(--text-50)',
                      border: '1px solid var(--text-15)',
                      borderRadius: 2,
                      padding: '1px 4px',
                      letterSpacing: '0.04em',
                      cursor: 'help'
                    }}
                  >
                    {licenseBadge(r.license)}
                  </span>
                </div>
              </div>

              {/* Import */}
              <button
                className="ghost"
                onClick={() => handleImport(r)}
                disabled={importingId === r.id}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '4px 10px', flexShrink: 0 }}
              >
                {importingId === r.id ? '…' : 'IMPORTAR'}
              </button>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div style={{
          padding: '10px 24px',
          borderTop: '1px solid var(--text-08)',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-15)',
          letterSpacing: '0.03em',
          flexShrink: 0
        }}>
          CC-BY-NC: solo uso no comercial · CC-BY: citar autor · CC0: dominio público
        </div>
      </div>
    </div>
  )
}
