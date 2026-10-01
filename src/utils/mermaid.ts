import mermaid from 'mermaid'

let initialized = false

/**
 * 去掉连线标签（edge label）的底色。
 * Mermaid 默认会给 .edgeLabel / .labelBkg 加一层背景色来遮住连线，
 * 这里覆写为透明，让连线文字直接贴在连线上。
 */
const EDGE_LABEL_TRANSPARENT_CSS = `
  .edgeLabel,
  .edgeLabel p,
  .edgeLabel rect,
  .labelBkg {
    background-color: transparent;
  }
  .edgeLabel rect {
    fill: transparent;
  }
`

export function initMermaid() {
  if (initialized) return

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    themeCSS: EDGE_LABEL_TRANSPARENT_CSS,
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis',
    },
  })

  initialized = true
}

export async function renderMermaid(
  code: string,
  elementId: string
): Promise<{ svg: string; bindFunction?: (element: Element) => void }> {
  initMermaid()

  try {
    const { svg, bindFunctions } = await mermaid.render(elementId, code)
    return { svg, bindFunction: bindFunctions }
  } catch (error) {
    console.error('Mermaid render error:', error)
    throw error
  }
}

export function validateMermaidCode(code: string): boolean {
  try {
    mermaid.parse(code)
    return true
  } catch {
    return false
  }
}
