import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkillFileTreeNode, SkillPackageVO } from '@/types'
import { SkillFilesDialog, SkillToolsDialog } from './skill-page'

const detail = vi.fn()
const page = vi.fn()
const updateTools = vi.fn()
const tree = vi.fn()
const allowedExtensions = vi.fn()
const createFile = vi.fn()
const fileContent = vi.fn()

vi.mock('@/api/resources', () => ({
  skills: {
    detail: (...args: unknown[]) => detail(...args),
    updateTools: (...args: unknown[]) => updateTools(...args),
    tree: (...args: unknown[]) => tree(...args),
    allowedExtensions: (...args: unknown[]) => allowedExtensions(...args),
    createFile: (...args: unknown[]) => createFile(...args),
    fileContent: (...args: unknown[]) => fileContent(...args),
  },
  tools: { page: (...args: unknown[]) => page(...args) },
}))

vi.mock('@/components/editor/code-editor', () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) =>
    <textarea aria-label="技能文件内容" value={value} onChange={(event) => onChange(event.target.value)} />,
}))

const skill: SkillPackageVO = {
  id: '7', name: '测试技能', description: '', category: '', enabled: true,
  createdAt: '', updatedAt: '', createdBy: '', updatedBy: '', used: [], tools: [],
}

function renderDialog(dialog: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{dialog}</QueryClientProvider>)
}

describe('Skill 关联工具协议', () => {
  beforeEach(() => {
    detail.mockReset().mockResolvedValue({ data: { data: { id: '7', tools: [] } } })
    page.mockReset().mockResolvedValue({ data: { data: { records: [{ id: '42', toolId: 'search_tool', name: '搜索工具' }] } } })
    updateTools.mockReset().mockResolvedValue({ data: { data: true } })
  })

  it('提交工具记录 ID，而非业务 toolId', async () => {
    renderDialog(<SkillToolsDialog skill={skill} onClose={vi.fn()} />)

    const checkbox = await screen.findByRole('checkbox')
    fireEvent.click(checkbox)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(updateTools).toHaveBeenCalledWith('7', ['42']))
    expect(page).toHaveBeenCalledWith({ page: 1, size: 1000, enabled: true })
  })
})

describe('Skill 文件树', () => {
  beforeEach(() => {
    allowedExtensions.mockReset().mockResolvedValue({ data: { data: ['md', 'py'] } })
    createFile.mockReset().mockResolvedValue({ data: { data: true } })
    fileContent.mockReset().mockResolvedValue({ data: { data: '# 原内容' } })
    tree.mockReset()
  })

  it('可在子目录新建文件并提交父目录路径', async () => {
    tree.mockResolvedValue({ data: { data: [{ name: 'scripts', path: 'scripts', directory: true, children: [] }] } })
    renderDialog(<SkillFilesDialog skill={skill} onClose={vi.fn()} />)

    fireEvent.click(await screen.findByRole('button', { name: '在 scripts 中新建文件' }))
    fireEvent.change(screen.getByPlaceholderText('SKILL.md'), { target: { value: 'helper.py' } })
    fireEvent.click(screen.getByRole('button', { name: '建' }))

    await waitFor(() => expect(createFile).toHaveBeenCalledWith('7', { parentPath: 'scripts', fileName: 'helper.py', content: '' }))
  })

  it('未保存修改时拒绝关闭会保留编辑器', async () => {
    const node: SkillFileTreeNode = { name: 'SKILL.md', path: 'SKILL.md', directory: false, fileId: null, fileType: 'SKILL_MD', extension: 'md', fileSize: 20, children: [] }
    tree.mockResolvedValue({ data: { data: [node] } })
    const onClose = vi.fn()
    renderDialog(<SkillFilesDialog skill={skill} onClose={onClose} />)

    fireEvent.click(await screen.findByRole('button', { name: '📄 SKILL.md' }))
    fireEvent.change(await screen.findByRole('textbox', { name: '技能文件内容' }), { target: { value: '# 已修改' } })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(confirm).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: '技能文件内容' })).toHaveValue('# 已修改')
    confirm.mockRestore()
  })
})
