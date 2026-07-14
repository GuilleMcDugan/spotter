import React, { useState, useCallback } from 'react'
import { Project } from './types'
import Welcome from './components/Welcome'
import ProjectView from './components/ProjectView'

export default function App(): JSX.Element {
  const [view, setView] = useState<'welcome' | 'project'>('welcome')
  const [project, setProject] = useState<Project | null>(null)

  const handleProjectOpen = useCallback((p: Project) => {
    setProject(p)
    setView('project')
  }, [])

  const handleBackToWelcome = useCallback(() => {
    setProject(null)
    setView('welcome')
  }, [])

  const handleProjectUpdate = useCallback((updated: Project) => {
    setProject(updated)
    window.spotter.saveProject(updated)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {view === 'welcome' && (
        <Welcome onProjectOpen={handleProjectOpen} />
      )}
      {view === 'project' && project && (
        <ProjectView
          project={project}
          onProjectUpdate={handleProjectUpdate}
          onClose={handleBackToWelcome}
        />
      )}
    </div>
  )
}
