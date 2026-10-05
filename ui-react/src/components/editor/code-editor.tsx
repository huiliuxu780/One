import { useEffect, useRef } from 'react'
import type { Extension } from '@codemirror/state'

/**
 * CodeMirror 6 纯 TypeScript 接入层：不移植任何 Vue 包装组件。
 * 语言包按扩展名动态加载，构建时独立分包。
 */
export function CodeEditor({
  value,
  onChange,
  fileName = '',
  readOnly = false,
  className,
}: {
  value: string
  onChange?: (value: string) => void
  fileName?: string
  readOnly?: boolean
  className?: string
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let view: { destroy: () => void } | null = null
    let cancelled = false

    async function create() {
      const hostElement = host
      if (!hostElement) return
      const [{ EditorView }, { EditorState }, { basicSetup }, { oneDark }] = await Promise.all([
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('codemirror'),
        import('@codemirror/theme-one-dark'),
      ])
      const language = await languageExtension(fileName)
      if (cancelled) return

      const extensions: Extension[] = [basicSetup, EditorView.lineWrapping, language]
      if (readOnly) extensions.push(EditorState.readOnly.of(true))
      else
      extensions.push(
        EditorView.updateListener.of((update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => {
          if (update.docChanged && onChangeRef.current) onChangeRef.current(update.state.doc.toString())
        }),
      )

      view = new EditorView({
        state: EditorState.create({ doc: value, extensions: [...extensions, oneDark] }),
        parent: hostElement,
      }) as unknown as { destroy: () => void }
    }

    void create()
    return () => {
      cancelled = true
      view?.destroy()
    }
    // 仅在挂载/只读变化时重建；内容变化通过 CodeMirror 内部状态管理。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  return <div ref={hostRef} className={className} />
}

async function languageExtension(fileName: string): Promise<Extension> {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  const [js, md, py, yaml] = await Promise.all([
    import('@codemirror/lang-javascript'),
    import('@codemirror/lang-markdown'),
    import('@codemirror/lang-python'),
    import('@codemirror/lang-yaml'),
  ])
  switch (extension) {
    case 'js':
    case 'mjs':
    case 'cjs':
    case 'ts':
      return js.javascript()
    case 'md':
      return md.markdown()
    case 'py':
      return py.python()
    case 'yaml':
    case 'yml':
      return yaml.yaml()
    default:
      return []
  }
}
