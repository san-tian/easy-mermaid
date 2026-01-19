import type { NodeStyle, EdgeInfo, ArrowType } from '../store/editorStore'

export function formatStyleValue(styles: NodeStyle): string {
  const parts: string[] = []
  if (styles.fill) parts.push(`fill:${styles.fill}`)
  if (styles.stroke) parts.push(`stroke:${styles.stroke}`)
  if (styles.strokeWidth) parts.push(`stroke-width:${styles.strokeWidth}px`)
  if (styles.color) parts.push(`color:${styles.color}`)
  if (styles.rx !== undefined) parts.push(`rx:${styles.rx}px`)
  return parts.join(',')
}

export function parseStyleLine(line: string): { nodeId: string; styles: Partial<NodeStyle> } | null {
  const match = line.match(/^\s*style\s+(\w+)\s+(.+)$/)
  if (!match) return null

  const nodeId = match[1]
  const styleStr = match[2]
  const styles: Partial<NodeStyle> = {}

  const pairs = styleStr.split(',')
  for (const pair of pairs) {
    const [key, value] = pair.split(':').map((s) => s.trim())
    if (!key || !value) continue

    switch (key) {
      case 'fill':
        styles.fill = value
        break
      case 'stroke':
        styles.stroke = value
        break
      case 'stroke-width':
        styles.strokeWidth = parseInt(value, 10) || 2
        break
      case 'color':
        styles.color = value
        break
      case 'rx':
        styles.rx = parseInt(value, 10) || 5
        break
    }
  }

  return { nodeId, styles }
}

export function parseAllStyles(code: string): Record<string, Partial<NodeStyle>> {
  const result: Record<string, Partial<NodeStyle>> = {}
  const lines = code.split('\n')

  for (const line of lines) {
    const parsed = parseStyleLine(line)
    if (parsed) {
      result[parsed.nodeId] = parsed.styles
    }
  }

  return result
}

export function updateStyleInCode(code: string, nodeId: string, styles: NodeStyle): string {
  const lines = code.split('\n')
  const styleRegex = new RegExp(`^(\\s*)style\\s+${nodeId}\\s+`)
  const newStyleLine = `    style ${nodeId} ${formatStyleValue(styles)}`

  let found = false
  const updatedLines = lines.map((line) => {
    if (styleRegex.test(line)) {
      found = true
      return newStyleLine
    }
    return line
  })

  if (!found) {
    updatedLines.push(newStyleLine)
  }

  return updatedLines.join('\n')
}

export function extractNodeIdFromSvg(svgNodeId: string): string | null {
  // Mermaid 生成的节点 ID 格式: "flowchart-A-0" 或 "A"
  const match = svgNodeId.match(/flowchart-(\w+)-\d+/)
  if (match) {
    return match[1]
  }
  // 直接返回 ID（可能是简单格式）
  return svgNodeId.replace(/-\d+$/, '')
}

export function parseEdges(code: string): EdgeInfo[] {
  const edges: EdgeInfo[] = []
  const lines = code.split('\n')

  // Match arrow patterns with optional label |text|
  // 支持: A --> B, A -->|label| B, A -.-> B, A ==> B 等
  const arrowPattern = /(\w+)\s*(-->|---->|-.->|-.--->|==>|=====>)\s*(\|([^|]*)\|)?\s*(\w+)/

  // 将解析到的箭头类型映射到 ArrowType
  const normalizeArrowType = (arrow: string): ArrowType => {
    if (arrow === '--->' || arrow === '---->') return '--->'
    if (arrow === '-.->' || arrow === '-.->') return '-.->'
    if (arrow === '==>' || arrow === '=====>') return '==>'
    return '-->'
  }

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(arrowPattern)
    if (match) {
      edges.push({
        from: match[1],
        to: match[5],
        label: match[4] || '', // 标签可能为空
        arrowType: normalizeArrowType(match[2]),
        lineIndex: i,
      })
    }
  }

  return edges
}

export function parseNodes(code: string): Array<{ id: string; label: string; lineIndex: number }> {
  const nodes: Array<{ id: string; label: string; lineIndex: number }> = []
  const lines = code.split('\n')
  const seen = new Set<string>()

  // Match node definitions like A[label], B{label}, C(label), etc.
  const nodePattern = /(\w+)([\[\(\{/<]+)([^\]\)\}>]+)([\]\)\}/>]+)/g

  for (let i = 0; i < lines.length; i++) {
    let match
    while ((match = nodePattern.exec(lines[i])) !== null) {
      const id = match[1]
      if (!seen.has(id)) {
        seen.add(id)
        nodes.push({
          id,
          label: match[3],
          lineIndex: i,
        })
      }
    }
  }

  return nodes
}
