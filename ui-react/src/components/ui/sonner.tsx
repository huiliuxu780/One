import { Toaster as Sonner, type ToasterProps } from 'sonner'

/** 全局通知；页面代码统一从 '@/components/ui/sonner' 的 toast 使用。 */
export function Toaster(props: ToasterProps) {
  return <Sonner position="top-center" richColors closeButton duration={4000} {...props} />
}

export { toast } from 'sonner'
