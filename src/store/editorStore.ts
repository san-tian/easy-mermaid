import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface NodeStyle {
  fill: string
  stroke: string
  strokeWidth: number
  color: string
  rx: number
}

export interface EdgeInfo {
  from: string
  to: string
  label: string
  arrowType: ArrowType
  lineIndex: number
}

export type NodeShape = 'rect' | 'round' | 'stadium' | 'diamond' | 'hexagon' | 'parallelogram' | 'circle'
export type FlowDirection = 'LR' | 'RL' | 'TB' | 'BT'
export type ArrowType = '-->' | '--->' | '-.->' | '==>'

export interface ParsedNode {
  id: string
  label: string
  shape: NodeShape
  lineIndex: number
}

// Mermaid default theme colors
const defaultNodeStyle: NodeStyle = {
  fill: '#ECECFF',
  stroke: '#9370DB',
  strokeWidth: 2,
  color: '#333333',
  rx: 5,
}

interface EditorState {
  code: string
  selectedNode: string | null
  selectedEdge: EdgeInfo | null
  nodeStyles: Record<string, NodeStyle>
  history: string[]
  historyIndex: number
  setCode: (code: string, skipHistory?: boolean) => void
  setSelectedNode: (nodeId: string | null) => void
  setSelectedEdge: (edge: EdgeInfo | null) => void
  updateNodeStyle: (nodeId: string, style: Partial<NodeStyle>) => void
  getNodeStyle: (nodeId: string) => NodeStyle
  updateEdgeLabel: (edge: EdgeInfo, newLabel: string) => void
  updateEdgeArrowType: (edge: EdgeInfo, arrowType: ArrowType) => void
  insertNode: (afterNodeId: string, newNodeId: string, newNodeLabel: string, shape?: NodeShape) => void
  updateNodeShape: (nodeId: string, shape: NodeShape) => void
  updateNodeLabel: (nodeId: string, newLabel: string) => void
  getNextNodeId: () => string
  getAllNodeIds: () => string[]
  getNodesWithLabels: () => Array<{ id: string; label: string }>
  changeDirection: (direction: FlowDirection) => void
  getDirection: () => FlowDirection
  addConnection: (from: string, to: string, label?: string, arrowType?: ArrowType) => void
  deleteNode: (nodeId: string) => void
  deleteEdge: (edge: EdgeInfo) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

const DEFAULT_CODE = `flowchart LR
    A[开始] --> B{判断}
    B -->|是| C[处理]
    B -->|否| D[结束]
    C --> D`

// 从代码中提取所有节点ID
function extractNodeIds(code: string): string[] {
  const ids = new Set<string>()
  // 匹配节点定义和引用
  const patterns = [
    /(\w+)[\[\(\{<]/g,  // 节点定义
    /--[>-].*?(\w+)/g,  // 箭头后的节点
    /(\w+)\s*--/g,      // 箭头前的节点
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(code)) !== null) {
      const id = match[1]
      if (id && /^[A-Za-z]\w*$/.test(id) && !['flowchart', 'graph', 'subgraph', 'end', 'style', 'classDef', 'class'].includes(id.toLowerCase())) {
        ids.add(id)
      }
    }
  }

  return Array.from(ids)
}

// 从代码中提取节点ID和标签
function extractNodesWithLabels(code: string): Array<{ id: string; label: string }> {
  const nodes: Array<{ id: string; label: string }> = []
  const seen = new Set<string>()

  // 定义括号对应关系
  const bracketPairs: Record<string, string> = {
    '[': ']',
    '(': ')',
    '{': '}',
    '([': '])',
    '[(': ')]',
    '((': '))',
    '{{': '}}',
    '[/': '/]',
    '[\\': '\\]',
    '>': ']',
  }

  // 匹配节点定义，捕获 ID 和开括号
  const nodeStartPattern = /(\w+)(\[\[|\(\[|\[\(|\(\(|\{\{|\[\/|\[\\|>|\[|\(|\{)/g
  let match
  while ((match = nodeStartPattern.exec(code)) !== null) {
    const id = match[1]
    const openBracket = match[2]
    const closeBracket = bracketPairs[openBracket]

    if (!closeBracket) continue
    if (seen.has(id)) continue
    if (!(/^[A-Za-z]\w*$/.test(id))) continue
    if (['flowchart', 'graph', 'subgraph', 'end', 'style', 'classDef', 'class'].includes(id.toLowerCase())) continue

    // 从开括号后开始找闭括号
    const startPos = match.index + match[0].length
    const closePos = code.indexOf(closeBracket, startPos)
    if (closePos === -1) continue

    const label = code.slice(startPos, closePos)
    seen.add(id)
    nodes.push({ id, label })
  }

  // 添加没有标签定义的节点（只在箭头中出现）
  const allIds = extractNodeIds(code)
  for (const id of allIds) {
    if (!seen.has(id)) {
      nodes.push({ id, label: id })
    }
  }

  return nodes
}

// 生成下一个可用的节点ID
function generateNextId(existingIds: string[]): string {
  const usedLetters = new Set(existingIds.map(id => id.charAt(0).toUpperCase()))

  // 先尝试单字母
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i) // A-Z
    if (!usedLetters.has(letter) && !existingIds.includes(letter)) {
      return letter
    }
  }

  // 如果单字母用完，用字母+数字
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i)
    for (let j = 1; j <= 99; j++) {
      const id = `${letter}${j}`
      if (!existingIds.includes(id)) {
        return id
      }
    }
  }

  return `N${Date.now()}`
}

const MAX_HISTORY = 50

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      code: DEFAULT_CODE,
      selectedNode: null,
      selectedEdge: null,
      nodeStyles: {},
      history: [DEFAULT_CODE],
      historyIndex: 0,

      setCode: (code: string, skipHistory = false) => {
        const state = get()
        if (skipHistory || code === state.code) {
          set({ code })
          return
        }
        // 截断当前位置之后的历史
        const newHistory = state.history.slice(0, state.historyIndex + 1)
        newHistory.push(code)
        // 限制历史记录数量
        if (newHistory.length > MAX_HISTORY) {
          newHistory.shift()
        }
        set({
          code,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        })
      },

      setSelectedNode: (nodeId: string | null) => set({ selectedNode: nodeId, selectedEdge: null }),

      setSelectedEdge: (edge: EdgeInfo | null) => set({ selectedEdge: edge, selectedNode: null }),

      updateNodeStyle: (nodeId: string, style: Partial<NodeStyle>) =>
        set((state) => ({
          nodeStyles: {
            ...state.nodeStyles,
            [nodeId]: {
              ...defaultNodeStyle,
              ...state.nodeStyles[nodeId],
              ...style,
            },
          },
        })),

      getNodeStyle: (nodeId: string) => {
        const state = get()
        return state.nodeStyles[nodeId] || defaultNodeStyle
      },

      getNextNodeId: () => {
        const state = get()
        const existingIds = extractNodeIds(state.code)
        return generateNextId(existingIds)
      },

      getAllNodeIds: () => {
        const state = get()
        return extractNodeIds(state.code)
      },

      getNodesWithLabels: () => {
        const state = get()
        return extractNodesWithLabels(state.code)
      },

      getDirection: () => {
        const state = get()
        const match = state.code.match(/flowchart\s+(LR|RL|TB|BT|TD)/i)
        return (match?.[1]?.toUpperCase() as FlowDirection) || 'LR'
      },

      changeDirection: (direction: FlowDirection) => {
        const state = get()
        const newCode = state.code.replace(
          /flowchart\s+(LR|RL|TB|BT|TD)/i,
          `flowchart ${direction}`
        )
        set({ code: newCode })
      },

      updateEdgeLabel: (edge: EdgeInfo, newLabel: string) => {
        const state = get()
        const lines = state.code.split('\n')
        const line = lines[edge.lineIndex]
        if (!line) return

        const arrowPattern = /(\s*)(\w+)(\s*)(-->|---->|-.->|-.--->|==>|=====>)(\|[^|]*\|)?(\s*)(\w+)/
        const match = line.match(arrowPattern)

        if (match) {
          const [, indent, from, space1, arrow, , space2, to] = match
          const newLabelPart = newLabel ? `|${newLabel}|` : ''
          lines[edge.lineIndex] = `${indent}${from}${space1}${arrow}${newLabelPart}${space2}${to}`
          set({ code: lines.join('\n') })
        }
      },

      updateEdgeArrowType: (edge: EdgeInfo, arrowType: ArrowType) => {
        const state = get()
        const lines = state.code.split('\n')
        const line = lines[edge.lineIndex]
        if (!line) return

        const arrowPattern = /(\s*)(\w+)(\s*)(-->|---->|-.->|-.--->|==>|=====>)(\|[^|]*\|)?(\s*)(\w+)/
        const match = line.match(arrowPattern)

        if (match) {
          const [, indent, from, space1, , labelPart, space2, to] = match
          const newLabelPart = labelPart || ''
          lines[edge.lineIndex] = `${indent}${from}${space1}${arrowType}${newLabelPart}${space2}${to}`
          set({ code: lines.join('\n') })
        }
      },

      insertNode: (afterNodeId: string, newNodeId: string, newNodeLabel: string, shape: NodeShape = 'rect') => {
        const state = get()
        const lines = state.code.split('\n')

        const shapeWrappers: Record<NodeShape, [string, string]> = {
          rect: ['[', ']'],
          round: ['(', ')'],
          stadium: ['([', '])'],
          diamond: ['{', '}'],
          hexagon: ['{{', '}}'],
          parallelogram: ['[/', '/]'],
          circle: ['((', '))'],
        }

        const [open, close] = shapeWrappers[shape]

        let insertIndex = -1
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(afterNodeId)) {
            insertIndex = i + 1
          }
        }

        if (insertIndex > 0) {
          const newLine = `    ${afterNodeId} --> ${newNodeId}${open}${newNodeLabel}${close}`
          lines.splice(insertIndex, 0, newLine)
          set({ code: lines.join('\n') })
        }
      },

      addConnection: (from: string, to: string, label?: string, arrowType: ArrowType = '-->') => {
        const state = get()
        const lines = state.code.split('\n')

        const labelPart = label ? `|${label}|` : ''
        const newLine = `    ${from} ${arrowType}${labelPart} ${to}`

        // 在最后一个非空行后添加
        let insertIndex = lines.length
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].trim()) {
            insertIndex = i + 1
            break
          }
        }

        lines.splice(insertIndex, 0, newLine)
        set({ code: lines.join('\n') })
      },

      deleteNode: (nodeId: string) => {
        const state = get()
        const lines = state.code.split('\n')

        const processedLines: string[] = []
        for (const line of lines) {
          const trimmed = line.trim()
          // 保留 flowchart 声明行
          if (trimmed.startsWith('flowchart') || trimmed.startsWith('graph')) {
            processedLines.push(line)
            continue
          }
          // 删除该节点的样式
          if (trimmed.startsWith(`style ${nodeId} `) || trimmed === `style ${nodeId}`) {
            continue
          }

          const nodePattern = new RegExp(`\\b${nodeId}\\b`)
          const hasArrow = line.includes('-->') || line.includes('-.->') || line.includes('==>')

          if (nodePattern.test(line) && hasArrow) {
            // 处理 & 并联语法: A & B & C --> D 或 A --> B & C & D
            // 匹配箭头前后的节点组
            const arrowMatch = line.match(/^(\s*)(.*?)\s*(-->|---->|-.->|-.--->|==>|=====>)(\|[^|]*\|)?\s*(.*)$/)
            if (arrowMatch) {
              const [, indent, leftPart, arrow, label, rightPart] = arrowMatch
              const labelStr = label || ''

              // 分割左右两边的节点（按 & 分割）
              const leftNodes = leftPart.split('&').map(n => n.trim()).filter(n => n)
              const rightNodes = rightPart.split('&').map(n => n.trim()).filter(n => n)

              // 从左右两边移除目标节点
              const newLeftNodes = leftNodes.filter(n => !new RegExp(`^${nodeId}(?:[\\[\\(\\{/<]|$)`).test(n) && n !== nodeId)
              const newRightNodes = rightNodes.filter(n => !new RegExp(`^${nodeId}(?:[\\[\\(\\{/<]|$)`).test(n) && n !== nodeId)

              // 如果两边都还有节点，保留这行
              if (newLeftNodes.length > 0 && newRightNodes.length > 0) {
                const newLine = `${indent}${newLeftNodes.join(' & ')} ${arrow}${labelStr} ${newRightNodes.join(' & ')}`
                processedLines.push(newLine)
              }
              // 否则删除整行
              continue
            }
          }

          // 不包含该节点的行，保留
          processedLines.push(line)
        }

        const newCode = processedLines.join('\n')
        // 保存历史
        const newHistory = state.history.slice(0, state.historyIndex + 1)
        newHistory.push(newCode)
        if (newHistory.length > MAX_HISTORY) {
          newHistory.shift()
        }
        set({
          code: newCode,
          selectedNode: null,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        })
      },

      deleteEdge: (edge: EdgeInfo) => {
        const state = get()
        const lines = state.code.split('\n')

        if (edge.lineIndex >= 0 && edge.lineIndex < lines.length) {
          lines.splice(edge.lineIndex, 1)
          const newCode = lines.join('\n')
          // 保存历史
          const newHistory = state.history.slice(0, state.historyIndex + 1)
          newHistory.push(newCode)
          if (newHistory.length > MAX_HISTORY) {
            newHistory.shift()
          }
          set({
            code: newCode,
            selectedEdge: null,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          })
        }
      },

      undo: () => {
        const state = get()
        if (state.historyIndex > 0) {
          const newIndex = state.historyIndex - 1
          set({
            code: state.history[newIndex],
            historyIndex: newIndex,
          })
        }
      },

      redo: () => {
        const state = get()
        if (state.historyIndex < state.history.length - 1) {
          const newIndex = state.historyIndex + 1
          set({
            code: state.history[newIndex],
            historyIndex: newIndex,
          })
        }
      },

      canUndo: () => {
        const state = get()
        return state.historyIndex > 0
      },

      canRedo: () => {
        const state = get()
        return state.historyIndex < state.history.length - 1
      },

      updateNodeShape: (nodeId: string, shape: NodeShape) => {
        const state = get()
        const lines = state.code.split('\n')

        const shapeWrappers: Record<NodeShape, [string, string]> = {
          rect: ['[', ']'],
          round: ['(', ')'],
          stadium: ['([', '])'],
          diamond: ['{', '}'],
          hexagon: ['{{', '}}'],
          parallelogram: ['[/', '/]'],
          circle: ['((', '))'],
        }

        const [open, close] = shapeWrappers[shape]
        const nodePattern = new RegExp(`(${nodeId})([\\[\\(\\{/<]+)([^\\]\\)\\}>]+)([\\]\\)\\}/>]+)`)

        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(nodePattern)
          if (match) {
            const label = match[3]
            lines[i] = lines[i].replace(nodePattern, `$1${open}${label}${close}`)
            break
          }
        }

        set({ code: lines.join('\n') })
      },

      updateNodeLabel: (nodeId: string, newLabel: string) => {
        const state = get()
        const lines = state.code.split('\n')
        const nodePattern = new RegExp(`(${nodeId})([\\[\\(\\{/<]+)([^\\]\\)\\}>]+)([\\]\\)\\}/>]+)`)

        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(nodePattern)
          if (match) {
            const openBracket = match[2]
            const closeBracket = match[4]
            lines[i] = lines[i].replace(nodePattern, `$1${openBracket}${newLabel}${closeBracket}`)
            break
          }
        }

        set({ code: lines.join('\n') })
      },
    }),
    {
      name: 'mermaid-editor-storage',
      partialize: (state) => ({ code: state.code, nodeStyles: state.nodeStyles }),
    }
  )
)

export { DEFAULT_CODE, defaultNodeStyle }
