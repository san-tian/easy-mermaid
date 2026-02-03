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

export interface SubgraphInfo {
  id: string
  title: string
  nodes: string[]
  lineStart: number
  lineEnd: number
}

export interface SubgraphStyle {
  fill: string
  stroke: string
  strokeWidth: number
  color: string
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
  selectedSubgraph: SubgraphInfo | null
  nodeStyles: Record<string, NodeStyle>
  subgraphStyles: Record<string, SubgraphStyle>
  history: string[]
  historyIndex: number
  setCode: (code: string, skipHistory?: boolean) => void
  setSelectedNode: (nodeId: string | null) => void
  setSelectedEdge: (edge: EdgeInfo | null) => void
  setSelectedSubgraph: (subgraph: SubgraphInfo | null) => void
  updateNodeStyle: (nodeId: string, style: Partial<NodeStyle>) => void
  getNodeStyle: (nodeId: string) => NodeStyle
  updateSubgraphStyle: (subgraphId: string, style: Partial<SubgraphStyle>) => void
  getSubgraphStyle: (subgraphId: string) => SubgraphStyle
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
  parseSubgraphs: () => SubgraphInfo[]
  insertSubgraph: (id: string, title: string, nodeIds?: string[]) => void
  updateSubgraphTitle: (subgraphId: string, newTitle: string) => void
  deleteSubgraph: (subgraphId: string) => void
  addNodeToSubgraph: (subgraphId: string, nodeId: string) => void
  removeNodeFromSubgraph: (subgraphId: string, nodeId: string) => void
  duplicateNode: (nodeId: string) => string | null
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
    /(\w+)[[({<]/g,  // 节点定义
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
      selectedSubgraph: null,
      nodeStyles: {},
      subgraphStyles: {},
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

      setSelectedNode: (nodeId: string | null) => set({ selectedNode: nodeId, selectedEdge: null, selectedSubgraph: null }),

      setSelectedEdge: (edge: EdgeInfo | null) => set({ selectedEdge: edge, selectedNode: null, selectedSubgraph: null }),

      setSelectedSubgraph: (subgraph: SubgraphInfo | null) => set({ selectedSubgraph: subgraph, selectedNode: null, selectedEdge: null }),

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

      getSubgraphStyle: (subgraphId: string) => {
        const state = get()
        return state.subgraphStyles[subgraphId] || { fill: '#f5f5f5', stroke: '#333333', strokeWidth: 1, color: '#333333' }
      },

      updateSubgraphStyle: (subgraphId: string, style: Partial<SubgraphStyle>) => {
        const state = get()
        const currentStyle = state.subgraphStyles[subgraphId] || { fill: '#f5f5f5', stroke: '#333333', strokeWidth: 1, color: '#333333' }
        const newStyle = { ...currentStyle, ...style }

        // 更新 subgraphStyles
        set({ subgraphStyles: { ...state.subgraphStyles, [subgraphId]: newStyle } })

        // 更新代码中的 style 语句
        const lines = state.code.split('\n')
        const styleRegex = new RegExp(`^\\s*style\\s+${subgraphId}\\s+`)
        const styleLineIndex = lines.findIndex(line => styleRegex.test(line))
        const styleStr = `    style ${subgraphId} fill:${newStyle.fill},stroke:${newStyle.stroke},stroke-width:${newStyle.strokeWidth}px,color:${newStyle.color}`

        if (styleLineIndex >= 0) {
          lines[styleLineIndex] = styleStr
        } else {
          // 在文件末尾添加 style
          lines.push(styleStr)
        }

        state.setCode(lines.join('\n'))
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

        // 检查 afterNodeId 是否在某个 subgraph 中
        const subgraphs = get().parseSubgraphs()
        let targetSubgraph: SubgraphInfo | null = null
        for (const sg of subgraphs) {
          if (sg.nodes.includes(afterNodeId)) {
            targetSubgraph = sg
            break
          }
        }

        // 找到插入位置
        let insertIndex = -1
        if (targetSubgraph) {
          // 在 subgraph 内部，afterNodeId 所在行之后插入
          for (let i = targetSubgraph.lineStart + 1; i < targetSubgraph.lineEnd; i++) {
            if (lines[i].includes(afterNodeId)) {
              insertIndex = i + 1
            }
          }
          // 如果没找到，插入到 subgraph 的 end 之前
          if (insertIndex === -1) {
            insertIndex = targetSubgraph.lineEnd
          }
        } else {
          // 不在 subgraph 中，找到 afterNodeId 所在行之后
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(afterNodeId)) {
              insertIndex = i + 1
            }
          }
        }

        if (insertIndex > 0) {
          const newLine = `    ${afterNodeId} --> ${newNodeId}${open}${newNodeLabel}${close}`
          lines.splice(insertIndex, 0, newLine)

          // 复制 afterNodeId 的样式到新节点
          const styleRegex = new RegExp(`^\\s*style\\s+${afterNodeId}\\s+(.+)$`, 'm')
          const styleMatch = state.code.match(styleRegex)
          if (styleMatch) {
            // 在末尾添加新节点的样式
            lines.push(`    style ${newNodeId} ${styleMatch[1]}`)
          }

          get().setCode(lines.join('\n'))
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

        // 先收集所有节点的定义位置（哪些行定义了哪些节点的标签）
        const nodeDefinitions: Map<string, { lineIndex: number; definition: string }[]> = new Map()
        const defPattern = /(\w+)([[({<][[({}]?)(.*?)([\])}>][\])}>]?)/g

        lines.forEach((line, lineIndex) => {
          let match
          const lineCopy = line
          defPattern.lastIndex = 0
          while ((match = defPattern.exec(lineCopy)) !== null) {
            const nid = match[1]
            if (['flowchart', 'graph', 'subgraph', 'end', 'style', 'classDef', 'class'].includes(nid.toLowerCase())) continue
            const fullDef = `${nid}${match[2]}${match[3]}${match[4]}`
            if (!nodeDefinitions.has(nid)) {
              nodeDefinitions.set(nid, [])
            }
            nodeDefinitions.get(nid)!.push({ lineIndex, definition: fullDef })
          }
        })

        const processedLines: string[] = []
        const orphanedDefinitions: string[] = [] // 需要单独保留的节点定义

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const trimmed = line.trim()

          // 保留 flowchart 声明行
          if (trimmed.startsWith('flowchart') || trimmed.startsWith('graph')) {
            processedLines.push(line)
            continue
          }
          // 保留 subgraph 相关
          if (trimmed.startsWith('subgraph') || trimmed === 'end') {
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
            // 处理 & 并联语法
            const arrowMatch = line.match(/^(\s*)(.*?)\s*(-->|---->|-.->|-.--->|==>|=====>)(\|[^|]*\|)?\s*(.*)$/)
            if (arrowMatch) {
              const [, indent, leftPart, arrow, label, rightPart] = arrowMatch
              const labelStr = label || ''

              const leftNodes = leftPart.split('&').map(n => n.trim()).filter(n => n)
              const rightNodes = rightPart.split('&').map(n => n.trim()).filter(n => n)

              const newLeftNodes = leftNodes.filter(n => !new RegExp(`^${nodeId}(?:[\\[\\(\\{/<]|$)`).test(n) && n !== nodeId)
              const newRightNodes = rightNodes.filter(n => !new RegExp(`^${nodeId}(?:[\\[\\(\\{/<]|$)`).test(n) && n !== nodeId)

              // 检查被移除的边中，是否有节点的唯一定义在此行
              const checkOrphanedNodes = (nodes: string[], currentLineIndex: number) => {
                for (const nodePart of nodes) {
                  // 提取节点ID（可能带标签定义）
                  const idMatch = nodePart.match(/^(\w+)/)
                  if (!idMatch) continue
                  const nid = idMatch[1]
                  if (nid === nodeId) continue // 跳过被删除的节点

                  const defs = nodeDefinitions.get(nid)
                  if (defs && defs.length === 1 && defs[0].lineIndex === currentLineIndex) {
                    // 这个节点只在当前行有定义，需要保留
                    orphanedDefinitions.push(`    ${defs[0].definition}`)
                  }
                }
              }

              // 检查左右两边被移除的节点
              const removedLeft = leftNodes.filter(n => new RegExp(`^${nodeId}(?:[\\[\\(\\{/<]|$)`).test(n) || n === nodeId)
              const removedRight = rightNodes.filter(n => new RegExp(`^${nodeId}(?:[\\[\\(\\{/<]|$)`).test(n) || n === nodeId)

              // 如果整行要被删除，检查所有对端节点
              if (newLeftNodes.length === 0 || newRightNodes.length === 0) {
                if (removedLeft.length > 0) checkOrphanedNodes(rightNodes, i)
                if (removedRight.length > 0) checkOrphanedNodes(leftNodes, i)
              }

              if (newLeftNodes.length > 0 && newRightNodes.length > 0) {
                const newLine = `${indent}${newLeftNodes.join(' & ')} ${arrow}${labelStr} ${newRightNodes.join(' & ')}`
                processedLines.push(newLine)
              }
              continue
            }
          }

          processedLines.push(line)
        }

        // 在 flowchart 声明后插入孤立节点的定义
        if (orphanedDefinitions.length > 0) {
          const headerIndex = processedLines.findIndex(l => l.trim().startsWith('flowchart') || l.trim().startsWith('graph'))
          if (headerIndex >= 0) {
            processedLines.splice(headerIndex + 1, 0, ...orphanedDefinitions)
          }
        }

        const newCode = processedLines.join('\n')
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

      parseSubgraphs: () => {
        const state = get()
        const lines = state.code.split('\n')
        const subgraphs: SubgraphInfo[] = []
        const stack: { id: string; title: string; lineStart: number; nodes: string[] }[] = []

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const trimmed = line.trim()

          // Match subgraph declaration: subgraph id [title] or subgraph id
          const subgraphMatch = trimmed.match(/^subgraph\s+(\w+)(?:\s*\[([^\]]*)\])?/)
          if (subgraphMatch) {
            const id = subgraphMatch[1]
            const title = subgraphMatch[2] || id
            stack.push({ id, title, lineStart: i, nodes: [] })
            continue
          }

          // Match end keyword
          if (trimmed === 'end' && stack.length > 0) {
            const current = stack.pop()!
            subgraphs.push({
              id: current.id,
              title: current.title,
              nodes: current.nodes,
              lineStart: current.lineStart,
              lineEnd: i,
            })
            continue
          }

          // If inside a subgraph, collect node IDs
          if (stack.length > 0) {
            // Match node definitions or references
            const nodePattern = /\b([A-Za-z]\w*)(?:[[({<]|(?:\s*-->|\s*-.->|\s*==>))/g
            let match
            while ((match = nodePattern.exec(trimmed)) !== null) {
              const nodeId = match[1]
              if (!['flowchart', 'graph', 'subgraph', 'end', 'style', 'classDef', 'class'].includes(nodeId.toLowerCase())) {
                if (!stack[stack.length - 1].nodes.includes(nodeId)) {
                  stack[stack.length - 1].nodes.push(nodeId)
                }
              }
            }
            // Also match standalone node IDs (just referenced, no definition)
            const standalonePattern = /^\s*(\w+)\s*$/
            const standaloneMatch = trimmed.match(standalonePattern)
            if (standaloneMatch) {
              const nodeId = standaloneMatch[1]
              if (!['flowchart', 'graph', 'subgraph', 'end', 'style', 'classDef', 'class'].includes(nodeId.toLowerCase())) {
                if (!stack[stack.length - 1].nodes.includes(nodeId)) {
                  stack[stack.length - 1].nodes.push(nodeId)
                }
              }
            }
          }
        }

        return subgraphs
      },

      insertSubgraph: (id: string, title: string, nodeIds?: string[]) => {
        const state = get()
        const lines = state.code.split('\n')

        // Find insertion point (before the last non-empty line or at end)
        let insertIndex = lines.length
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].trim()) {
            insertIndex = i + 1
            break
          }
        }

