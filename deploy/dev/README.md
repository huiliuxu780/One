# ECS 开发部署

该编排针对 4 vCPU、8GB 内存、40GB 磁盘的单机开发环境，不等同于上游生产拓扑。

## 约束

- 只映射 Nginx 的网页端口。
- MySQL、Redis、Console、Runtime、Proxy 和 WebSocket 仅通过 Docker 网络访问。
- `VECTOR_STORE_TYPE=none` 使用后端已有的 `NoOpVectorStore`，不启动 pgvector。
- 单机不启动 runner-file。共享工作空间使用同一个 Docker volume。
- LOCAL 存储目录必须位于共享卷中。默认使用相对路径 `.apboa/storage`（容器内解析为 `/app/.apboa/storage`）；不要使用各容器私有的 `/home`，否则 Console 上传后 Runtime 无法解析或下载。
- runner-gateway 使用独立 `gateway` profile；默认不启动。开发环境不映射其动态应用端口到宿主机，避免 API 绕过 Nginx/TLS 暴露公网。
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
| Gateway（可选） | 768 MB |
| Nginx | 128 MB |

容器上限合计约 6GB，给宿主机、页缓存和突发构建留出余量。上线后仍需以真实负载测量为准。

## 启动

编排只消费预先构建的产物：

```bash
mvn -B -DskipTests package
pnpm --dir ui-react install --frozen-lockfile
pnpm --dir ui-react build
```

复制 `.env.example` 为 `.env`，用随机值替换所有 `replace-me`，并将文件权限设为 `0600`。不要提交 `.env`。MySQL 首次初始化脚本会给业务账号补充 Flyway 所需的单表只读权限，不使用 root 账号运行 Java 服务。

```bash
cd deploy/dev
docker compose --env-file .env build --pull=false
docker compose --env-file .env up -d
docker compose --env-file .env ps
```

API 服务验收时按需启动内部 Gateway：

```bash
docker compose --env-file .env --profile gateway build gateway
docker compose --env-file .env --profile gateway up -d gateway
```

已上线应用的动态端口仅在 `backend` Docker 网络可达。可从 `frontend`
容器或一次性加入该网络的 curl 容器发起真实调用；在配置域名、TLS、鉴权及明确的端口策略前，不发布到公网。

### 更新 React 静态资源

前端使用路由懒加载。直接删除上一版 `assets/` 会让已经打开旧页面的浏览器在继续导航时请求不到旧 chunk。部署时先保存上一版，再把旧的哈希资源合并进新产物（同名文件不覆盖），至少保留一个回滚周期：

```bash
mv ui-react/dist ui-react/dist.previous
mkdir -p ui-react/dist
rsync -a --delete /path/to/new-dist/ ui-react/dist/
cp -an ui-react/dist.previous/assets/. ui-react/dist/assets/
docker compose --env-file deploy/dev/.env -f deploy/dev/docker-compose.yml build frontend
docker compose --env-file deploy/dev/.env -f deploy/dev/docker-compose.yml up -d --no-deps frontend
```

`index.html` 仍应按 Nginx 配置不做长期缓存。确认没有旧会话仍引用上一版资源后，才清理旧 chunk；不要用清理整个 Docker 缓存的方式处理本项目产物，以免影响同机其他应用。

## 访问

默认只监听 ECS 回环地址，避免在没有 TLS 时通过公网明文发送登录口令。在本机建立 SSH 隧道：

```bash
ssh -N -L 18080:127.0.0.1:80 -i /path/to/ecs.pem root@ECS_PUBLIC_IP
```

随后访问 `http://127.0.0.1:18080/react/`。配置域名、TLS 和公网反向代理后，再按需调整 `PUBLIC_BIND_ADDRESS`；不要把 MySQL、Redis 或 Java 内部端口映射到公网。

## 回滚

新 React 前端与旧 Vue 源码并存。停止新入口不会影响数据卷：

```bash
cd deploy/dev
docker compose --env-file .env stop frontend
```

如需回退镜像，先切回已验证的 Git 提交并重新构建应用镜像，再执行 `docker compose up -d`。不要删除 `mysql_data`、`redis_data` 或 `app_data` 数据卷。

2026-10-06 已在开发 ECS 完成 React→Vue→React 实际切换。可执行 Vue 镜像为
`apboa-vue-rollback:20261005-exec`，上一 React 镜像为
`apboa-dev-frontend:rollback-9aac54d`；本次后端与前端切换前镜像另标记为
`rollback-e81ea49-pre`。切换 Vue 时应将它加入
`apboa-dev_backend` 网络，只替换前端容器，不携带也不删除任何数据卷。
恢复 React 后至少检查 `/react/`、登录、Agent/Workflow/会话记录数和工作空间文件数。

2026-10-06 共享 LOCAL 存储默认目录修复发布前保留了三项可执行回滚镜像：
`apboa-dev-frontend:rollback-e7d7f19-preview`、
`apboa-dev-console:rollback-e7d7f19-storage`、
`apboa-dev-runtime:rollback-e7d7f19-storage`。后端回滚时只替换 Console/Runtime
镜像，不删除或重建 `mysql_data`、`redis_data`、`app_data`；恢复后检查两项服务
启动日志、重启计数、登录、会话列表、附件上传与工作空间文件下载。

## React 开发态服务

宿主机无需安装 Node。以下服务加入 `backend` 网络，在容器内安装依赖并启动 Vite，代理目标指向 compose 服务名，可直接对真实后端联调：

```bash
cd deploy/dev
docker compose --env-file .env -f docker-compose.yml -f docker-compose.ui-react-dev.yml up -d ui-react-dev
```

首次启动会在容器内执行 `pnpm install`（源码目录即挂载目录，依赖写入 `ui-react/node_modules`）。访问方式同上，通过 SSH 隧道转发 `127.0.0.1:3031` 后打开 `http://127.0.0.1:3031/`。停止服务：

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.ui-react-dev.yml stop ui-react-dev
```

端到端测试（Playwright）针对该开发服务执行，凭据只经环境变量注入：

```bash
cd ui-react
pnpm exec playwright install chromium
APBOA_E2E_BASE_URL=http://127.0.0.1:3031 APBOA_E2E_USERNAME=... APBOA_E2E_PASSWORD=... pnpm test:e2e
```
