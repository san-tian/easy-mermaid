import mermaid from 'mermaid'

let initialized = false

/**
 * 连线标签（edge label）遮罩色。
 * Mermaid 默认给 .edgeLabel / .labelBkg 一层半透明灰底
 * （rgba(232,232,232,.8) / rgba(232,232,232,.5)），看起来像一块灰盒子。
 * 这里换成与画布同色的实心白底：连线被遮住留出空白，
 * 但不会从文字中间穿过，也看不到任何底色。
 */
const EDGE_LABEL_MASK_CSS = `
  .edgeLabel,
  .edgeLabel p,
  .labelBkg {
    background-color: #ffffff;
  }
  .edgeLabel rect {
    background-color: #ffffff;
    fill: #ffffff;
    opacity: 1;
  }
`

export function initMermaid() {
  if (initialized) return

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    themeCSS: EDGE_LABEL_MASK_CSS,
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
