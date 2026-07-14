import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Project, RecentProject } from '../types'

interface Props {
  onProjectOpen: (project: Project) => void
}

type ImportState = 'idle' | 'loading' | 'error'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Welcome({ onProjectOpen }: Props): JSX.Element {
  const [importState, setImportState] = useState<ImportState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const loadingText = useRef('Importando vídeo…')

  useEffect(() => {
    window.spotter.getRecentProjects().then(setRecentProjects).catch(console.error)
  }, [])

  const processVideoFile = useCallback(async (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase()
    if (ext !== 'mp4' && ext !== 'mov') {
      setErrorMessage('Solo se admiten archivos MP4 y MOV.')
      setImportState('error')
      return
    }

    setImportState('loading')
    loadingText.current = 'Leyendo metadatos…'

    try {
      const metadata = await window.spotter.getVideoMetadata(filePath)

      if (metadata.duration > 300) {
        const totalSec = Math.floor(metadata.duration)
        const min = Math.floor(totalSec / 60)
        const sec = totalSec % 60
        setErrorMessage(
          `Este vídeo dura ${min}:${sec.toString().padStart(2, '0')}. SPOTTER trabaja con piezas de hasta 5 minutos. Divide el vídeo por escenas y crea un proyecto por escena.`
        )
        setImportState('error')
        return
      }

      loadingText.current = 'Creando proyecto…'
      const project = await window.spotter.createProject(filePath)
      onProjectOpen(project)
    } catch (err) {
      setErrorMessage('Error al importar el vídeo. Comprueba que el archivo no está dañado.')
      setImportState('error')
    }
  }, [onProjectOpen])

  const handleNewProject = useCallback(async () => {
    const result = await window.spotter.openVideo()
    if (result.canceled || !result.filePath) return
    await processVideoFile(result.filePath)
  }, [processVideoFile])

  const handleOpenRecent = useCallback(async (projectPath: string) => {
    try {
      const project = await window.spotter.loadProject(projectPath)
      onProjectOpen(project)
    } catch {
      setErrorMessage('No se pudo abrir el proyecto. La carpeta puede haber sido movida o eliminada.')
      setImportState('error')
    }
  }, [onProjectOpen])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    await processVideoFile(file.path)
  }, [processVideoFile])

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        outline: isDragOver ? '1px dashed var(--text-50)' : 'none',
        outlineOffset: '-8px'
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Logo / Header */}
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <div style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 42,
          fontWeight: 700,
          letterSpacing: '0.22em',
          color: 'var(--text-100)',
          marginBottom: 10
        }}>
          SPOTTER
        </div>
        <div style={{
          fontFamily: 'var(--font-editorial)',
          fontStyle: 'italic',
          fontSize: 15,
          color: 'var(--text-50)',
          letterSpacing: '0.01em'
        }}>
          Diseño sonoro asistido por IA
        </div>
        <div style={{
          marginTop: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.12em',
          color: 'var(--text-15)',
          textTransform: 'uppercase'
        }}>
          Lemö Labs
        </div>
      </div>

      {/* Main content: two columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 1px 320px',
        gap: 0,
        alignItems: 'start',
        maxWidth: 640
      }}>
        {/* Left: New project */}
        <div style={{ padding: '0 32px 0 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>
            01 — Nuevo proyecto
          </div>

          {importState === 'idle' && (
            <>
              <button
                className="primary"
                onClick={handleNewProject}
                style={{ padding: '12px 24px', fontSize: 13, width: '100%' }}
              >
                + Importar vídeo
              </button>
              <div style={{
                color: 'var(--text-muted)',
                fontSize: 11,
                textAlign: 'center',
                lineHeight: 1.5
              }}>
                MP4 · MOV<br />
                Hasta 5 minutos<br />
                <br />
                O arrastra el archivo aquí
              </div>
            </>
          )}

          {importState === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0' }}>
              <div className="spinner" />
              <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                {loadingText.current}
              </span>
            </div>
          )}

          {importState === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{
                background: 'var(--text-04)',
                border: '1px solid var(--text-15)',
                borderRadius: 3,
                padding: '10px 12px',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                lineHeight: 1.6,
                color: 'var(--text-78)',
                letterSpacing: '0.02em'
              }}>
                {errorMessage}
              </div>
              <button onClick={() => setImportState('idle')} style={{ fontSize: 11 }}>
                Intentar de nuevo
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ background: 'var(--border-subtle)', height: 200, alignSelf: 'center' }} />

        {/* Right: Recent projects */}
        <div style={{ padding: '0 0 0 32px' }}>
          <div className="section-label" style={{ marginBottom: 14 }}>
            02 — Proyectos recientes
          </div>

          {recentProjects.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>
              Todavía no hay proyectos.<br />
              Importa tu primer vídeo para empezar.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentProjects.map((p) => (
              <button
                key={p.id}
                className="ghost"
                onClick={() => handleOpenRecent(p.projectPath)}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 6,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  width: '100%'
                }}
              >
                <span style={{
                  fontFamily: 'var(--font-editorial)',
                  fontSize: 14,
                  color: 'var(--text-78)'
                }}>
                  {p.name}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  color: 'var(--text-50)'
                }}>
                  {formatDate(p.createdAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(245, 243, 238, 0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{
            border: '1px dashed var(--text-50)',
            borderRadius: 4,
            padding: '40px 60px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '0.06em',
            color: 'var(--text-78)',
            textTransform: 'uppercase'
          }}>
            Suelta el vídeo aquí
          </div>
        </div>
      )}

      {/* Version */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        right: 20,
        color: 'var(--text-muted)',
        fontSize: 10,
        letterSpacing: 0.5
      }}>
        SPOTTER · Fase 1
      </div>
    </div>
  )
}
