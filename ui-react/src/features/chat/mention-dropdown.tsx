import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Folder, Wrench, Sparkle } from '@phosphor-icons/react'
import type { MentionResourceItem, ResourceKind } from './mention'

export interface MentionDropdownHandle {
  /** 处理编辑器转发的按键；返回 true 表示已消费。 */
  handleKeydown: (event: { key: string }) => boolean
}

const GROUPS: Array<{ kind: ResourceKind; title: string; icon: React.ReactNode }> = [
  { kind: 'workspace-file', title: '工作空间文件', icon: <Folder size={13} /> },
  { kind: 'agent-tool', title: '工具', icon: <Wrench size={13} /> },
  { kind: 'agent-skill', title: '技能', icon: <Sparkle size={13} /> },
]

function matches(item: MentionResourceItem, keyword: string) {
  const text = keyword.trim().toLowerCase()
  if (!text) return true
  return item.name.toLowerCase().includes(text) || (item.description ?? '').toLowerCase().includes(text)
}

/**
 * @ 资源提及下拉：三类数据源由父组件通过真实接口加载后传入，
 * 过滤为前端 includes 匹配；键盘交互（↑↓ 循环、Enter 选择、Esc 关闭）
 * 由输入框 onKeyDown 转发到 handleKeydown，与 Vue ResourceMentionDropdown 行为一致。
 */
export const MentionDropdown = forwardRef<MentionDropdownHandle, {
  items: MentionResourceItem[]
  query: string
  onSelect: (item: MentionResourceItem) => void
  onClose: () => void
}>(function MentionDropdown({ items, query, onSelect, onClose }, ref) {
  const [highlighted, setHighlighted] = useState(0)
  const listRef = useRef<HTMLDivElement | null>(null)

  const visible = useMemo(() => (
    GROUPS
      .map((group) => ({ ...group, entries: items.filter((item) => item.kind === group.kind && matches(item, query)) }))
      .filter((group) => group.entries.length > 0)
  ), [items, query])

  const flat = useMemo(() => visible.flatMap((group) => group.entries), [visible])

  useEffect(() => { setHighlighted(0) }, [query])

  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-mention-index="${highlighted}"]`)
    node?.scrollIntoView({ block: 'nearest' })
  }, [highlighted])

  useImperativeHandle(ref, () => ({
    handleKeydown(event) {
      if (!flat.length) return false
      if (event.key === 'ArrowDown') {
        setHighlighted((current) => (current + 1) % flat.length)
        return true
      }
      if (event.key === 'ArrowUp') {
        setHighlighted((current) => (current - 1 + flat.length) % flat.length)
        return true
      }
      if (event.key === 'Enter') {
        const item = flat[Math.min(highlighted, flat.length - 1)]
        if (item) onSelect(item)
        return true
      }
      if (event.key === 'Escape') {
        onClose()
        return true
      }
      return false
    },
  }), [flat, highlighted, onSelect, onClose])

  if (!flat.length) {
    return (
      <div className="absolute bottom-full left-0 z-30 mb-2 w-80 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">没有匹配的文件、工具或技能</p>
      </div>
    )
  }

  let renderIndex = -1
  return (
    <div ref={listRef} className="absolute bottom-full left-0 z-30 mb-2 max-h-72 w-80 overflow-auto rounded-lg border border-border bg-popover py-1 shadow-md">
      {visible.map((group) => (
        <div key={group.kind}>
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">{group.icon} {group.title}</div>
          {group.entries.map((item) => {
            renderIndex += 1
            const index = renderIndex
            return (
              <button
                key={`${item.kind}:${item.content}`}
                data-mention-index={index}
                className={`w-full px-3 py-1.5 text-left text-sm ${index === highlighted ? 'bg-sidebar-accent' : 'hover:bg-sidebar-accent/60'}`}
                onMouseDown={(event) => { event.preventDefault(); onSelect(item) }}
                onMouseEnter={() => setHighlighted(index)}
              >
                <div className="truncate">{item.name}</div>
                {item.description ? <div className="truncate text-xs text-muted-foreground">{item.description}</div> : null}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
})
