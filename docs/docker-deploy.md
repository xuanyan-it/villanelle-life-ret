# Docker Compose 部署（测试环境）

本文件面向你的“测试环境服务器 + GitHub Actions（self-hosted runner）”部署流程，使用 `docker-compose.yml` 一次性启动：

- `postgres`（数据库）
- `api`（NestJS 后端，含 Python worker 的运行依赖与模型/模板资源）
- `api-migrate`（一次性执行 `pnpm --filter @villanelle/ret-server db:migrate`）
- `web`（Nginx：托管前端静态资源，并反代 `/api/*` 与 `/health`）

## 1. 准备环境变量

`docker-compose.yml` 会读取仓库根目录的 `.env` 文件（Docker Compose 默认行为）。

在仓库根目录创建 `.env`，至少包含：

```env
POSTGRES_PASSWORD=replace_me
JWT_SECRET=replace_me_with_16_chars_or_more
```

说明：

- `POSTGRES_DB` 默认是 `ret_service`
- `web` 对外端口是 `80`（即容器内的 Nginx）
- `api` 使用 `NODE_ENV=development`，避免生产环境下对 HTTPS 的强制校验，并确保鉴权 Cookie 的 `secure=false`
- **安全（必读）**：本 compose 的 `db` 应**仅**在 Docker 网桥内供 `api` 使用，**不要**给该 `db` 增加公网 `ports` 映射。若你另行部署**独立的 E2E 专用** Postgres，并单独映射例如 `15432:5432` 供外网 CI 连接，须与主栈库分离实例与口令、使用高熵专用密码；换端口不能防扫描，仍建议安全组限源 IP 或改为隧道的方案。详见 `docs/adr/ADR-014-数据库暴露面与测试环境安全基线.md`。

## 2. 本地/服务器手动启动

在仓库根目录执行：

```bash
docker compose up -d db
docker compose run --rm api-migrate
docker compose up -d api web
```

健康检查：

```bash
curl -fsS http://127.0.0.1/health
```

如果健康检查失败，优先查看日志：

```bash
docker compose logs --no-color api web
docker compose logs --no-color api-migrate
```

## 3. GitHub Actions（自托管 Runner）自动部署

工作流：`.github/workflows/deploy.yml`

部署步骤（大致顺序）：

1. `docker compose down --remove-orphans` 停止旧容器
2. `docker compose build` 构建 `api`/`web` 镜像（`api` 会安装 Python 模型依赖，可能较慢）
3. `docker compose up -d db`
4. `docker compose run --rm api-migrate` 执行数据库迁移
5. `docker compose up -d api web`
6. `curl http://127.0.0.1/health` 做重试健康检查

需要在 GitHub 仓库配置的 Secrets：

- `POSTGRES_PASSWORD`
- `JWT_SECRET`

## 4. 常见故障排查

1. `api-migrate` 失败
   - 查看：`docker compose logs --no-color api-migrate`
   - 常见原因：`DATABASE_URL` 指向错误、或容器内依赖未安装成功（`docker/api/Dockerfile` 会安装 Python + Node 依赖）

2. `/health` 返回失败或超时
   - 查看：`docker compose logs --no-color web api`
   - 常见原因：`web` 反代没连上 `api`，或 `api` 启动失败（例如 schema 未迁移）

3. 登录/鉴权 Cookie 问题
   - 本方案将 `NODE_ENV=development` 写死在 `docker-compose.yml`，用于测试环境的 HTTP 部署。
   - 若你改成 `NODE_ENV=production`，后端会要求 HTTPS（会影响 Cookie `secure` 行为与请求可用性）。

4. 模型/模板资源缺失
   - `api` 会从容器内路径 `/app/server/assets/models` 与 `/app/server/assets/templates` 读取。
   - 若缺失，通常会看到与 `model.config.json not found` 或模板下载相关的错误。

## 5. 安全应急处置后自检（宿主机 / 容器）

在怀疑或处置过数据库相关入侵后，可在**服务器上**（非本仓库内）执行下列检查，确认无常见残留。路径与容器名按现场调整。

```bash
# 是否仍将 Postgres 暴露到所有接口（应无或仅 127.0.0.1）
docker ps --format "table {{.Names}}\t{{.Ports}}"

# 进入数据库容器后：/tmp 下可疑可执行文件或冒充名进程
docker compose exec db sh -c "ls -la /tmp; ps aux"

# 宿主机侧 SSH 异常登录（示例，发行版路径可能为 /var/log/auth.log）
sudo journalctl -u ssh --since "7 days ago" | grep -E "Accepted|Failed"
```

若发现陌生二进制、持续高 CPU 的短名称进程或与业务无关的 `/tmp/init` 类文件，按安全事件流程隔离、取证与重建，并复盘是否符合 ADR-014。

