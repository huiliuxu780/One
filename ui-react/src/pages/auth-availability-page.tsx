import { ArrowLeft, LockKey, UsersThree } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export function RegistrationUnavailablePage() {
  return <Availability icon={<UsersThree size={24} />} title="自助注册已关闭" description="当前环境固定使用一个默认组织。组织创建、加入申请与审批属于明确停用功能，新账号请由默认组织管理员在“设置 → 账号管理”中创建。" />
}

export function PasswordRecoveryUnavailablePage() {
  return <Availability icon={<LockKey size={24} />} title="暂不支持自助找回密码" description="原 Vue 页面只有验证码与成功提示的静态占位，没有可调用的后端找回接口。为避免制造虚假成功状态，请联系默认组织管理员在“设置 → 账号管理”中重置密码。" />
}

function Availability({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return <main className="grid min-h-[100dvh] place-items-center bg-muted/30 px-5"><div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-card"><div className="mb-5 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">{icon}</div><h1 className="text-xl font-semibold">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p><Button asChild variant="outline" className="mt-6"><Link to="/login"><ArrowLeft size={14} /> 返回登录</Link></Button></div></main>
}
