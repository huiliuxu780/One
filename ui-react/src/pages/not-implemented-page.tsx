import { ArrowLeft, Wrench } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function NotImplementedPage() {
  return <main className="grid min-h-[100dvh] place-items-center p-8"><div className="max-w-md text-center"><div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-muted"><Wrench size={24} /></div><h1 className="text-xl font-semibold">该功能正在迁移</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">这个页面没有使用假数据。对应 Vue 页面仍保留作为接口与行为基线。</p><Button asChild variant="outline" className="mt-5"><Link to="/agent"><ArrowLeft size={16} />返回智能体</Link></Button></div></main>
}
