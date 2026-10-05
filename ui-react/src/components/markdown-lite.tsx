import { Fragment, type ReactNode } from 'react'

/**
 * 轻量安全 Markdown 渲染：仅解析围栏代码块、行内代码、加粗与换行。
 * 全部输出为 React 元素，不使用 dangerouslySetInnerHTML，天然免疫 XSS。
 * Mermaid、VEP/UIP/APP 交互卡片在后续迁移阶段接入。
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b${index}`}>{token.slice(2, -2)}</strong>)
    } else {
      nodes.push(<code key={`${keyPrefix}-c${index}`} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{token.slice(1, -1)}</code>)
    }
    lastIndex = match.index + token.length
    index++
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function MarkdownLite({ content }: { content: string }) {
  if (!content) return null
  const segments = content.split(/```/)
  return (
    <div className="space-y-2 text-sm leading-6 break-words">
      {segments.map((segment, segmentIndex) => {
        if (segmentIndex % 2 === 1) {
          // 围栏代码块：首行为语言标识
          const newline = segment.indexOf('\n')
          const language = newline > -1 ? segment.slice(0, newline).trim() : ''
          const code = newline > -1 ? segment.slice(newline + 1) : segment
          return (
            <pre key={`code-${segmentIndex}`} className="overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100">
              {language ? <div className="mb-1 text-[10px] uppercase text-slate-400">{language}</div> : null}
              <code>{code.replace(/\n$/, '')}</code>
            </pre>
          )
        }
        return (
          <Fragment key={`text-${segmentIndex}`}>
            {segment.split(/\n{2,}/).map((paragraph, paragraphIndex) =>
              paragraph.trim() ? (
                <p key={`p-${segmentIndex}-${paragraphIndex}`} className="whitespace-pre-wrap">
                  {renderInline(paragraph, `${segmentIndex}-${paragraphIndex}`)}
                </p>
              ) : null,
            )}
          </Fragment>
        )
      })}
    </div>
  )
}
