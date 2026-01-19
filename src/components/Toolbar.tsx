import { useState } from 'react'
import { toPng, toSvg } from 'html-to-image'
import { useEditorStore, DEFAULT_CODE, type FlowDirection } from '../store/editorStore'

const TEMPLATES = {
  flowchart: `flowchart LR
    A[开始] --> B{判断}
    B -->|是| C[处理]
    B -->|否| D[结束]
    C --> D`,
  sequence: `sequenceDiagram
    participant A as 用户
    participant B as 系统
    A->>B: 请求
    B-->>A: 响应`,
  classDiagram: `classDiagram
    class Animal {
        +String name
        +makeSound()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog`,
  stateDiagram: `stateDiagram-v2
    [*] --> 待机
    待机 --> 运行: 启动
    运行 --> 待机: 停止
    运行 --> [*]: 关机`,
  erDiagram: `erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    USER {
        string name
        string email
    }`,
}

const DIRECTIONS: { value: FlowDirection; label: string; icon: string }[] = [
  { value: 'LR', label: '从左到右', icon: '→' },
  { value: 'RL', label: '从右到左', icon: '←' },
  { value: 'TB', label: '从上到下', icon: '↓' },
  { value: 'BT', label: '从下到上', icon: '↑' },
]

export function Toolbar() {
  const { code, setCode, getDirection, changeDirection, getNextNodeId } = useEditorStore()
  const [copied, setCopied] = useState(false)

  const currentDirection = getDirection()
  const isFlowchart = code.trim().startsWith('flowchart')

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportPng = async () => {
    const svgElement = document.querySelector('.preview-container svg') as HTMLElement
    if (!svgElement) return

    try {
      const dataUrl = await toPng(svgElement, { backgroundColor: '#ffffff' })
      const link = document.createElement('a')
      link.download = 'mermaid-diagram.png'
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export PNG failed:', err)
    }
  }

  const handleExportSvg = async () => {
    const svgElement = document.querySelector('.preview-container svg') as HTMLElement
    if (!svgElement) return

    try {
      const dataUrl = await toSvg(svgElement)
      const link = document.createElement('a')
      link.download = 'mermaid-diagram.svg'
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Export SVG failed:', err)
    }
  }

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const templateKey = e.target.value as keyof typeof TEMPLATES
    if (templateKey && TEMPLATES[templateKey]) {
      setCode(TEMPLATES[templateKey])
    }
  }

  const handleDirectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const direction = e.target.value as FlowDirection
    changeDirection(direction)
  }

  const handleAddNode = () => {
    const newId = getNextNodeId()
    // 添加一个独立节点
    const lines = code.split('\n')
    lines.push(`    ${newId}[新节点]`)
    setCode(lines.join('\n'))
  }

  const handleReset = () => {
    setCode(DEFAULT_CODE)
  }

  return (
    <div className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-gray-800">Mermaid 编辑器</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* 流程图方向（仅流程图时显示） */}
        {isFlowchart && (
          <select
            value={currentDirection}
            onChange={handleDirectionChange}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            {DIRECTIONS.map((dir) => (
              <option key={dir.value} value={dir.value}>
                {dir.icon} {dir.label}
              </option>
            ))}
          </select>
        )}

        {/* 添加节点（仅流程图时显示） */}
        {isFlowchart && (
          <button
            onClick={handleAddNode}
            className="rounded-md border border-green-500 bg-green-50 px-3 py-1.5 text-sm text-green-700 hover:bg-green-100"
          >
            + 新节点
          </button>
        )}

        {/* 模板选择 */}
        <select
          onChange={handleTemplateChange}
          defaultValue=""
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          <option value="" disabled>
            选择模板
          </option>
          <option value="flowchart">流程图</option>
          <option value="sequence">时序图</option>
          <option value="classDiagram">类图</option>
          <option value="stateDiagram">状态图</option>
          <option value="erDiagram">ER 图</option>
        </select>

        {/* 重置 */}
        <button
          onClick={handleReset}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          重置
        </button>

        {/* 复制代码 */}
        <button
          onClick={handleCopyCode}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          {copied ? '已复制!' : '复制代码'}
        </button>

        {/* 导出 PNG */}
        <button
          onClick={handleExportPng}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          导出 PNG
        </button>

        {/* 导出 SVG */}
        <button
          onClick={handleExportSvg}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          导出 SVG
        </button>
      </div>
    </div>
  )
}
