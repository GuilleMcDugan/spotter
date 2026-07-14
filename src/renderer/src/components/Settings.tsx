import React, { useState, useEffect, useCallback } from 'react'

interface Props {
  projectPath: string
  onClose: () => void
}

function KeySection({
  label,
  keyName,
  hint
}: {
  label: string
  keyName: 'elevenlabs' | 'freesound'
  hint: string
}): JSX.Element {
  const [hasKey, setHasKey] = useState(false)
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  useEffect(() => {
    window.spotter.getKey(keyName).then((k) => setHasKey(!!k))
  }, [keyName])

  const handleSave = useCallback(async () => {
    if (!draft.trim()) return
    setStatus('saving')
    try {
      await window.spotter.setKey(keyName, draft.trim())
      setHasKey(true)
      setEditing(false)
      setDraft('')
      setStatus('saved')
      setTimeout(() => setStatus('idle'), 1500)
    } catch {
      setStatus('error')
    }
  }, [keyName, draft])

  const handleDelete = useCallback(async () => {
    await window.spotter.deleteKey(keyName)
    setHasKey(false)
    setEditing(false)
    setDraft('')
  }, [keyName])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="section-label">{label}</span>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-15)',
        letterSpacing: '0.03em',
        lineHeight: 1.7
      }}>
        {hint}
      </div>

      {hasKey && !editing ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-50)',
            letterSpacing: '0.04em'
          }}>
            ●●●●●●●●●●●● Conectado
          </span>
          <button
            className="ghost"
            onClick={() => setEditing(true)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 8px' }}
          >
            CAMBIAR
          </button>
          <button
            className="ghost"
            onClick={handleDelete}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 8px', color: 'var(--text-50)' }}
          >
            BORRAR
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="password"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="Pega tu clave aquí"
            style={{
              flex: 1,
              background: 'var(--text-04)',
              border: '1px solid var(--text-15)',
              borderRadius: 3,
              color: 'var(--text-100)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              padding: '5px 10px',
              outline: 'none'
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--text-50)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--text-15)' }}
          />
          <button
            className="primary"
            onClick={handleSave}
            disabled={!draft.trim() || status === 'saving'}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '5px 12px' }}
          >
            {status === 'saving' ? '…' : 'GUARDAR'}
          </button>
          {editing && (
            <button
              className="ghost"
              onClick={() => { setEditing(false); setDraft('') }}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '5px 8px' }}
            >
              CANCELAR
            </button>
          )}
        </div>
      )}
      {status === 'saved' && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-50)' }}>
          Clave guardada correctamente
        </span>
      )}
      {status === 'error' && (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-78)' }}>
          Error al guardar la clave
        </span>
      )}
    </div>
  )
}

export default function Settings({ projectPath, onClose }: Props): JSX.Element {
  const [criterio, setCriterio] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.spotter.getCriterio(projectPath).then(setCriterio)
  }, [projectPath])

  const handleSave = useCallback(async () => {
    await window.spotter.saveCriterio(projectPath, criterio)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }, [projectPath, criterio])

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100
    }}>
      <div style={{
        background: 'var(--bg)',
        border: '1px solid var(--text-15)',
        borderRadius: 4,
        width: 520,
        maxHeight: '85vh',
        overflowY: 'auto',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-label">AJUSTES</span>
          <button
            className="ghost"
            onClick={onClose}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '2px 6px' }}
          >
            ✕
          </button>
        </div>

        {/* Criterio del director */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="section-label">CRITERIO DEL DIRECTOR</span>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-15)',
            letterSpacing: '0.03em',
            lineHeight: 1.7
          }}>
            Esta intención se incluye en el análisis de Claude Code.<br />
            Describe tono, atmósfera, lo que quieres potenciar o evitar.
          </div>
          <textarea
            value={criterio}
            onChange={(e) => setCriterio(e.target.value)}
            placeholder="Ej: escena de tensión, silencio opresivo, diseño minimalista. Evitar ambientes naturalistas convencionales."
            rows={5}
            style={{
              background: 'var(--text-04)',
              border: '1px solid var(--text-15)',
              borderRadius: 3,
              color: 'var(--text-100)',
              fontFamily: 'var(--font-editorial)',
              fontSize: 14,
              padding: '10px 12px',
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--text-50)' }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--text-15)' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="primary"
              onClick={handleSave}
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.06em', padding: '6px 16px' }}
            >
              GUARDAR
            </button>
            {saved && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-50)', letterSpacing: '0.04em' }}>
                Guardado
              </span>
            )}
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--text-08)' }} />

        {/* ElevenLabs */}
        <KeySection
          label="ELEVENLABS — GENERACIÓN DE SFX"
          keyName="elevenlabs"
          hint={'API key de tu cuenta en elevenlabs.io\nNecesaria para generar efectos de sonido desde texto.'}
        />

        <div style={{ height: 1, background: 'var(--text-08)' }} />

        {/* Freesound */}
        <KeySection
          label="FREESOUND — LIBRERÍA GRATUITA"
          keyName="freesound"
          hint={'API key de freesound.org (requiere cuenta gratuita)\nPermite buscar y descargar efectos con licencia CC.'}
        />

        <div style={{ height: 1, background: 'var(--text-08)' }} />

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-15)',
          letterSpacing: '0.03em',
          lineHeight: 1.7
        }}>
          Las claves se guardan cifradas en el sistema · nunca dentro del proyecto
        </div>
      </div>
    </div>
  )
}
