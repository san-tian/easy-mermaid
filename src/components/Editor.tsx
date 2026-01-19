import Editor from '@monaco-editor/react'
import { useEditorStore } from '../store/editorStore'

export function CodeEditor() {
  const { code, setCode } = useEditorStore()

  return (
    <div className="h-full w-full border-r border-gray-200">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        value={code}
        onChange={(value) => setCode(value || '')}
        theme="vs-light"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          padding: { top: 16 },
        }}
      />
    </div>
  )
}
