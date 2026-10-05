import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from '@/components/ui/sonner'
import { readableError } from '@/lib/utils'
import { useAuthStore } from '@/features/auth/auth-store'
import * as authApi from '@/api/auth'

const profileSchema = z.object({
  nickname: z.string().trim().min(1, '昵称不能为空').max(50, '昵称不能超过 50 个字符'),
  email: z
    .string()
    .trim()
    .max(100, '邮箱不能超过 100 个字符')
    .refine((value) => value === '' || /.+@.+\..+/.test(value), '邮箱格式不正确'),
})

type ProfileForm = z.infer<typeof profileSchema>

export function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const navigate = useNavigate()

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { nickname: user?.nickname ?? '', email: user?.email ?? '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await authApi.updateProfile(values)
      updateUser(values)
      toast.success('个人资料已更新')
    } catch (cause) {
      toast.error(readableError(cause, '资料更新失败'))
    }
  })

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-xl font-semibold tracking-tight">个人资料</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">维护账号基础信息；修改后立即生效。</p>
      <Card>
        <CardHeader>
          <CardTitle>账号信息</CardTitle>
          <CardDescription>用户名登录后不可修改；邮箱用于接收通知。</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-5" onSubmit={onSubmit} noValidate>
              <FormField
                control={form.control}
                name="nickname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>昵称</FormLabel>
                    <FormControl>
                      <Input placeholder="展示名称" maxLength={50} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem>
                <FormLabel>用户名</FormLabel>
                <FormControl>
                  <Input value={user?.username ?? ''} disabled />
                </FormControl>
                <FormDescription>登录账号，不可修改。</FormDescription>
              </FormItem>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>邮箱</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="name@example.com" maxLength={100} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? '保存中…' : '保存修改'}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate('/settings/password')}>
                  修改密码
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
