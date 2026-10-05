/**
 * Dashboard 类型（自 Vue 端移植，字段保持一致）
 */

export interface DashboardDsl {
  version: number
  grid?: { columns?: number; rowHeight?: number; gap?: number }
  refresh?: { enabled?: boolean; intervalSeconds?: number }
  panels?: PanelDsl[]
}

export interface PanelDsl {
  id: string
  title: string
  datasetId?: string
  chartType?: 'TABLE' | 'LINE' | 'BAR' | 'PIE' | 'STAT'
  layout?: { x?: number; y?: number; w?: number; h?: number }
  options?: Record<string, unknown>
}

export interface DashboardEntity {
  id?: string
  name?: string
  remark?: string
  status?: string
  isDefault?: boolean
  version?: string
  config?: DashboardDsl
  enabled?: boolean
}

export type DatasetType = 'SQL' | 'HTTP'

export interface HttpQueryParam {
  key: string
  value: string
  default?: string
}

export interface HttpHeaderItem {
  key: string
  value: string
}

export interface HttpDatasetConfig {
  url: string
  queries?: HttpQueryParam[]
  headers?: HttpHeaderItem[]
  dataPath?: string
}

export interface DashboardDatasetEntity {
  id?: string
  name?: string
  remark?: string
  type?: DatasetType
  sqlText?: string
  params?: unknown
  resultSchema?: unknown
  cacheTtl?: number
  datasourceId?: string
  httpConfig?: HttpDatasetConfig
  enabled?: boolean
  shared?: boolean
  createdBy?: string
}

export interface DatasetExecuteResult {
  columns?: Array<{ name?: string; type?: string }>
  rows?: Array<Record<string, unknown>>
  rowCount: number
  elapsedMs: number
  truncated: boolean
}

export interface DashboardHistoryEntity {
  id: string
  dashboardId: string
  config: DashboardDsl
  note?: string
  createdAt?: string
}
