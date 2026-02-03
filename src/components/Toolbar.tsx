import { useState, useRef, useEffect } from 'react'
import { toSvg } from 'html-to-image'
import { jsPDF } from 'jspdf'
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
  const [showPngMenu, setShowPngMenu] = useState(false)
  const pngMenuRef = useRef<HTMLDivElement>(null)

  const currentDirection = getDirection()
  const isFlowchart = code.trim().startsWith('flowchart')

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pngMenuRef.current && !pngMenuRef.current.contains(e.target as Node)) {
        setShowPngMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExportPng = async (pixelRatio: number) => {
    const svgElement = document.querySelector('.preview-container svg') as SVGSVGElement
    if (!svgElement) return

    try {
      // 克隆 SVG 以避免修改原始元素
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement

      // 获取 SVG 的实际尺寸
      const bbox = svgElement.getBBox()
      const svgWidth = bbox.width + bbox.x * 2 || svgElement.clientWidth || 800
      const svgHeight = bbox.height + bbox.y * 2 || svgElement.clientHeight || 600

      // 设置 SVG 的 viewBox 和尺寸
      clonedSvg.setAttribute('width', String(svgWidth))
      clonedSvg.setAttribute('height', String(svgHeight))
      if (!clonedSvg.getAttribute('viewBox')) {
        clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
      }

      // 添加白色背景
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bgRect.setAttribute('width', '100%')
      bgRect.setAttribute('height', '100%')
      bgRect.setAttribute('fill', '#ffffff')
      clonedSvg.insertBefore(bgRect, clonedSvg.firstChild)

      // 内联所有样式以避免跨域问题
      const styleSheets = document.styleSheets
      let cssText = ''
      for (let i = 0; i < styleSheets.length; i++) {
        try {
          const rules = styleSheets[i].cssRules
          for (let j = 0; j < rules.length; j++) {
            cssText += rules[j].cssText + '\n'
          }
        } catch {
          // 跨域样式表会抛出错误，忽略
        }
      }
      const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      styleElement.textContent = cssText
      clonedSvg.insertBefore(styleElement, clonedSvg.firstChild)

      // 序列化 SVG
      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(clonedSvg)
      const svgBase64 = btoa(unescape(encodeURIComponent(svgString)))
      const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`

      // 创建高分辨率 canvas
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const img = new Image()
      img.onload = () => {
        canvas.width = svgWidth * pixelRatio
        canvas.height = svgHeight * pixelRatio

        // 使用高质量缩放
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((blob) => {
          if (blob) {
            const link = document.createElement('a')
            link.download = `mermaid-diagram-${pixelRatio}x.png`
            link.href = URL.createObjectURL(blob)
            link.click()
            URL.revokeObjectURL(link.href)
          }
        }, 'image/png', 1.0)
      }
      img.onerror = (err) => {
        console.error('Image load failed:', err)
      }
      img.src = svgDataUrl
      setShowPngMenu(false)
    } catch (err) {
      console.error('Export PNG failed:', err)
    }
  }

  const handleExportPdf = async () => {
    const svgElement = document.querySelector('.preview-container svg') as SVGSVGElement
    if (!svgElement) return

    try {
      // 克隆 SVG 以避免修改原始元素
      const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement

      // 获取 SVG 的实际尺寸
      const bbox = svgElement.getBBox()
      const svgWidth = bbox.width + bbox.x * 2 || svgElement.clientWidth || 800
      const svgHeight = bbox.height + bbox.y * 2 || svgElement.clientHeight || 600

      // 设置 SVG 的 viewBox 和尺寸
      clonedSvg.setAttribute('width', String(svgWidth))
      clonedSvg.setAttribute('height', String(svgHeight))
      if (!clonedSvg.getAttribute('viewBox')) {
        clonedSvg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
      }

      // 添加白色背景
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
      bgRect.setAttribute('width', '100%')
      bgRect.setAttribute('height', '100%')
      bgRect.setAttribute('fill', '#ffffff')
      clonedSvg.insertBefore(bgRect, clonedSvg.firstChild)

      // 内联所有样式以避免跨域问题
      const styleSheets = document.styleSheets
      let cssText = ''
      for (let i = 0; i < styleSheets.length; i++) {
        try {
          const rules = styleSheets[i].cssRules
          for (let j = 0; j < rules.length; j++) {
            cssText += rules[j].cssText + '\n'
          }
        } catch {
          // 跨域样式表会抛出错误，忽略
        }
      }
      const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style')
      styleElement.textContent = cssText
      clonedSvg.insertBefore(styleElement, clonedSvg.firstChild)

      // 序列化 SVG 为 base64 data URL
      const serializer = new XMLSerializer()
      const svgString = serializer.serializeToString(clonedSvg)
      const svgBase64 = btoa(unescape(encodeURIComponent(svgString)))
      const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`

      // 使用高分辨率 (4x) 渲染
      const pixelRatio = 4
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const img = new Image()
      img.onload = () => {
        canvas.width = svgWidth * pixelRatio
        canvas.height = svgHeight * pixelRatio

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const dataUrl = canvas.toDataURL('image/png', 1.0)

        // 根据图片比例决定PDF方向
        const isLandscape = svgWidth > svgHeight
        const pdf = new jsPDF({
          orientation: isLandscape ? 'landscape' : 'portrait',
          unit: 'pt',
        })

        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const margin = 40

        // 计算缩放比例，使图片适应页面
        const maxWidth = pageWidth - margin * 2
        const maxHeight = pageHeight - margin * 2
        const scale = Math.min(maxWidth / svgWidth, maxHeight / svgHeight)

        const finalWidth = svgWidth * scale
        const finalHeight = svgHeight * scale
        const x = (pageWidth - finalWidth) / 2
        const y = (pageHeight - finalHeight) / 2

        pdf.addImage(dataUrl, 'PNG', x, y, finalWidth, finalHeight)
        pdf.save('mermaid-diagram.pdf')
      }
      img.onerror = (err) => {
        console.error('PDF image load failed:', err)
      }
      img.src = svgDataUrl
    } catch (err) {
      console.error('Export PDF failed:', err)
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
        <a
          href="https://github.com/san-tian/easy-mermaid"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-gray-500 hover:text-gray-800"
          title="GitHub"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="currentColor"
          >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </a>
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
        <div ref={pngMenuRef} className="relative">
          <button
            onClick={() => setShowPngMenu((v) => !v)}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            导出 PNG ▾
          </button>
          {showPngMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
              {[
                { ratio: 1, label: '1x 标准' },
                { ratio: 2, label: '2x 清晰' },
                { ratio: 3, label: '3x 高清' },
                { ratio: 4, label: '4x 超清' },
              ].map(({ ratio, label }) => (
                <button
                  key={ratio}
                  onClick={() => handleExportPng(ratio)}
                  className="block w-full px-4 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 导出 PDF */}
        <button
          onClick={handleExportPdf}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          导出 PDF
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
