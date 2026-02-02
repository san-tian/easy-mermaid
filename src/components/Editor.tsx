import { useRef, useEffect, useCallback } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useEditorStore } from '../store/editorStore'

export function CodeEditor() {
  const { code, setCode, selectedNode, selectedEdge } = useEditorStore()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null)

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  const findNodeLines = useCallback((nodeId: string): number[] => {
    const lines: number[] = []
    const codeLines = code.split('\n')
    const nodePattern = new RegExp(`\\b${nodeId}\\b`)
    codeLines.forEach((line, index) => {
      if (nodePattern.test(line) && !line.trim().startsWith('style ')) {
        lines.push(index + 1)
      }
    })
    return lines
  }, [code])

  const findEdgeLine = useCallback((from: string, to: string): number | null => {
    const codeLines = code.split('\n')
    const edgePattern = new RegExp(`\\b${from}\\b.*(?:-->|---->|-.->|==>).*\\b${to}\\b`)
    for (let i = 0; i < codeLines.length; i++) {
      if (edgePattern.test(codeLines[i])) {
        return i + 1
      }
    }
    return null
  }, [code])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return

    // 清除旧的高亮
    if (decorationsRef.current) {
      decorationsRef.current.clear()
    }

    const decorations: editor.IModelDeltaDecoration[] = []

    if (selectedNode) {
      const lines = findNodeLines(selectedNode)
      lines.forEach((lineNumber) => {
        decorations.push({
          range: { startLineNumber: lineNumber, startColumn: 1, endLineNumber: lineNumber, endColumn: 1 },
          options: {
            isWholeLine: true,
            className: 'highlighted-line',
            glyphMarginClassName: 'highlighted-glyph',
          },
        })
      })
      // 滚动到第一个匹配行
      if (lines.length > 0) {
        editor.revealLineInCenter(lines[0])
      }
    } else if (selectedEdge) {
      const lineNumber = findEdgeLine(selectedEdge.from, selectedEdge.to)
      if (lineNumber) {
        decorations.push({
          range: { startLineNumber: lineNumber, startColumn: 1, endLineNumber: lineNumber, endColumn: 1 },
          options: {
            isWholeLine: true,
            className: 'highlighted-line',
            glyphMarginClassName: 'highlighted-glyph',
          },
        })
        editor.revealLineInCenter(lineNumber)
      }
    }

    decorationsRef.current = editor.createDecorationsCollection(decorations)
  }, [selectedNode, selectedEdge, findNodeLines, findEdgeLine])

  return (
    <div className="h-full w-full border-r border-gray-200">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        value={code}
        onChange={(value) => setCode(value || '')}
        theme="vs-light"
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          padding: { top: 16 },
          glyphMargin: true,
        }}
      />
    </div>
  )
}
