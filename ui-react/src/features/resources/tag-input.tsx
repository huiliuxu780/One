import { useState, type KeyboardEvent } from 'react'
import { X } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'

/** Keeps the unfinished token separate so typing a comma cannot merge adjacent tags. */
export function TagInput({ value, onChange, placeholder, id }: {
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  id: string
}) {
  const [draft, setDraft] = useState('')

  function commit(text: string, preserveTail = false) {
    const parts = text.split(/[,，]/)
    const tail = preserveTail ? parts.pop() ?? '' : ''
    const additions = parts.map((part) => part.trim()).filter(Boolean)
    if (additions.length) onChange([...new Set([...value, ...additions])])
    setDraft(tail)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',' || event.key === '，') {
      event.preventDefault()
      commit(draft)
    } else if (event.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1))
    }
  }

  return <div className="space-y-2">
    {value.length ? <div className="flex flex-wrap gap-1.5">{value.map((tag) => <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">{tag}<button type="button" aria-label={`删除 ${tag}`} onClick={() => onChange(value.filter((item) => item !== tag))}><X size={12} /></button></span>)}</div> : null}
    <Input id={id} value={draft} placeholder={placeholder ?? '输入后按逗号或回车添加'} onChange={(event) => {
      const next = event.target.value
      if (/[,，]/.test(next)) commit(next, true)
      else setDraft(next)
    }} onKeyDown={onKeyDown} onBlur={() => { if (draft.trim()) commit(draft) }} />
  </div>
}
