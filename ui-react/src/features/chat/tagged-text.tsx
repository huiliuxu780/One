import { Folder, Sparkle, Wrench } from '@phosphor-icons/react'
import { displayFromTagContent, isMentionTag, parseTaggedContent } from './mention'

const KIND_STYLE: Record<string, { icon: React.ReactNode; className: string }> = {
  'workspace-file': { icon: <Folder size={12} />, className: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  'agent-tool': { icon: <Wrench size={12} />, className: 'border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300' },
  'agent-skill': { icon: <Sparkle size={12} />, className: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300' },
}

/**
 * 消息内容中 `<workspace-file>/<agent-tool>/<agent-skill>` 标签的还原渲染，
 * 等价旧 Vue TaggedContentRenderer：文本段按原样输出，标签段渲染为徽标；
 * 未注册的标签名退化为纯文本。用户消息默认使用本组件（与 Vue 行为一致）。
 */
export function TaggedText({ content }: { content: string }) {
  const segments = parseTaggedContent(content)
  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((segment, index) => {
        if (segment.type === 'text') return <span key={index}>{segment.content}</span>
        if (!isMentionTag(segment.tagName)) return <span key={index}>{segment.content}</span>
        const style = KIND_STYLE[segment.tagName]
        return (
          <span key={index} className={`mx-0.5 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 align-baseline text-xs ${style.className}`}>
            {style.icon}
            <span className="max-w-56 truncate">{displayFromTagContent(segment.tagName, segment.tagContent)}</span>
          </span>
        )
      })}
    </span>
  )
}
