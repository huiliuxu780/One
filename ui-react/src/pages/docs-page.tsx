import { useMemo } from 'react'
import { ArrowLeft, BookOpen, House, List, MagnifyingGlass } from '@phosphor-icons/react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link, Navigate, NavLink, useParams } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import agentDoc from '@/docs/content/agent/index.md?raw'
import buildDoc from '@/docs/content/build-doc/index.md?raw'
import chatDoc from '@/docs/content/chat/index.md?raw'
import hookDoc from '@/docs/content/hook/index.md?raw'
import mcpDoc from '@/docs/content/mcp/index.md?raw'
import modelDoc from '@/docs/content/model/index.md?raw'
import promptDoc from '@/docs/content/prompt/index.md?raw'
import qaDoc from '@/docs/content/qa/index.md?raw'
import sensitiveDoc from '@/docs/content/sensitive/index.md?raw'
import skillDoc from '@/docs/content/skill/index.md?raw'
import toolDoc from '@/docs/content/tool/index.md?raw'
import workflowDoc from '@/docs/content/workflow/index.md?raw'
import markdownOverview from '@/docs/content/markdown-extension/overview.md?raw'
import markdownContainers from '@/docs/content/markdown-extension/container-extension.md?raw'
import markdownRenderer from '@/docs/content/markdown-extension/renderer-override.md?raw'
import markdownPractices from '@/docs/content/markdown-extension/best-practices.md?raw'
import markdownReference from '@/docs/content/markdown-extension/quick-reference.md?raw'

export interface DocSection {
  slug: string
  label: string
  summary: string
  content: string
}

export const docSections: DocSection[] = [
  { slug: 'agent', label: '智能体', summary: '创建、配置与管理 Agent', content: agentDoc },
  { slug: 'chat', label: '对话界面', summary: '会话、流式事件与工作空间', content: chatDoc },
  { slug: 'workflow', label: '工作流', summary: '编排、发布、运行与调试', content: workflowDoc },
  { slug: 'model', label: '模型供应商', summary: '供应商与模型配置', content: modelDoc },
  { slug: 'tool', label: '工具', summary: '内置与自定义工具', content: toolDoc },
  { slug: 'skill', label: '技能包', summary: '技能导入、编辑与关联', content: skillDoc },
  { slug: 'mcp', label: 'MCP', summary: '服务接入与工具治理', content: mcpDoc },
  { slug: 'hook', label: 'Hook', summary: '生命周期钩子', content: hookDoc },
  { slug: 'prompt', label: '提示词模板', summary: '模板维护与引用', content: promptDoc },
  { slug: 'sensitive', label: '敏感词', summary: '检测与处理策略', content: sensitiveDoc },
  {
    slug: 'markdown-extension',
    label: 'Markdown 扩展',
    summary: '扩展语法和渲染器',
    content: [markdownOverview, markdownContainers, markdownRenderer, markdownPractices, markdownReference].join('\n\n---\n\n'),
  },
  { slug: 'build', label: '打包构建', summary: '开发与部署参考', content: buildDoc },
  { slug: 'qa', label: 'Q&A', summary: '常见问题与排查', content: qaDoc },
]

function normalizeContainers(markdown: string) {
  return markdown
    .replace(/^:::(tip|info|warning|danger)(?:\s+(.+))?$/gm, (_match, kind: string, title?: string) => {
      const labels: Record<string, string> = { tip: '提示', info: '说明', warning: '注意', danger: '危险' }
      return `> **${title || labels[kind]}**`
    })
    .replace(/^:::\s*$/gm, '')
}

function headingId(children: unknown) {
  return String(children).trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

const markdownComponents: Components = {
  h1: ({ children }) => <h1 id={headingId(children)} className="mb-6 mt-2 scroll-mt-6 text-3xl font-semibold tracking-tight">{children}</h1>,
  h2: ({ children }) => <h2 id={headingId(children)} className="mb-3 mt-10 scroll-mt-6 border-b border-border pb-2 text-xl font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 id={headingId(children)} className="mb-2 mt-7 scroll-mt-6 text-base font-semibold">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-2 mt-5 font-semibold">{children}</h4>,
  p: ({ children }) => <p className="my-3 leading-7 text-foreground/85">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6 text-foreground/85">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6 text-foreground/85">{children}</ol>,
  blockquote: ({ children }) => <blockquote className="my-4 rounded-r-lg border-l-4 border-primary bg-primary/5 px-4 py-2 text-sm">{children}</blockquote>,
  table: ({ children }) => <div className="my-5 overflow-x-auto rounded-lg border border-border"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
  th: ({ children }) => <th className="border-b border-border bg-muted px-3 py-2 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border px-3 py-2 align-top last:border-b-0">{children}</td>,
  a: ({ children, href }) => <a href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="font-medium text-primary underline underline-offset-4">{children}</a>,
  code: ({ children, className }) => className ? <code className={className}>{children}</code> : <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>,
  pre: ({ children }) => <pre className="my-4 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-6 text-slate-100">{children}</pre>,
  img: ({ alt }) => <span className="my-4 block rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center text-xs text-muted-foreground">{alt || '原手册截图占位'}</span>,
  hr: () => <hr className="my-10 border-border" />,
}

function DocsHome() {
  return (
    <div>
      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-7">
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BookOpen size={24} weight="duotone" /></div>
        <h1 className="text-3xl font-semibold tracking-tight">Apboa Next 使用手册</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">React 版管理台的配置、运行与排障参考。知识库与本地 RAG 已按当前产品范围移除，因此不会出现在文档导航中。</p>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {docSections.map((section) => (
          <Link key={section.slug} to={`/docs/${section.slug}`} className="group rounded-xl border border-border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card-hover">
            <div className="font-semibold group-hover:text-primary">{section.label}</div>
            <p className="mt-1 text-sm text-muted-foreground">{section.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function DocsPage() {
  const { slug } = useParams()
  const section = useMemo(() => docSections.find((item) => item.slug === slug), [slug])
  if (slug && !section) return <Navigate to="/docs" replace />

  return (
    <div className="min-h-[100dvh] bg-app lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-sidebar p-4 lg:sticky lg:top-0 lg:h-[100dvh] lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Link to="/agent" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-sidebar-accent">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="size-9 rounded-lg" />
          <span><span className="block text-sm font-semibold">Apboa Next</span><span className="block text-[11px] text-sidebar-muted">使用手册</span></span>
        </Link>
        <div className="relative mt-4 hidden lg:block">
          <MagnifyingGlass className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
          <Input className="pl-9" value="" readOnly placeholder="按左侧目录浏览" aria-label="文档目录提示" />
        </div>
        <nav className="mt-4 flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible" aria-label="使用手册目录">
          <NavLink to="/docs" end className={({ isActive }) => cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent', isActive && 'bg-sidebar-accent font-medium text-primary')}><House size={17} />概述</NavLink>
          {docSections.map((item) => <NavLink key={item.slug} to={`/docs/${item.slug}`} className={({ isActive }) => cn('flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent', isActive && 'bg-sidebar-accent font-medium text-primary')}><List size={16} />{item.label}</NavLink>)}
        </nav>
        <Link to="/agent" className="mt-5 hidden items-center gap-2 px-3 text-xs text-muted-foreground hover:text-foreground lg:flex"><ArrowLeft size={14} />返回管理台</Link>
      </aside>
      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-12">
        <article className="mx-auto max-w-5xl">
          {section ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{normalizeContainers(section.content)}</ReactMarkdown> : <DocsHome />}
        </article>
      </main>
    </div>
  )
}
