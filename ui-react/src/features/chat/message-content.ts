import type { UploadedFileItem } from '@/types'

export const ATTACHMENT_SEPARATOR = '@==##::::##==@'

export function messageWithFiles(files: UploadedFileItem[], text: string) {
  if (!files.length) return text
  const payload = files.map(({ id, name, extension, size }) => ({ id, name, extension, size }))
  return `${JSON.stringify({ files: payload })}${ATTACHMENT_SEPARATOR}${text}`
}

export function parseMessageContent(content: string | unknown): { text: string; files: UploadedFileItem[] } {
  if (typeof content !== 'string') return { text: JSON.stringify(content), files: [] }
  let normalized = content
  try {
    const wrapper = JSON.parse(content) as { content?: unknown }
    if (wrapper && typeof wrapper.content === 'string') normalized = wrapper.content
  } catch {
    // 普通文本不是 JSON 包装。
  }
  const split = normalized.indexOf(ATTACHMENT_SEPARATOR)
  if (split < 0) return { text: normalized, files: [] }
  try {
    const payload = JSON.parse(normalized.slice(0, split)) as { files?: UploadedFileItem[] }
    return { text: normalized.slice(split + ATTACHMENT_SEPARATOR.length), files: Array.isArray(payload.files) ? payload.files : [] }
  } catch {
    return { text: normalized, files: [] }
  }
}
