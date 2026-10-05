import { useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

export interface SelectOption {
  label: string
  value: string
  description?: string
}

/** 多选字段：Popover + Command 搜索 + Checkbox；用于工具/技能/MCP/子 Agent 等选择器。 */
export function MultiSelectField({
  options,
  value,
  onChange,
  placeholder = '选择…',
  loading = false,
  className,
}: {
  options: SelectOption[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  loading?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const selectedRef = useRef(value)
  selectedRef.current = value

  function toggle(optionValue: string) {
    onChange(selectedRef.current.includes(optionValue) ? selectedRef.current.filter((item) => item !== optionValue) : [...selectedRef.current, optionValue])
  }

  const labels = value.map((item) => options.find((option) => option.value === item)?.label ?? item)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn('h-9 w-full justify-between font-normal', className)} title={labels.join('、')}>
          <span className="truncate">{loading ? '加载中…' : labels.length ? labels.join('、') : placeholder}</span>
          <CaretDown size={14} className="shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索…" />
          <CommandList className="max-h-64">
            <CommandEmpty>无匹配项</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option.value} onSelect={() => toggle(option.value)} className="gap-2">
                  <Checkbox checked={value.includes(option.value)} tabIndex={-1} aria-hidden />
                  <div className="min-w-0">
                    <div className="truncate">{option.label}</div>
                    {option.description ? <div className="truncate text-xs text-muted-foreground">{option.description}</div> : null}
                  </div>
                  {value.includes(option.value) ? <Check size={14} className="ml-auto shrink-0" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
