import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'

/** 列表搜索输入：值非空时提供一键清除，避免无匹配时只能手动选字删除。 */
export function SearchInput({ value, onChange, placeholder = '按名称搜索', ariaLabel, className = 'w-64' }: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={ariaLabel ?? placeholder}
        className="pl-8 pr-7"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value ? (
        <button
          type="button"
          aria-label="清除搜索"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => onChange('')}
        >
          <X size={13} />
        </button>
      ) : null}
    </div>
  )
}
