import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { md5 } from 'js-md5'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { toast } from '@/components/ui/sonner'
import { readableError } from '@/lib/utils'
import * as authApi from '@/api/auth'

const passwordSchema = z
  .object({
    oldPassword: z.string().min(6, '请输入原密码'),
    newPassword: z.string().min(6, '新密码至少 6 位').max(64, '新密码不能超过 64 位'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: '两次输入的新密码不一致',
  })

type PasswordForm = z.infer<typeof passwordSchema>

export function ChangePasswordPage() {
  const form = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // 与 Vue 端一致：提交前对密码做 md5，明文只在表单内存中存在。
      await authApi.changePassword({ oldPassword: md5(values.oldPassword), newPassword: md5(values.newPassword) })
      toast.success('密码修改成功')
      form.reset({ oldPassword: '', newPassword: '', confirmPassword: '' })
    } catch (cause) {
      toast.error(readableError(cause, '密码修改失败'))
    }
  })

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="font-display text-[24px] font-bold leading-tight">修改密码</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">定期更换密码有助于保护账号安全。</p>
      <Card>
        <CardHeader>
          <CardTitle>登录密码</CardTitle>
          <CardDescription>原密码用于身份校验，不会被记录或回显。</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form className="space-y-5" onSubmit={onSubmit} noValidate>
              <FormField
                control={form.control}
                name="oldPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>原密码</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>新密码</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormDescription>至少 6 位，建议混合字母、数字与符号。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认新密码</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? '提交中…' : '确认修改'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
