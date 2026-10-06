import type { AxiosResponse } from 'axios'
import type { ApiResponse, PageResult } from '@/types'

export interface ResourceQuery extends Record<string, unknown> {
  page?: number
  size?: number
  name?: string
}

export interface ResourceApi<T> {
  page?: (query: ResourceQuery) => Promise<AxiosResponse<ApiResponse<PageResult<T>>>>
  list?: () => Promise<AxiosResponse<ApiResponse<T[]>>>
  detail?: (id: string) => Promise<AxiosResponse<ApiResponse<T>>>
  save: (entity: Partial<T>) => Promise<AxiosResponse<ApiResponse<unknown>>>
  update: (entity: Partial<T>) => Promise<AxiosResponse<ApiResponse<unknown>>>
  remove: (ids: string[]) => Promise<AxiosResponse<ApiResponse<unknown>>>
  /** 删除前占用检查：返回引用该资源的使用方列表；非空则阻止删除。 */
  usedWith?: (ids: string[]) => Promise<AxiosResponse<ApiResponse<unknown[]>>>
}

export type FieldType = 'text' | 'textarea' | 'number' | 'switch' | 'select' | 'tags' | 'json' | 'password' | 'tool-schema'

export interface FieldDef {
  name: string
  label: string
  type: FieldType
  required?: boolean
  /** select 的静态选项 */
  options?: { label: string; value: string }[]
  /** 从枚举生成 select 选项 */
  enumFrom?: readonly string[]
  placeholder?: string
  description?: string
  /** 密钥语义：编辑时留空表示不修改，不回显后端密文 */
  secret?: boolean
  /** 表单里占整行 */
  wide?: boolean
  defaultValue?: unknown
  min?: number
  max?: number
  integer?: boolean
}

export interface ColumnDef<T> {
  header: string
  kind?: 'enabled'
  /** 行取值路径，如 'name'；render 优先 */
  field?: keyof T & string
  render?: (row: T) => React.ReactNode
  /** 列宽提示 */
  className?: string
}

export interface ResourceDef<T extends { id?: string | number }> {
  /** 缓存与导航键 */
  key: string
  title: string
  description?: string
  api: ResourceApi<T>
  /** 资源接口是 list 而非 page 时为 true（长期记忆/代码执行/Studio） */
  nonPaged?: boolean
  columns: ColumnDef<T>[]
  form: FieldDef[]
  /** 列表筛选字段（按 FieldDef 渲染，值并入查询参数） */
  filters?: FieldDef[]
  /** 从深链或父页面注入的初始筛选；分页请求必须把它并入查询键和接口参数。 */
  initialFilters?: Record<string, string | number | boolean | undefined>
  searchPlaceholder?: string
  /** 行级额外动作 */
  rowActions?: {
    label: string
    action?: (row: T) => Promise<void> | void
    /** 需要持续交互或展示结果的动作使用受控对话框，避免浏览器 prompt/alert。 */
    renderDialog?: (row: T, onClose: () => void) => React.ReactNode
  }[]
}
