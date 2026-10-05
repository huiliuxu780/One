import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { readableError } from '@/lib/utils'
import { heartbeat, storageProtocols } from '@/api/settings'

export function OpsPage() {
  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight">运维</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">执行节点与 WebSocket 节点监控、存储协议配置与连通性验证。</p>
      <Tabs defaultValue="nodes">
        <TabsList>
          <TabsTrigger value="nodes">节点监控</TabsTrigger>
          <TabsTrigger value="storage">存储协议</TabsTrigger>
        </TabsList>
        <TabsContent value="nodes"><NodesTab /></TabsContent>
        <TabsContent value="storage"><StorageTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function NodesTab() {
  const nodesQuery = useQuery({ queryKey: ['list', 'heartbeat-nodes'], queryFn: async () => (await heartbeat.nodes()).data.data, refetchInterval: 15000 })
  const wsQuery = useQuery({ queryKey: ['list', 'heartbeat-ws'], queryFn: async () => (await heartbeat.websocketNodes()).data.data, refetchInterval: 15000 })

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-semibold">执行节点（Runtime / Proxy）</h2>
          {nodesQuery.isLoading ? (
            <TableSkeleton rows={3} />
          ) : nodesQuery.error ? (
            <ErrorState error={nodesQuery.error} onRetry={() => void nodesQuery.refetch()} />
          ) : (nodesQuery.data ?? []).length === 0 ? (
            <EmptyState title="暂无上报节点" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>节点</TableHead>
                  <TableHead>地址</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近心跳</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(nodesQuery.data ?? []).map((node, index) => (
                  <TableRow key={`${node.nodeId}-${index}`}>
                    <TableCell>{node.hostname}</TableCell>
                    <TableCell className="font-mono text-xs">{node.ip}</TableCell>
                    <TableCell>
                      <Badge variant={node.nodeStatus === 'HEALTHY' ? 'default' : 'secondary'}>{node.nodeStatus}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{node.lastUpdatedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <h2 className="mb-3 text-sm font-semibold">WebSocket 节点</h2>
          {wsQuery.isLoading ? (
            <TableSkeleton rows={2} />
          ) : (wsQuery.data ?? []).length === 0 ? (
            <EmptyState title="暂无 WebSocket 节点" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>节点</TableHead>
                  <TableHead>连接数</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(wsQuery.data ?? []).map((node, index) => (
                  <TableRow key={`${node.nodeId}-${index}`}>
                    <TableCell>{node.hostname}</TableCell>
                    <TableCell className="font-mono text-xs">{node.ip}:{node.port ?? '—'}</TableCell>
                    <TableCell><Badge variant={node.status === 'UP' ? 'default' : 'secondary'}>{node.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StorageTab() {
  const listQuery = useQuery({
    queryKey: ['list', 'storage-protocol'],
    queryFn: async () => (await storageProtocols.page({ page: 1, size: 50 })).data.data,
  })
  const rows = listQuery.data?.records ?? []

  return (
    <Card>
      <CardContent className="pt-5">
        {listQuery.isLoading ? (
          <TableSkeleton rows={3} />
        ) : listQuery.error ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无存储协议配置" description="存储协议配置用于工作空间与附件存储。" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>协议</TableHead>
                <TableHead>配置</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={String(row.id)}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell><Badge variant="outline">{row.protocol}</Badge></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground"><span className="block max-w-64 truncate">{row.protocolConfig}</span></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={async () => {
                      try {
                        const result = await storageProtocols.validate({ id: row.id })
                        toast.success(result.data.data ? '连通性验证通过' : '验证未通过', { description: result.data.data ? '' : '请检查配置与凭据' })
                      } catch (cause) {
                        toast.error(readableError(cause, '验证失败（原始错误）'))
                      }
                    }}>
                      验证连通
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
