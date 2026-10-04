# ECS 开发部署

该编排针对 4 vCPU、8GB 内存、40GB 磁盘的单机开发环境，不等同于上游生产拓扑。

## 约束

- 只映射 Nginx 的网页端口。
- MySQL、Redis、Console、Runtime、Proxy 和 WebSocket 仅通过 Docker 网络访问。
- `VECTOR_STORE_TYPE=none` 使用后端已有的 `NoOpVectorStore`，不启动 pgvector。
- 单机不启动 runner-file。共享工作空间使用同一个 Docker volume。
- runner-gateway 暂不启动，等 API 服务页面迁移时使用独立 profile 验收。
- Compose 依赖预先构建好的 Java JAR 与 `ui-react/dist`，避免每个镜像重复执行 Maven 和 Node 构建。

## 资源上限

| 服务 | 内存上限 |
| --- | ---: |
| MySQL | 768 MB |
| Redis | 256 MB |
| Console | 1280 MB |
| Runtime | 2304 MB |
| Proxy | 1024 MB |
| WebSocket | 384 MB |
| Nginx | 128 MB |

容器上限合计约 6GB，给宿主机、页缓存和突发构建留出余量。上线后仍需以真实负载测量为准。
