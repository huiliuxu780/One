import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { skillHub } from '@/api/resources'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { readableError } from '@/lib/utils'
import type { SkillsHubVO } from '@/types'

interface SearchFilters {
  keyword: string
  source: string
  category: string
  sortBy: string
  order: string
}

const defaults: SearchFilters = { keyword: '通用', source: '', category: '', sortBy: 'updated_at', order: 'desc' }
const sources = [
  ['official', '官方'], ['community', '社区'], ['enterprise', '企业'], ['clawhub', 'ClawHub'],
]
const categories = [
  ['office-efficiency', '办公效率'], ['content-creation', '内容创作'], ['dev-programming', '开发编程'],
  ['data-analysis', '数据分析'], ['design-media', '设计多媒体'], ['ai-agent', 'AI Agent'],
  ['knowledge-management', '知识管理'], ['business-ops', '商业运营'], ['education', '教育学习'],
  ['professional', '行业专业'], ['it-ops-security', 'IT 运维与安全'], ['life-service', '生活服务'],
]
const sortOptions = [
  ['updated_at', '更新时间'], ['downloads', '下载量'], ['stars', '收藏数'], ['installs', '安装量'], ['score', '评分'],
]

function safeHomepage(value?: string | null) {
  return value && /^https?:\/\//i.test(value) ? value : null
}

export function SkillHubSheet({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [filters, setFilters] = useState<SearchFilters>(defaults)
  const [submitted, setSubmitted] = useState<SearchFilters>(defaults)
  const [page, setPage] = useState(1)
  const [downloading, setDownloading] = useState('')
  const query = useQuery({
    queryKey: ['list', 'skill-hub', submitted, page],
    queryFn: async () => (await skillHub.search({
      keyword: submitted.keyword || undefined,
      source: submitted.source || undefined,
      category: submitted.category || undefined,
      sortBy: submitted.sortBy,
      order: submitted.order,
      page,
    })).data.data,
  })
  const rows: SkillsHubVO[] = query.data ?? []

  function patch(key: keyof SearchFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function search() {
    setPage(1)
    setSubmitted({ ...filters, keyword: filters.keyword.trim() })
  }

  function reset() {
    setFilters(defaults)
    setSubmitted(defaults)
    setPage(1)
  }

  async function install(item: SkillsHubVO) {
    setDownloading(item.slug)
    try {
      const response = await skillHub.download(item.slug, item.category || 'SkillHub安装')
      const result = response.data.data
      toast.success(`已导入 ${result.importedCount} 个技能`)
      onImported()
    } catch (cause) {
      toast.error(readableError(cause, 'SkillHub 导入失败'))
    } finally {
      setDownloading('')
    }
  }

  return <Sheet open onOpenChange={(open) => !open && onClose()}>
    <SheetContent side="right" className="w-full overflow-auto sm:max-w-3xl">
      <SheetHeader><SheetTitle>SkillHub</SheetTitle><SheetDescription>搜索并导入官方与社区的技能包。</SheetDescription></SheetHeader>
      <form className="my-4 grid gap-2 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); search() }}>
        <Input value={filters.keyword} onChange={(event) => patch('keyword', event.target.value)} placeholder="搜索标题或描述" aria-label="关键词" />
        <FilterSelect label="来源" value={filters.source} options={sources} onChange={(value) => patch('source', value)} />
        <FilterSelect label="分类" value={filters.category} options={categories} onChange={(value) => patch('category', value)} />
        <FilterSelect label="排序字段" value={filters.sortBy} options={sortOptions} onChange={(value) => patch('sortBy', value)} all={false} />
        <FilterSelect label="顺序" value={filters.order} options={[["desc", "降序"], ["asc", "升序"]]} onChange={(value) => patch('order', value)} all={false} />
        <div className="flex gap-2"><Button type="submit">搜索</Button><Button type="button" variant="outline" onClick={reset}>重置</Button></div>
      </form>
      {query.isLoading ? <TableSkeleton rows={5} /> : query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : rows.length === 0 ? <EmptyState title="没有搜索结果" description="调整关键词或筛选条件后重试。" /> : <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((item) => <div key={item.slug} className="rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">{item.iconUrl ? <img src={item.iconUrl} alt="" className="size-10 rounded-lg object-cover" /> : null}<div className="min-w-0"><div className="truncate font-medium">{item.name}</div><div className="text-xs text-muted-foreground">{item.category} · v{item.version} · {item.downloads} 下载</div></div></div>
          <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
          <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void install(item)} disabled={Boolean(downloading)}>{downloading === item.slug ? '导入中…' : '导入'}</Button>{safeHomepage(item.homepage) ? <Button asChild size="sm" variant="outline"><a href={safeHomepage(item.homepage)!} target="_blank" rel="noreferrer">详情</a></Button> : null}</div>
        </div>)}
      </div>}
      <div className="mt-4 flex justify-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>上一页</Button><Badge variant="secondary">第 {page} 页</Badge><Button variant="outline" size="sm" disabled={rows.length < 30} onClick={() => setPage((value) => value + 1)}>下一页</Button></div>
    </SheetContent>
  </Sheet>
}

function FilterSelect({ label, value, options, onChange, all = true }: {
  label: string
  value: string
  options: string[][]
  onChange: (value: string) => void
  all?: boolean
}) {
  return <Select value={value || 'all'} onValueChange={(next) => onChange(next === 'all' ? '' : next)}><SelectTrigger aria-label={label}><SelectValue placeholder={label} /></SelectTrigger><SelectContent>{all ? <SelectItem value="all">全部{label}</SelectItem> : null}{options.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select>
}