        const subgraphLines: string[] = []
        subgraphLines.push(`    subgraph ${id} [${title}]`)

        if (nodeIds && nodeIds.length > 0) {
          // Move node definitions into subgraph
          const nodesToMove: string[] = []
          for (const nodeId of nodeIds) {
            // Find and extract node definition
            const nodePattern = new RegExp(`^(\\s*)(${nodeId})([\\[\\(\\{/<]+[^\\]\\)\\}>]+[\\]\\)\\}/>]+)(.*)$`)
            for (let i = 0; i < lines.length; i++) {
              const match = lines[i].match(nodePattern)
              if (match) {
                nodesToMove.push(`        ${nodeId}${match[3]}`)
                break
              }
            }
            // If no definition found, just add the ID
            if (!nodesToMove.find(n => n.includes(nodeId))) {
              nodesToMove.push(`        ${nodeId}`)
            }
          }
          subgraphLines.push(...nodesToMove)
        }

        subgraphLines.push('    end')

        lines.splice(insertIndex, 0, ...subgraphLines)
        get().setCode(lines.join('\n'))
      },

      updateSubgraphTitle: (subgraphId: string, newTitle: string) => {
        const state = get()
        const lines = state.code.split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const match = line.match(/^(\s*)subgraph\s+(\w+)(?:\s*\[([^\]]*)\])?/)
          if (match && match[2] === subgraphId) {
            const indent = match[1]
            lines[i] = `${indent}subgraph ${subgraphId} [${newTitle}]`
            get().setCode(lines.join('\n'))
            return
          }
        }
      },

      deleteSubgraph: (subgraphId: string) => {
        const state = get()
        const subgraphs = get().parseSubgraphs()
        const subgraph = subgraphs.find(s => s.id === subgraphId)
        if (!subgraph) return

        const lines = state.code.split('\n')

        // Extract content lines (between subgraph and end)
        const contentLines: string[] = []
        for (let i = subgraph.lineStart + 1; i < subgraph.lineEnd; i++) {
          const line = lines[i]
          // Reduce indentation by 4 spaces
          const dedented = line.startsWith('        ') ? line.slice(4) : line
          contentLines.push(dedented)
        }

        // Remove subgraph block and insert content at the same position
        const newLines = [
          ...lines.slice(0, subgraph.lineStart),
          ...contentLines,
          ...lines.slice(subgraph.lineEnd + 1),
        ]

        get().setCode(newLines.join('\n'))
        set({ selectedSubgraph: null })
      },

      addNodeToSubgraph: (subgraphId: string, nodeId: string) => {
        const state = get()
        const subgraphs = get().parseSubgraphs()
        const subgraph = subgraphs.find(s => s.id === subgraphId)
        if (!subgraph) return

        const lines = state.code.split('\n')

        // Find node definition line
        const nodePattern = new RegExp(`^(\\s*)(${nodeId})([\\[\\(\\{/<]+[^\\]\\)\\}>]+[\\]\\)\\}/>]+)`)
        let nodeDefLine: string | null = null
        let nodeDefIndex = -1

        for (let i = 0; i < lines.length; i++) {
          // Skip if already inside this subgraph
          if (i > subgraph.lineStart && i < subgraph.lineEnd) continue

          const match = lines[i].match(nodePattern)
          if (match) {
            nodeDefLine = `        ${nodeId}${match[3]}`
            nodeDefIndex = i
            break
          }
        }

        // If no definition found, just add the ID
        if (!nodeDefLine) {
          nodeDefLine = `        ${nodeId}`
        }

        // Insert node into subgraph (before 'end')
        const insertIndex = subgraph.lineEnd

        // Remove original definition if found and outside subgraph
        if (nodeDefIndex >= 0 && (nodeDefIndex < subgraph.lineStart || nodeDefIndex > subgraph.lineEnd)) {
          // Check if the line only contains this node definition
          const fullLine = lines[nodeDefIndex].trim()
          const isOnlyNodeDef = fullLine.match(new RegExp(`^${nodeId}[\\[\\(\\{/<]+[^\\]\\)\\}>]+[\\]\\)\\}/>]+$`))

          if (isOnlyNodeDef) {
            lines.splice(nodeDefIndex, 1)
            // Adjust insert index if needed
            const adjustedInsertIndex = nodeDefIndex < insertIndex ? insertIndex - 1 : insertIndex
            lines.splice(adjustedInsertIndex, 0, nodeDefLine)
          } else {
            // Node is part of an edge, just add reference to subgraph
            lines.splice(insertIndex, 0, nodeDefLine)
          }
        } else {
          lines.splice(insertIndex, 0, nodeDefLine)
        }

        get().setCode(lines.join('\n'))
      },

      removeNodeFromSubgraph: (subgraphId: string, nodeId: string) => {
        const state = get()
        const subgraphs = get().parseSubgraphs()
        const subgraph = subgraphs.find(s => s.id === subgraphId)
        if (!subgraph) return

        const lines = state.code.split('\n')

        // Find and remove node from subgraph
        let removedLine: string | null = null
        for (let i = subgraph.lineStart + 1; i < subgraph.lineEnd; i++) {
          const line = lines[i]
          const nodePattern = new RegExp(`^\\s*${nodeId}(?:[\\[\\(\\{/<]|\\s*$)`)
          if (nodePattern.test(line)) {
            removedLine = line.trim()
            lines.splice(i, 1)
            break
          }
        }

        // Add the node definition after the subgraph block
        if (removedLine) {
          // Find the new end position (after removal, lineEnd shifted)
          const newSubgraphs = get().parseSubgraphs()
          const newSubgraph = newSubgraphs.find(s => s.id === subgraphId)
          const insertPos = newSubgraph ? newSubgraph.lineEnd + 1 : subgraph.lineEnd
          lines.splice(insertPos, 0, `    ${removedLine.replace(/^\s+/, '')}`)
        }

        get().setCode(lines.join('\n'))
      },

      duplicateNode: (nodeId: string) => {
        const state = get()
        const code = state.code
        const lines = code.split('\n')

        // 生成新节点 ID
        const newNodeId = get().getNextNodeId()

        // 查找原节点的定义（标签和形状）
        const bracketPairs: Record<string, string> = {
          '[': ']', '(': ')', '{': '}',
          '([': '])', '[(': ')]', '((': '))', '{{': '}}',
          '[/': '/]', '[\\': '\\]', '>': ']',
        }
        const nodeStartPattern = new RegExp(`${nodeId}(\\[\\[|\\(\\[|\\[\\(|\\(\\(|\\{\\{|\\[\\/|\\[\\\\|>|\\[|\\(|\\{)`)
        const match = code.match(nodeStartPattern)

        if (!match) return null

        const openBracket = match[1]
        const closeBracket = bracketPairs[openBracket]
        if (!closeBracket) return null

        const startPos = match.index! + match[0].length
        const closePos = code.indexOf(closeBracket, startPos)
        if (closePos === -1) return null

        const label = code.slice(startPos, closePos)

        // 查找所有指向该节点的边（入边）和从该节点出发的边（出边）
        const inEdges: Array<{ from: string; label: string; arrowType: string; lineIndex: number }> = []
        const outEdges: Array<{ to: string; label: string; arrowType: string; lineIndex: number }> = []

        const arrowPattern = /(\w+)\s*(-->|---->|--->|-.->|-.--->|==>|=====>)\s*(\|([^|]*)\|)?\s*(\w+)/g

        for (let i = 0; i < lines.length; i++) {
          let edgeMatch
          const lineArrowPattern = new RegExp(arrowPattern.source, 'g')
          while ((edgeMatch = lineArrowPattern.exec(lines[i])) !== null) {
            const from = edgeMatch[1]
            const arrow = edgeMatch[2]
            const edgeLabel = edgeMatch[4] || ''
            const to = edgeMatch[5]

            if (to === nodeId) {
              inEdges.push({ from, label: edgeLabel, arrowType: arrow, lineIndex: i })
            }
            if (from === nodeId) {
              outEdges.push({ to, label: edgeLabel, arrowType: arrow, lineIndex: i })
            }
          }
        }

        // 找到插入位置（在原节点相关行之后）
        let insertIndex = lines.length - 1
        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes(nodeId)) {
            insertIndex = i + 1
            break
          }
        }

        // 构建新节点定义和连接
        const newLines: string[] = []

        // 为每个入边的源节点添加到新节点的连接
        for (const edge of inEdges) {
          const labelPart = edge.label ? `|${edge.label}|` : ''
          newLines.push(`    ${edge.from} ${edge.arrowType}${labelPart} ${newNodeId}${openBracket}${label}${closeBracket}`)
        }

        // 如果没有入边，只添加节点定义
        if (inEdges.length === 0) {
          newLines.push(`    ${newNodeId}${openBracket}${label}${closeBracket}`)
        }

        // 为每个出边添加新节点到目标节点的连接
        for (const edge of outEdges) {
          const labelPart = edge.label ? `|${edge.label}|` : ''
          // 避免重复定义节点
          newLines.push(`    ${newNodeId} ${edge.arrowType}${labelPart} ${edge.to}`)
        }

        // 插入新行
        lines.splice(insertIndex, 0, ...newLines)

        // 复制样式
        const styleRegex = new RegExp(`^\\s*style\\s+${nodeId}\\s+(.+)$`, 'm')
        const styleMatch = code.match(styleRegex)
        if (styleMatch) {
          lines.push(`    style ${newNodeId} ${styleMatch[1]}`)
        }

        get().setCode(lines.join('\n'))
        return newNodeId
      },
    }),
    {
      name: 'mermaid-editor-storage',
      partialize: (state) => ({ code: state.code, nodeStyles: state.nodeStyles }),
    }
  )
)

export { DEFAULT_CODE, defaultNodeStyle }
