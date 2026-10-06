import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  page: number
  size: number
  total: number
  onPageChange: (page: number) => void
  onSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  className?: string
}

/** 与 PageResult 对齐的分页条；total=0 时仍展示但禁用翻页。 */
export function Pagination({ page, size, total, onPageChange, onSizeChange, pageSizeOptions = [10, 20, 50], className }: PaginationProps) {
  const pages = Math.max(Math.ceil(total / size), 1)
  const canPrev = page > 1
  const canNext = page < pages

  return (
    <nav className={cn('flex flex-wrap items-center justify-between gap-3 py-3', className)} aria-label="分页">
      <div className="font-mono text-[11px] text-muted-foreground">
        共 {total} 条 · 第 {page}/{pages} 页
      </div>
      <div className="flex items-center gap-2">
        {onSizeChange ? (
          <Select value={String(size)} onValueChange={(value) => onSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-28" aria-label="每页条数">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} 条/页
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button variant="outline" size="sm" disabled={!canPrev} onClick={() => onPageChange(page - 1)}>
          <CaretLeft size={14} /> 上一页
        </Button>
        <Button variant="outline" size="sm" disabled={!canNext} onClick={() => onPageChange(page + 1)}>
          下一页 <CaretRight size={14} />
        </Button>
      </div>
    </nav>
  )
}
