# server README

## 1. 包定位

`server/` 是 Web 形态下的 HTTP 运行时。

## 2. 文档入口

1. 本包开发说明：`/server/README.md`
2. 架构事实与约束：`/docs/架构事实与约束.md`
3. 长期治理目标：`/docs/长期治理目标.md`
4. 待办与改造计划：`/docs/待办与改造计划.md`

## 3. 运行前提

1. PostgreSQL 可用
2. `DATABASE_URL` 配置有效
3. schema migration 已执行
4. 模型与模板运行资源可访问

## 4. 常用命令 在仓库根目录执行

1. 开发启动
```bash
pnpm --filter @villanelle/ret-server dev
```

2. 构建
```bash
pnpm --filter @villanelle/ret-server build
```

3. 运行构建产物
```bash
pnpm --filter @villanelle/ret-server start
```

4. 类型检查与静态检查
```bash
pnpm --filter @villanelle/ret-server typecheck
pnpm --filter @villanelle/ret-server lint
```

5. 测试
```bash
pnpm --filter @villanelle/ret-server test
pnpm --filter @villanelle/ret-server test:e2e:mock
pnpm --filter @villanelle/ret-server test:e2e:real
pnpm --filter @villanelle/ret-server test:e2e
```

6. 迁移
```bash
pnpm --filter @villanelle/ret-server db:migrate
pnpm --filter @villanelle/ret-server db:generate
```

## 5. 配置基线

1. `DATABASE_URL` 必需
2. `JWT_SECRET` 生产必须显式配置
3. `JWT_EXPIRES_IN` 格式受限且 <= 24h
4. `CORS_ORIGINS` 生产必需
5. `MODEL_ROOT`、`TEMPLATE_DIR`、`TEMPLATE_FILENAME`
6. 日志变量 目录、文件、级别、轮转

## 6. 术语

本节按英文主词 alphabetical 排序，英文在前，中文在后。

### A

1. **AllExceptionsFilter** - 全局异常过滤器
   定义：统一异常响应结构与生产脱敏语义的组件。

2. **Auth Cookie** - 鉴权 Cookie
   定义：承载访问令牌的 HttpOnly Cookie，名称由 `AUTH_COOKIE_NAME` 控制。

### C

1. **Controller** - 控制器
   定义：HTTP 请求入口层，负责参数接收、服务调用与响应输出。

2. **CORS_ORIGINS** - 跨域白名单配置项
   定义：生产环境跨域白名单变量。

### G

1. **Guard Strict Mode** - 严格鉴权模式
   定义：未携带有效凭证时拒绝访问受保护接口的模式。

### L

1. **Log Rotation** - 日志轮转
   定义：按阈值切分日志并执行历史保留清理的机制。

2. **LoggingInterceptor** - 日志拦截器
   定义：请求级日志输出组件。

### M

1. **Migration Baseline** - 迁移基线
   定义：新库初始结构对应的首个 migration 状态。

2. **Model Module** - 模型模块
   定义：提供模型配置与运行时画像接口的模块。

### P

1. **Persistence Repository** - 持久化仓储
   定义：数据库访问抽象与实现集合。

### R

1. **RequestIdMiddleware** - 请求 ID 中间件
   定义：为每个请求注入唯一标识的中间件。

2. **Runtime DDL Forbidden** - 运行时禁 DDL
   定义：禁止应用运行期自动建表的治理策略。

### Z

1. **ZodValidationPipe** - Zod 校验管道
   定义：基于共享 schema 的输入校验组件。
