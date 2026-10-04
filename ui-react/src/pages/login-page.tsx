import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKey, User } from '@phosphor-icons/react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { readableError } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/auth-store'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { authenticated, busy, login } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  if (authenticated) return <Navigate to="/agent" replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await login(username.trim(), password)
      const destination = (location.state as { from?: string } | null)?.from || '/agent'
      navigate(destination, { replace: true })
    } catch (cause) {
      setError(readableError(cause, '登录失败'))
    }
  }

  return (
    <main className="grid min-h-[100dvh] bg-auth md:grid-cols-[minmax(320px,0.8fr)_minmax(480px,1.2fr)]">
      <section className="hidden border-r border-white/10 bg-slate-950 px-12 py-10 text-slate-100 md:flex md:flex-col md:justify-between">
        <div className="flex items-center gap-3">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Apboa Next" className="size-10 rounded-xl" />
          <div>
            <div className="text-sm font-semibold">Apboa Next</div>
            <div className="text-xs text-slate-400">Agent development platform</div>
          </div>
        </div>
        <div className="max-w-md space-y-4">
          <p className="text-4xl font-semibold leading-tight tracking-[-0.035em]">构建、调试并运行你的智能体。</p>
          <p className="max-w-sm text-sm leading-6 text-slate-400">保留现有后端协议，前端正在迁移至 React。</p>
        </div>
        <p className="text-xs text-slate-500">默认组织模式</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 md:hidden">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Apboa Next" className="mb-4 size-11 rounded-xl" />
          </div>
          <div className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight">登录 Apboa Next</h1>
            <p className="mt-2 text-sm text-muted-foreground">使用已有账号进入默认组织。</p>
          </div>
          <form className="space-y-5" onSubmit={submit}>
            <label className="grid gap-2 text-sm font-medium" htmlFor="username">
              用户名或邮箱
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                <Input id="username" autoComplete="username" required minLength={4} value={username} onChange={(event) => setUsername(event.target.value)} className="pl-10" />
              </div>
            </label>
            <label className="grid gap-2 text-sm font-medium" htmlFor="password">
              密码
              <div className="relative">
                <LockKey className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} />
                <Input id="password" type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="pl-10" />
              </div>
            </label>
            {error ? <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{error}</div> : null}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? '正在验证' : '登录'}
              {!busy ? <ArrowRight size={17} weight="bold" /> : null}
            </Button>
          </form>
          <p className="mt-6 text-xs leading-5 text-muted-foreground">组织切换、组织申请和审批入口已从新前端移除，鉴权与租户隔离仍由后端执行。</p>
        </div>
      </section>
    </main>
  )
}
