import { useCallback, useRef, useState, useEffect } from 'react'

interface ResizableProps {
  leftChild: React.ReactNode
  rightChild: React.ReactNode
  rightPanel: React.ReactNode
  defaultLeftWidth?: number
  minLeftWidth?: number
  maxLeftWidth?: number
  rightPanelWidth?: number
}

export function ResizableLayout({
  leftChild,
  rightChild,
  rightPanel,
  defaultLeftWidth = 50,
  minLeftWidth = 20,
  maxLeftWidth = 70,
  rightPanelWidth = 256,
}: ResizableProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return

      const containerRect = containerRef.current.getBoundingClientRect()
      const containerWidth = containerRect.width - rightPanelWidth
      const newLeftWidth = ((e.clientX - containerRect.left) / containerWidth) * 100

      setLeftWidth(Math.min(maxLeftWidth, Math.max(minLeftWidth, newLeftWidth)))
    },
    [isDragging, minLeftWidth, maxLeftWidth, rightPanelWidth]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* 左侧面板 */}
      <div
        style={{ width: `calc((100% - ${rightPanelWidth}px) * ${leftWidth / 100})` }}
        className="min-w-[200px] overflow-hidden"
      >
        {leftChild}
      </div>

      {/* 分割条 */}
      <div
        onMouseDown={handleMouseDown}
        className={`
          w-1 flex-shrink-0 cursor-col-resize bg-gray-200 hover:bg-blue-400
          transition-colors duration-150 relative group
          ${isDragging ? 'bg-blue-500' : ''}
        `}
      >
        {/* 拖拽指示器 */}
        <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-blue-400/20" />
      </div>

      {/* 右侧预览区 */}
      <div
        style={{ width: `calc((100% - ${rightPanelWidth}px) * ${(100 - leftWidth) / 100})` }}
        className="preview-container min-w-[200px] overflow-hidden"
      >
        {rightChild}
      </div>

      {/* 样式面板 */}
      <div style={{ width: rightPanelWidth }} className="flex-shrink-0">
        {rightPanel}
      </div>
    </div>
  )
}
