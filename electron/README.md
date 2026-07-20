# electron README

## 1. 包定位

`electron/` 仅承载桌面运行时壳层与 IPC 主进程能力。

## 2. 文档入口

1. 本包开发说明：`/electron/README.md`
2. 架构事实与约束：`/docs/架构事实与约束.md`
3. 长期治理目标：`/docs/长期治理目标.md`
4. 待办与改造计划：`/docs/待办与改造计划.md`

## 3. 常用命令 在仓库根目录执行

1. 开发启动
```bash
pnpm --filter @villanelle/ret-electron dev
```

2. 构建
```bash
pnpm --filter @villanelle/ret-electron build
```

3. 类型检查
```bash
pnpm --filter @villanelle/ret-electron typecheck
```

4. 单元测试
```bash
pnpm --filter @villanelle/ret-electron test
```

5. E2E 测试
```bash
pnpm --filter @villanelle/ret-electron test:e2e
```

6. 打包
```bash
pnpm --filter @villanelle/ret-electron package:dir
pnpm --filter @villanelle/ret-electron package:win
pnpm --filter @villanelle/ret-electron package:win:nsis
```

## 4. 运行时核心点

1. `bootstrap/paths.ts`：运行目录与 worker 路径解析
2. `ipc/*Handlers.ts`：IPC 能力边界
3. `services/workerManager.ts`：worker 生命周期管理

## 5. 术语

本节按英文主词 alphabetical 排序，英文在前，中文在后。

### A

1. **Auth Session** - 本地会话
   定义：主进程维护的鉴权上下文，用于受保护 IPC 门禁。

### B

1. **Bootstrap** - 启动引导
   定义：路径解析、窗口创建与生命周期绑定阶段。

### H

1. **Handler Factory** - 处理器工厂
   定义：统一封装校验、鉴权与错误映射的 IPC 包装层。

### I

1. **IPC Envelope** - IPC 统一响应结构
   定义：IPC 返回的统一响应结构。

### M

1. **Main Process** - 主进程
   定义：承载系统调用、IPC 与本地编排的核心进程。

### P

1. **Portable Python** - 便携 Python 运行时
   定义：随发布分发的 Python 运行时目录。

2. **Prewarm Worker** - Worker 预热
   定义：在关键时机提前启动 worker 以降低首次调用延迟。

### R

1. **Renderer Process** - 渲染进程
   定义：承载前端 UI 的进程。

### W

1. **Window Guard** - 窗口保护
   定义：生产环境下对窗口行为进行约束的安全策略集合。

2. **Worker Manager** - Worker 管理器
   定义：负责 worker 进程生命周期与就绪状态管理的服务。
