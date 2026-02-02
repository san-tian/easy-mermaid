import { useEffect } from 'react'
import { CodeEditor } from './components/Editor'
import { Preview } from './components/Preview'
import { StylePanel } from './components/StylePanel'
import { Toolbar } from './components/Toolbar'
import { ResizableLayout } from './components/ResizableLayout'
import { useEditorStore } from './store/editorStore'

function App() {
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      <Toolbar />
      <ResizableLayout
        leftChild={<CodeEditor />}
        rightChild={<Preview />}
        rightPanel={<StylePanel />}
        defaultLeftWidth={45}
        minLeftWidth={20}
        maxLeftWidth={70}
        rightPanelWidth={256}
      />
    </div>
  )
}

export default App
