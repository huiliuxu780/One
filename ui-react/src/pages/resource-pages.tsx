import { ResourcePage } from '@/features/resources/resource-page'
import { codeExecutionDef, hookDef, memoryDef, promptDef, sensitiveDef, studioDef, toolDef } from '@/features/resources/defs'

export function ToolPage() {
  return <ResourcePage def={toolDef} />
}

export function HookPage() {
  return <ResourcePage def={hookDef} />
}

export function PromptPage() {
  return <ResourcePage def={promptDef} />
}

export function SensitivePage() {
  return <ResourcePage def={sensitiveDef} />
}

export function MemoryPage() {
  return <ResourcePage def={memoryDef} />
}

export function CodeExecutionPage() {
  return <ResourcePage def={codeExecutionDef} />
}

export function StudioPage() {
  return <ResourcePage def={studioDef} />
}
