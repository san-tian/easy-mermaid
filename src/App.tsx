import { CodeEditor } from './components/Editor'
import { Preview } from './components/Preview'
import { StylePanel } from './components/StylePanel'
import { Toolbar } from './components/Toolbar'
import { ResizableLayout } from './components/ResizableLayout'

function App() {
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
