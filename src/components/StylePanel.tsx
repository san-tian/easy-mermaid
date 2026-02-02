import { useEffect, useState } from 'react'
import {
  useEditorStore,
  type NodeStyle,
  type NodeShape,
  type ArrowType,
  defaultNodeStyle,
} from '../store/editorStore'
import { updateStyleInCode } from '../utils/styleParser'

const NODE_SHAPES: { value: NodeShape; label: string; example: string }[] = [
  { value: 'rect', label: '矩形', example: '[text]' },
  { value: 'round', label: '圆角', example: '(text)' },
  { value: 'stadium', label: '体育场', example: '([text])' },
  { value: 'diamond', label: '菱形', example: '{text}' },
  { value: 'hexagon', label: '六边形', example: '{{text}}' },
  { value: 'circle', label: '圆形', example: '((text))' },
  { value: 'parallelogram', label: '平行四边形', example: '[/text/]' },
]

const ARROW_TYPES: { value: ArrowType; label: string }[] = [
  { value: '-->', label: '实线箭头 →' },
  { value: '--->', label: '长实线 ──→' },
  { value: '-.->', label: '虚线箭头 ┄→' },
  { value: '==>', label: '粗线箭头 ⇒' },
]

export function StylePanel() {
  const {
    selectedNode,
    selectedEdge,
    code,
    setCode,
    nodeStyles,
    updateNodeStyle,
    getNodeStyle,
    setSelectedNode,
    setSelectedEdge,
    updateEdgeLabel,
    updateEdgeArrowType,
    updateNodeShape,
    updateNodeLabel,
    insertNode,
    addConnection,
    deleteNode,
    deleteEdge,
    getNextNodeId,
    getNodesWithLabels,
  } = useEditorStore()

  const [localStyle, setLocalStyle] = useState<NodeStyle>(defaultNodeStyle)
  const [edgeLabelInput, setEdgeLabelInput] = useState('')
  const [edgeArrowType, setEdgeArrowType] = useState<ArrowType>('-->')
  const [nodeLabelInput, setNodeLabelInput] = useState('')
  const [newNodeId, setNewNodeId] = useState('')
  const [newNodeLabel, setNewNodeLabel] = useState('')
  const [newNodeShape, setNewNodeShape] = useState<NodeShape>('rect')

  // 新连接状态
  const [connectionTarget, setConnectionTarget] = useState('')
  const [connectionLabel, setConnectionLabel] = useState('')
  const [connectionArrow, setConnectionArrow] = useState<ArrowType>('-->')

  const nodesWithLabels = getNodesWithLabels()

  useEffect(() => {
    if (selectedNode) {
      setLocalStyle(getNodeStyle(selectedNode))
      // 使用更精确的括号匹配来提取标签
      const bracketPairs: Record<string, string> = {
        '[': ']', '(': ')', '{': '}',
        '([': '])', '[(': ')]', '((': '))', '{{': '}}',
        '[/': '/]', '[\\': '\\]', '>': ']',
      }
      const nodeStartPattern = new RegExp(`${selectedNode}(\\[\\[|\\(\\[|\\[\\(|\\(\\(|\\{\\{|\\[\\/|\\[\\\\|>|\\[|\\(|\\{)`)
      const match = code.match(nodeStartPattern)
      if (match) {
        const openBracket = match[1]
        const closeBracket = bracketPairs[openBracket]
        if (closeBracket) {
          const startPos = match.index! + match[0].length
          const closePos = code.indexOf(closeBracket, startPos)
          if (closePos !== -1) {
            setNodeLabelInput(code.slice(startPos, closePos))
          }
        }
      }
      // 设置默认的新节点ID
      setNewNodeId(getNextNodeId())
      setNewNodeLabel('新节点')
    }
  }, [selectedNode, getNodeStyle, nodeStyles, code, getNextNodeId])

  useEffect(() => {
    if (selectedEdge) {
      setEdgeLabelInput(selectedEdge.label)
      setEdgeArrowType(selectedEdge.arrowType)
    }
  }, [selectedEdge])

  const handleStyleChange = (key: keyof NodeStyle, value: string | number) => {
    if (!selectedNode) return

    const newStyle = { ...localStyle, [key]: value }
    setLocalStyle(newStyle)
    updateNodeStyle(selectedNode, { [key]: value })

    const updatedCode = updateStyleInCode(code, selectedNode, newStyle)
    setCode(updatedCode)
  }

  const handleEdgeLabelSave = () => {
    if (selectedEdge) {
      updateEdgeLabel(selectedEdge, edgeLabelInput)
    }
  }

  const handleEdgeArrowTypeChange = (arrowType: ArrowType) => {
    if (selectedEdge) {
      setEdgeArrowType(arrowType)
      updateEdgeArrowType(selectedEdge, arrowType)
    }
  }

  const handleNodeLabelSave = () => {
    if (selectedNode && nodeLabelInput) {
      updateNodeLabel(selectedNode, nodeLabelInput)
    }
  }

  const handleShapeChange = (shape: NodeShape) => {
    if (selectedNode) {
      updateNodeShape(selectedNode, shape)
    }
  }

  const handleInsertNode = () => {
    if (selectedNode && newNodeId && newNodeLabel) {
      insertNode(selectedNode, newNodeId, newNodeLabel, newNodeShape)
      setNewNodeId(getNextNodeId())
      setNewNodeLabel('新节点')
    }
  }

  const handleAddConnection = () => {
    if (selectedNode && connectionTarget) {
      addConnection(selectedNode, connectionTarget, connectionLabel || undefined, connectionArrow)
      setConnectionTarget('')
      setConnectionLabel('')
    }
  }

  const handleDeleteNode = () => {
    if (selectedNode && confirm(`确定删除节点 ${selectedNode} 及其所有连接吗？`)) {
      deleteNode(selectedNode)
    }
  }

  const handleDeleteEdge = () => {
    if (selectedEdge && confirm('确定删除这条连接吗？')) {
      deleteEdge(selectedEdge)
    }
  }

  const handleClose = () => {
    setSelectedNode(null)
    setSelectedEdge(null)
  }

  // 边编辑面板
  if (selectedEdge) {
    return (
      <div className="h-full w-64 overflow-y-auto border-l border-gray-200 bg-white p-4">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900">编辑连线</h3>
          <p className="text-sm text-gray-500">
            {selectedEdge.from} → {selectedEdge.to}
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">线条样式</label>
            <select
              value={edgeArrowType}
              onChange={(e) => handleEdgeArrowTypeChange(e.target.value as ArrowType)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {ARROW_TYPES.map((arrow) => (
                <option key={arrow.value} value={arrow.value}>
                  {arrow.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">标签文字</label>
            <input
              type="text"
              value={edgeLabelInput}
              onChange={(e) => setEdgeLabelInput(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="输入标签文字（可留空）"
            />
          </div>

          <button
            onClick={handleEdgeLabelSave}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            保存标签
          </button>

          <hr className="border-gray-200" />

          <button
            onClick={handleDeleteEdge}
            className="w-full rounded-md bg-red-50 px-4 py-2 text-sm text-red-600 hover:bg-red-100"
          >
            删除连接
          </button>
        </div>

        <button
          onClick={handleClose}
          className="mt-6 w-full rounded-md bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
        >
          关闭面板
        </button>
      </div>
    )
  }

  // 未选中任何内容
  if (!selectedNode) {
    return (
      <div className="h-full w-64 border-l border-gray-200 bg-white p-4">
        <p className="text-sm text-gray-500">点击图表中的节点或连线标签以编辑</p>
        <div className="mt-4 text-xs text-gray-400">
          <p className="font-medium mb-2">快捷提示:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>点击节点可编辑样式</li>
            <li>点击连线标签可编辑文字</li>
            <li>工具栏可切换方向</li>
            <li>工具栏可添加新节点</li>
          </ul>
        </div>
      </div>
    )
  }

  // 节点编辑面板
  return (
    <div className="h-full w-64 overflow-y-auto border-l border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">节点编辑</h3>
          <p className="text-sm text-gray-500">节点: {selectedNode}</p>
        </div>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* 节点标签 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">节点文字</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nodeLabelInput}
              onChange={(e) => setNodeLabelInput(e.target.value)}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
            <button
              onClick={handleNodeLabelSave}
              className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              保存
            </button>
          </div>
        </div>

        {/* 节点形状 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">节点形状</label>
          <div className="grid grid-cols-2 gap-1">
            {NODE_SHAPES.map((shape) => (
              <button
                key={shape.value}
                onClick={() => handleShapeChange(shape.value)}
                className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100"
                title={shape.example}
              >
                {shape.label}
              </button>
            ))}
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* 样式编辑 */}
        <details open>
          <summary className="cursor-pointer text-sm font-medium text-gray-700">样式</summary>
          <div className="mt-2 space-y-3">
            {/* 填充颜色 */}
            <div>
              <label className="mb-1 block text-xs text-gray-600">填充颜色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={localStyle.fill}
                  onChange={(e) => handleStyleChange('fill', e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={localStyle.fill}
                  onChange={(e) => handleStyleChange('fill', e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
            </div>

            {/* 边框颜色 */}
            <div>
              <label className="mb-1 block text-xs text-gray-600">边框颜色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={localStyle.stroke}
                  onChange={(e) => handleStyleChange('stroke', e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={localStyle.stroke}
                  onChange={(e) => handleStyleChange('stroke', e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
            </div>

            {/* 边框宽度 */}
            <div>
              <label className="mb-1 block text-xs text-gray-600">边框宽度: {localStyle.strokeWidth}px</label>
              <input
                type="range"
                min="1"
                max="10"
                value={localStyle.strokeWidth}
                onChange={(e) => handleStyleChange('strokeWidth', parseInt(e.target.value, 10))}
                className="w-full"
              />
            </div>

            {/* 字体颜色 */}
            <div>
              <label className="mb-1 block text-xs text-gray-600">字体颜色</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={localStyle.color}
                  onChange={(e) => handleStyleChange('color', e.target.value)}
                  className="h-7 w-7 cursor-pointer rounded border border-gray-300"
                />
                <input
                  type="text"
                  value={localStyle.color}
                  onChange={(e) => handleStyleChange('color', e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
                />
              </div>
            </div>
          </div>
        </details>

        <hr className="border-gray-200" />

        {/* 添加连接 */}
        <details>
          <summary className="cursor-pointer text-sm font-medium text-gray-700">添加连接</summary>
          <div className="mt-2 space-y-2">
            <div>
              <label className="mb-1 block text-xs text-gray-600">目标节点</label>
              <select
                value={connectionTarget}
                onChange={(e) => setConnectionTarget(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">选择目标节点</option>
                {nodesWithLabels
                  .filter((node) => node.id !== selectedNode)
                  .map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.id} - {node.label}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">箭头类型</label>
              <select
                value={connectionArrow}
                onChange={(e) => setConnectionArrow(e.target.value as ArrowType)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                {ARROW_TYPES.map((arrow) => (
                  <option key={arrow.value} value={arrow.value}>
                    {arrow.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">标签（可选）</label>
              <input
                type="text"
                value={connectionLabel}
                onChange={(e) => setConnectionLabel(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="连接标签"
              />
            </div>
            <button
              onClick={handleAddConnection}
              disabled={!connectionTarget}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              添加连接到 {connectionTarget || '...'}
            </button>
          </div>
        </details>

        <hr className="border-gray-200" />

        {/* 插入新节点 */}
        <details>
          <summary className="cursor-pointer text-sm font-medium text-gray-700">插入新节点</summary>
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <div className="w-16">
                <label className="mb-1 block text-xs text-gray-600">ID</label>
                <input
                  type="text"
                  value={newNodeId}
                  onChange={(e) => setNewNodeId(e.target.value.toUpperCase())}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-600">文字</label>
                <input
                  type="text"
                  value={newNodeLabel}
                  onChange={(e) => setNewNodeLabel(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">形状</label>
              <select
                value={newNodeShape}
                onChange={(e) => setNewNodeShape(e.target.value as NodeShape)}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                {NODE_SHAPES.map((shape) => (
                  <option key={shape.value} value={shape.value}>
                    {shape.label} {shape.example}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleInsertNode}
              disabled={!newNodeId || !newNodeLabel}
              className="w-full rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:bg-gray-300"
            >
              在 {selectedNode} 后插入 {newNodeId}
            </button>
          </div>
        </details>

        <hr className="border-gray-200" />

        {/* 删除节点 */}
        <button
          onClick={handleDeleteNode}
          className="w-full rounded-md bg-red-50 px-4 py-2 text-sm text-red-600 hover:bg-red-100"
        >
          删除节点 {selectedNode}
        </button>
      </div>
    </div>
  )
}
