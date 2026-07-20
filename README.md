# Ret 单仓项目

Ret 是一个多包单仓 monorepo工程，用于在 Web 与桌面两种运行形态下提供一致的业务能力。

## 文档分工与入口

仓库文档统一以本 README 为入口。

1. 架构事实与强约束：`/docs/架构事实与约束.md`
2. 长期治理目标：`/docs/长期治理目标.md`
3. 改造与待办计划：`/docs/待办与改造计划.md`
4. 架构决策记录索引：`/docs/adr/README.md`
5. 子项目运行说明：
   `/frontend/README.md`、`/server/README.md`、`/electron/README.md`、`/shared/README.md`
6. 术语说明：全局术语在本 README，子项目术语在各子项目 README

推荐阅读顺序：
1. 本 README
2. `/docs/架构事实与约束.md`
3. `/docs/长期治理目标.md`
4. `/docs/待办与改造计划.md`
5. 对应子项目 README

## 工作区拓扑

1. `frontend`：Vite + React 前端运行时
2. `server`：NestJS HTTP 服务端
3. `electron`：Electron 主进程与桌面打包运行时
4. `shared`：跨端共享契约、领域类型、策略与工具
5. `assets/templates`：模板下载资源
6. `assets/models`：worker 源码、模型运行时配置与资产
7. `scripts`：仓库级构建、发布与测试辅助脚本

架构强约束、资产治理和治理规划统一维护在：
1. `/docs/架构事实与约束.md`
2. `/docs/长期治理目标.md`
3. `/docs/待办与改造计划.md`

## 前置依赖

1. Node.js 20+
2. pnpm 10+
3. PostgreSQL `server` 运行必需
4. Playwright 浏览器运行时 建议先执行 `pnpm --filter @villanelle/ret-frontend test:e2e:install`

## 快速启动 Web + Server

1. 安装依赖

```bash
pnpm install
```

2. 配置服务端环境变量

PowerShell 示例：

```powershell
$env:DATABASE_URL="postgres://user:pass@127.0.0.1:5432/Ret"
```

3. 初始化数据库结构 新库必做

```bash
pnpm --filter @villanelle/ret-server db:migrate
```

4. 并行启动前后端

```bash
pnpm dev:web-server
```

默认地址：

1. Frontend：`http://127.0.0.1:5173`
2. Server：`http://127.0.0.1:7001`

## 常用仓库命令

```bash
pnpm repo:typecheck
pnpm repo:lint
pnpm repo:test
pnpm repo:build
```

单运行时命令：

```bash
pnpm dev:frontend
pnpm dev:server
pnpm dev:electron
```

## 测试命令

以下命令在仓库根目录执行：

1. 共享包测试：`pnpm test:shared`
2. 服务端测试：`pnpm test:server`
3. 服务端 E2E：`pnpm test:server:e2e`
4. 前端 E2E：`pnpm test:frontend:e2e`
5. 全链路 E2E：`pnpm test:e2e`

## 构建与发布命令

1. 全量构建：`pnpm repo:build`
2. 前端构建：`pnpm build:frontend`
3. 服务端构建：`pnpm build:server`
4. 桌面端构建：`pnpm build:electron`
5. 桌面端目录包：`pnpm package:electron:dir`
6. 桌面端便携包：`pnpm package:electron:win`
7. 桌面端 NSIS 包：`pnpm package:electron:win:nsis`
8. 桌面端全目标打包：`pnpm package:electron:win:all`

## 故障排查基线

1. `/api/download` 返回 500：检查 `assets/templates/template_zh-CN.csv` 与 `TEMPLATE_DIR`
2. 登录后界面仍阻断：检查 `/api/model/config` 状态码与 payload 结构
3. E2E 启动失败：检查 `DATABASE_URL`、Chrome、端口 `5173` 可用性

## 全局术语

本节按英文主词 alphabetical 排序。术语展示格式统一为英文在前、中文在后。

### A

1. **ALOF** - Automatic Logoff，自动登出
   定义：基于无操作时长触发的自动保护机制。当前默认策略基线为 24 小时。

2. **Auth Guard** - 鉴权守卫
   定义：用于保护敏感接口的统一鉴权门禁组件。

### C

1. **Contract** - 接口契约
   定义：可机器校验的接口定义，包含请求/响应结构与语义约束。

2. **CORS** - Cross-Origin Resource Sharing，跨域资源共享
   定义：跨域访问控制策略；生产环境要求显式白名单。

### D

1. **DDL** - Data Definition Language，数据定义语言
   定义：涉及表、索引、约束等 schema 结构变更的 SQL 语句集合。

2. **DML** - Data Manipulation Language，数据操作语言
   定义：涉及增删改查的数据操作 SQL 语句集合。

### E

1. **E2E** - End-to-End，端到端测试
   定义：验证用户可观察完整调用链行为的测试层级。

2. **Envelope** - 统一响应包裹结构
   定义：承载状态语义、payload 与元信息的统一响应结构。

### H

1. **Health Check** - 健康检查
   定义：服务健康探针接口，当前统一为 `/health`。

2. **HttpOnly Cookie** - 仅 HTTP 可读 Cookie
   定义：浏览器脚本不可直接读取的 Cookie 属性，用于降低 token 暴露风险。

### I

1. **IPC** - Inter-Process Communication，进程间通信
   定义：Electron 中 renderer 与 main 之间的通信机制。

### J

1. **JWT** - JSON Web Token，JSON Web 令牌
   定义：当前访问令牌语义的实现载体。

### M

1. **Migration** - 数据库迁移
   定义：数据库版本化迁移脚本集合，用于 schema 演进。

2. **Mock E2E** - 轻依赖端到端测试
   定义：外部依赖较轻的 E2E 配置，侧重执行速度。

### P

1. **Pino** - 结构化日志库
   定义：服务端生产环境使用的结构化日志实现。

2. **Portable Runtime** - 便携运行时
   定义：随发布产物分发的运行时资源集合 例如模型运行环境。

### R

1. **Real E2E** - 真实依赖端到端测试
   定义：连接真实数据库/worker 的 E2E 配置，侧重部署真实性。

2. **requestId** - 请求唯一标识
   定义：请求级唯一标识，用于日志串联与问题定位。

3. **Runtime Profile** - 运行时画像
   定义：描述传输、存储、一致性、部署等维度能力的运行时描述对象。

### S

1. **Schema** - 结构化校验定义
   定义：数据结构与校验规则定义。

2. **Session** - 会话上下文
   定义：鉴权上下文状态；不同运行形态允许不同实现。

3. **Shared** - 共享包
   定义：`@villanelle/ret-shared`，跨端契约与策略的单一事实来源。

### W

1. **Worker** - 模型工作进程
   定义：负责模型执行/评估的 Python 进程。

2. **WORM** - Write Once Read Many，一次写入多次读取
   定义：不可篡改日志/审计存储语境中的常见原则。



