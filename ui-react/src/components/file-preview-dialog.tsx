import { useEffect, useState } from 'react'
import { DownloadSimple } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, PageLoading } from '@/components/states'
import { readableError } from '@/lib/utils'

const TEXT_TYPES = new Set(['txt', 'md', 'json', 'yaml', 'yml', 'xml', 'csv', 'log', 'py', 'js', 'jsx', 'ts', 'tsx', 'java', 'sql', 'css', 'scss', 'html'])
const IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])
const AUDIO_TYPES = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'])
const VIDEO_TYPES = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogv'])

export interface FilePreviewSource {
  name: string
  extension?: string
  description?: string
  load: () => Promise<Blob>
}

export function FilePreviewDialog({ source, onClose }: { source: FilePreviewSource | null; onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const extension = (source?.extension || source?.name.split('.').pop() || '').toLowerCase()

  useEffect(() => {
    if (!source) return
    let cancelled = false
    let createdUrl = ''
    setLoading(true); setBlob(null); setText(null); setUrl(''); setError('')
    void source.load().then(async (nextBlob) => {
      if (cancelled) return
      setBlob(nextBlob)
      if (TEXT_TYPES.has(extension)) {
        const nextText = await nextBlob.text()
        if (!cancelled) setText(nextText)
      }
      else if (IMAGE_TYPES.has(extension) || AUDIO_TYPES.has(extension) || VIDEO_TYPES.has(extension) || extension === 'pdf') {
        createdUrl = URL.createObjectURL(nextBlob)
        if (cancelled) { URL.revokeObjectURL(createdUrl); createdUrl = '' }
        else setUrl(createdUrl)
      }
    }).catch((cause) => { if (!cancelled) setError(readableError(cause, '文件加载失败')) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true; if (createdUrl) URL.revokeObjectURL(createdUrl) }
  }, [source, extension])

  function download() {
    if (!blob || !source) return
    const nextUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = nextUrl; anchor.download = source.name; anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(nextUrl), 10_000)
  }

  const supported = TEXT_TYPES.has(extension) || IMAGE_TYPES.has(extension) || AUDIO_TYPES.has(extension) || VIDEO_TYPES.has(extension) || extension === 'pdf'
  return <Dialog open={Boolean(source)} onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>{source?.name}</DialogTitle><DialogDescription>{source?.description || (extension ? `${extension.toUpperCase()} 文件` : '文件预览')}</DialogDescription></DialogHeader>
    {loading ? <PageLoading label="文件加载中…" /> : null}
    {error ? <EmptyState title="预览加载失败" description={error} /> : null}
    {!loading && !error && text !== null ? <pre className="max-h-[70dvh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-xs">{text}</pre> : null}
    {!loading && !error && url && extension === 'pdf' ? <iframe title={source?.name} src={url} className="h-[70dvh] w-full rounded-lg border" /> : null}
    {!loading && !error && url && IMAGE_TYPES.has(extension) ? <img src={url} alt={source?.name || ''} className="max-h-[70dvh] w-full object-contain" /> : null}
    {!loading && !error && url && AUDIO_TYPES.has(extension) ? <audio src={url} controls className="w-full" /> : null}
    {!loading && !error && url && VIDEO_TYPES.has(extension) ? <video src={url} controls className="max-h-[70dvh] w-full rounded-lg bg-black" /> : null}
    {!loading && !error && blob && !supported ? <EmptyState title="此格式不支持内嵌预览" description="可以下载后使用本地应用打开。" /> : null}
    <DialogFooter><Button variant="outline" onClick={onClose}>关闭</Button><Button onClick={download} disabled={!blob}><DownloadSimple size={14} /> 下载</Button></DialogFooter>
  </DialogContent></Dialog>
}
