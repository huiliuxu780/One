import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResourcePage } from '@/features/resources/resource-page'
import { modelConfigDef, modelProviderDef, withProviderOptions } from '@/features/resources/defs'

/** 模型管理：模型配置 + 供应商双页签；配置表单的供应商选项实时加载。 */
export function ModelPage() {
  const providerList = useQuery({
    queryKey: ['list', 'model-provider', 'options'],
    queryFn: async () => (await modelProviderDef.api.page!({ page: 1, size: 200 })).data.data.records,
  })

  const configDef = useMemo(
    () => withProviderOptions(modelConfigDef, (providerList.data ?? []).map((provider) => ({ label: provider.name, value: String(provider.id) }))),
    [providerList.data],
  )

  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight">模型</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">模型配置与供应商连接信息；密钥仅提交时传输。</p>
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">模型配置</TabsTrigger>
          <TabsTrigger value="provider">供应商</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <ResourcePage def={configDef} />
        </TabsContent>
        <TabsContent value="provider">
          <ResourcePage def={modelProviderDef} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
