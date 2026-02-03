import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditorStore, type EdgeInfo, type SubgraphInfo } from '../store/editorStore'
import { renderMermaid } from '../utils/mermaid'
import { extractNodeIdFromSvg, parseEdges } from '../utils/styleParser'

export function Preview() {
  const { code, selectedNode, selectedEdge, selectedSubgraph, setSelectedNode, setSelectedEdge, setSelectedSubgraph, parseSubgraphs } = useEditorStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [renderKey, setRenderKey] = useState(0)
  const edgesRef = useRef<EdgeInfo[]>([])
  const subgraphsRef = useRef<SubgraphInfo[]>([])

  // 缩放和平移状态
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const MIN_SCALE = 0.1
  const MAX_SCALE = 10

  // 解析边信息
  useEffect(() => {
    edgesRef.current = parseEdges(code)
    subgraphsRef.current = parseSubgraphs()
  }, [code, parseSubgraphs])

  const handleNodeClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      const target = event.target as Element
      const nodeElement = target.closest('.node')
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('id')
        if (nodeId) {
          const extractedId = extractNodeIdFromSvg(nodeId)
          if (extractedId) {
            setSelectedNode(extractedId)
          }
        }
      }
    },
    [setSelectedNode]
  )

  const findEdgeByElement = useCallback((element: Element): EdgeInfo | null => {
    const edgeGroup = element.closest('.edge-pattern, .flowchart-link, [class*="edge"], g')
    if (!edgeGroup) return null

    const id = edgeGroup.getAttribute('id') || edgeGroup.className?.toString() || ''

    for (const edge of edgesRef.current) {
      if (id.includes(edge.from) && id.includes(edge.to)) {
        return edge
      }
    }

    const container = containerRef.current
    if (!container) return null

    const allEdgePaths = container.querySelectorAll('.edgePath, .flowchart-link, [class*="edge-"]')
    const clickedIndex = Array.from(allEdgePaths).findIndex(
      (path) => path === edgeGroup || path.contains(element)
    )

    if (clickedIndex >= 0 && clickedIndex < edgesRef.current.length) {
      return edgesRef.current[clickedIndex]
    }

    return null
  }, [])

  const handleEdgeClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      const target = event.target as Element

      const labelElement = target.closest('.edgeLabel')
      if (labelElement) {
        const textContent = labelElement.textContent?.trim() || ''
        const edge = edgesRef.current.find((e) => e.label === textContent)
        if (edge) {
          setSelectedEdge(edge)
          return
        }
      }

      const edge = findEdgeByElement(target)
      if (edge) {
        setSelectedEdge(edge)
      }
    },
    [setSelectedEdge, findEdgeByElement]
  )

  const findSubgraphByElement = useCallback((element: Element): SubgraphInfo | null => {
    const cluster = element.closest('.cluster')
    if (!cluster) return null

    const clusterId = cluster.getAttribute('id') || ''
    // Mermaid generates cluster IDs like "flowchart-subgraphId-xxx"
    for (const subgraph of subgraphsRef.current) {
      if (clusterId.includes(subgraph.id)) {
        return subgraph
      }
    }
    return null
  }, [])

  const handleSubgraphClick = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation()
      const target = event.target as Element
      const subgraph = findSubgraphByElement(target)
      if (subgraph) {
        setSelectedSubgraph(subgraph)
      }
    },
    [setSelectedSubgraph, findSubgraphByElement]
  )

  // 拖动处理
  const dragStartPos = useRef({ x: 0, y: 0 })

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
      dragStartPos.current = { x: e.clientX, y: e.clientY }
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  // 滚轮缩放
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const delta = e.deltaY > 0 ? -0.1 : 0.1
        setScale((prev) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev + delta)))
      }
    },
    []
  )

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    wrapper.addEventListener('wheel', handleWheel, { passive: false })
    return () => wrapper.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const render = async () => {
      try {
        setError(null)
        const uniqueId = `mermaid-${Date.now()}-${renderKey}`
        const { svg } = await renderMermaid(code, uniqueId)
        container.innerHTML = svg

        const svgElement = container.querySelector('svg')
        if (svgElement) {
          svgElement.style.maxWidth = 'none'
          svgElement.style.height = 'auto'

          const nodes = svgElement.querySelectorAll('.node')
          nodes.forEach((node) => {
            ;(node as HTMLElement).style.cursor = 'pointer'
            node.addEventListener('click', handleNodeClick as EventListener)
          })

          const edgeLabels = svgElement.querySelectorAll('.edgeLabel')
          edgeLabels.forEach((label) => {
            ;(label as HTMLElement).style.cursor = 'pointer'
            label.addEventListener('click', handleEdgeClick as EventListener)
          })

          const edgePaths = svgElement.querySelectorAll('.edgePath, .flowchart-link')
          edgePaths.forEach((path) => {
            ;(path as HTMLElement).style.cursor = 'pointer'
            const pathElement = path.querySelector('path')
            if (pathElement) {
              pathElement.style.strokeWidth = '20'
              pathElement.style.stroke = 'transparent'
              pathElement.style.fill = 'none'
              pathElement.style.pointerEvents = 'stroke'
            }
            path.addEventListener('click', handleEdgeClick as EventListener)
          })

          // Add click handlers for subgraphs (clusters)
          const clusters = svgElement.querySelectorAll('.cluster')
          clusters.forEach((cluster) => {
            ;(cluster as HTMLElement).style.cursor = 'pointer'
            cluster.addEventListener('click', handleSubgraphClick as EventListener)
          })
        }

        setRenderKey((k) => k + 1)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Render failed')
      }
    }

    const debounce = setTimeout(render, 300)
    return () => clearTimeout(debounce)
  }, [code, handleNodeClick, handleEdgeClick, handleSubgraphClick])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const nodes = container.querySelectorAll('.node')
    nodes.forEach((node) => {
      const nodeId = node.getAttribute('id')
      const extractedId = nodeId ? extractNodeIdFromSvg(nodeId) : null
      const rect = node.querySelector('rect, polygon, circle, ellipse, path')

      if (rect) {
        if (extractedId === selectedNode) {
          ;(rect as HTMLElement).style.outline = '3px solid #3b82f6'
          ;(rect as HTMLElement).style.outlineOffset = '2px'
        } else {
          ;(rect as HTMLElement).style.outline = 'none'
        }
      }
    })

    const edgePaths = container.querySelectorAll('.edgePath, .flowchart-link')
    edgePaths.forEach((path, index) => {
      const pathElement = path.querySelector('path.path') as HTMLElement
      if (pathElement && selectedEdge && index < edgesRef.current.length) {
        const edge = edgesRef.current[index]
        if (edge.lineIndex === selectedEdge.lineIndex) {
          pathElement.style.stroke = '#3b82f6'
          pathElement.style.strokeWidth = '3'
        }
      }
    })

    const edgeLabels = container.querySelectorAll('.edgeLabel')
    edgeLabels.forEach((label) => {
      const textContent = label.textContent?.trim() || ''
      const isSelected = selectedEdge && selectedEdge.label === textContent && textContent !== ''

      if (isSelected) {
        ;(label as HTMLElement).style.outline = '2px solid #3b82f6'
        ;(label as HTMLElement).style.outlineOffset = '2px'
        ;(label as HTMLElement).style.borderRadius = '4px'
      } else {
        ;(label as HTMLElement).style.outline = 'none'
      }
    })

    // Highlight selected subgraph
    const clusters = container.querySelectorAll('.cluster')
    clusters.forEach((cluster) => {
      const clusterId = cluster.getAttribute('id') || ''
      const isSelected = selectedSubgraph && clusterId.includes(selectedSubgraph.id)
      const clusterRect = cluster.querySelector('rect') as SVGRectElement | null

      if (clusterRect) {
        if (isSelected) {
          clusterRect.style.outline = '3px solid #3b82f6'
          clusterRect.style.outlineOffset = '2px'
        } else {
          clusterRect.style.outline = 'none'
        }
      }
    })
  }, [selectedNode, selectedEdge, selectedSubgraph, renderKey])

  const handleContainerClick = (e: React.MouseEvent) => {
    // 如果拖动距离超过 5px，视为拖动而非点击
    const dx = Math.abs(e.clientX - dragStartPos.current.x)
    const dy = Math.abs(e.clientY - dragStartPos.current.y)
    if (dx > 5 || dy > 5) return

    const target = e.target as Element
    if (
      !target.closest('.node') &&
      !target.closest('.edgeLabel') &&
      !target.closest('.edgePath') &&
      !target.closest('.flowchart-link') &&
      !target.closest('.cluster')
    ) {
      setSelectedNode(null)
      setSelectedEdge(null)
      setSelectedSubgraph(null)
    }
  }

  const zoomIn = () => setScale((prev) => Math.min(MAX_SCALE, prev + 0.25))
  const zoomOut = () => setScale((prev) => Math.max(MIN_SCALE, prev - 0.25))
  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-gray-50">
      {/* 缩放控制条 */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 shadow-sm border border-gray-200">
        <button
          onClick={zoomOut}
          className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 rounded"
          title="缩小"
        >
          −
        </button>
        <button
          onClick={resetZoom}
          className="px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded min-w-[48px]"
          title="重置缩放"
        >
          {Math.round(scale * 100)}%
        </button>
        <button
          onClick={zoomIn}
          className="px-2 py-0.5 text-gray-600 hover:bg-gray-100 rounded"
          title="放大"
        >
          +
        </button>
      </div>

      {/* 预览区域 */}
      <div
        ref={wrapperRef}
        className="h-full w-full overflow-hidden p-4"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-600">
            <p className="font-medium">渲染错误</p>
            <pre className="mt-2 text-sm whitespace-pre-wrap">{error}</pre>
          </div>
        ) : (
          <div
            className="inline-block"
            style={{
              transform: `translate(${position.x}px, ${position.y}px)`,
            }}
          >
            <div
              ref={containerRef}
              className="origin-top-left"
              style={{ transform: `scale(${scale})` }}
              onClick={handleContainerClick}
            />
          </div>
        )}
      </div>

      {/* 缩放提示 */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-400">
        拖动平移 · Ctrl + 滚轮缩放
      </div>
    </div>
  )
}
