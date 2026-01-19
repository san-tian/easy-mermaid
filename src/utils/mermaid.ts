import mermaid from 'mermaid'

let initialized = false

export function initMermaid() {
  if (initialized) return

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
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
