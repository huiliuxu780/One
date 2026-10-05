/**
 * 聊天资源提及（@mention）协议层。
 *
 * 与旧 Vue ui/src/utils/chat/tagSystem.ts、useResourceCategories.ts 保持协议一致：
 * 标签以无属性成对标签内嵌在消息 content 文本中发送，如 `<agent-tool>web_search</agent-tool>`。
 * - workspace-file 的内容是工作空间相对路径；agent-tool 是 toolId；agent-skill 是技能包 name。
 */

export type ResourceKind = 'workspace-file' | 'agent-tool' | 'agent-skill'

export interface MentionResourceItem {
  kind: ResourceKind
  /** 标签内容：文件路径 / toolId / 技能包 name */
  content: string
  /** 展示名 */
  name: string
  description?: string
}

export interface ParsedTagSegment {
  type: 'tag'
  tagName: string
  tagContent: string
  content: string
}

export interface ParsedTextSegment {
  type: 'text'
  content: string
}

export type ParsedSegment = ParsedTagSegment | ParsedTextSegment

const TAG_NAME_PATTERN = '[a-zA-Z][a-zA-Z0-9\\-]*'

/** 与 Vue tagSystem.parseTaggedContent 相同的正则与分段行为。 */
export function parseTaggedContent(text: string): ParsedSegment[] {
  const regex = new RegExp(`<(${TAG_NAME_PATTERN})>([\\s\\S]*?)</\\1>`, 'g')
  const segments: ParsedSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    segments.push({ type: 'tag', tagName: match[1], tagContent: match[2], content: match[0] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) segments.push({ type: 'text', content: text.slice(lastIndex) })
  return segments
}

export function isMentionTag(tagName: string): tagName is ResourceKind {
  return tagName === 'workspace-file' || tagName === 'agent-tool' || tagName === 'agent-skill'
}

export function buildTag(kind: ResourceKind, content: string): string {
  return `<${kind}>${content}</${kind}>`
}

/** 从标签内容反解展示名：文件取路径末段，工具/技能即内容本身（与 Vue resolveDisplayFromContent 一致）。 */
export function displayFromTagContent(kind: ResourceKind, content: string): string {
  if (kind === 'workspace-file') {
    const index = content.lastIndexOf('/')
    return index >= 0 ? content.slice(index + 1) : content
  }
  return content
}

/**
 * 判断光标前的 @ 是否触发提及下拉：@ 必须在文本开头、行首（含换行后）或空格之后；
 * @ 与光标之间为查询词。与 Vue checkMentionTrigger 的边界规则一致（额外接受换行，textarea 中换行即行首）。
 */
export function findMentionQuery(textBeforeCursor: string): string | null {
  const atIndex = textBeforeCursor.lastIndexOf('@')
  if (atIndex < 0) return null
  if (atIndex !== 0 && textBeforeCursor[atIndex - 1] !== ' ' && textBeforeCursor[atIndex - 1] !== '\n') return null
  return textBeforeCursor.slice(atIndex + 1)
}

/** 匹配光标前紧邻的完整提及标签，用于 Backspace 一次整块删除（对齐 Vue 标签整块删除行为）。 */
export function matchTagBeforeCursor(textBeforeCursor: string): string | null {
  const regex = new RegExp(`<(${TAG_NAME_PATTERN})>[^<]*</\\1>$`)
  const match = regex.exec(textBeforeCursor)
  return match ? match[0] : null
}

/** Vue 内置技能（接口返回为空时仍然可用）。 */
export const BUILTIN_AGENT_SKILLS: MentionResourceItem[] = [
  {
    kind: 'agent-skill',
    content: 'user_interaction_protocol_rules',
    name: '交互增强「内置」',
    description: '当任务执行中缺少必要参数、需要用户填写表单、选择方案、确认动作时，AI 可通过该技能生成交互界面（表单、选择、确认）。',
  },
  {
    kind: 'agent-skill',
    content: 'vision_enhancement_protocol_rules',
    name: '视觉增强「内置」',
    description: '该技能可以让模型在自然语言描述的基础上，附带卡片（card）或图表（chart）两类视觉组件，以提升信息传达效率。',
  },
]
