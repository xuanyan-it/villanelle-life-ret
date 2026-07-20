# frontend README

## 1. 包定位

`frontend/` 仅承载前端渲染与交互编排。

## 2. 文档入口

1. 本包开发说明：`/frontend/README.md`
2. 架构事实与约束：`/docs/架构事实与约束.md`
3. 长期治理目标：`/docs/长期治理目标.md`
4. 待办与改造计划：`/docs/待办与改造计划.md`

## 3. 运行前提

1. Node.js 20+
2. pnpm 10+
3. 仓库根目录已执行 `pnpm install`

## 4. 常用命令 在仓库根目录执行

1. 开发启动
```bash
pnpm --filter @villanelle/ret-frontend dev
```

2. Web 构建
```bash
pnpm --filter @villanelle/ret-frontend build
```

3. Electron 目标构建
```bash
pnpm --filter @villanelle/ret-frontend build:electron
```

4. 类型检查
```bash
pnpm --filter @villanelle/ret-frontend typecheck
```

5. 单元测试
```bash
pnpm --filter @villanelle/ret-frontend test
```

6. E2E 测试
```bash
pnpm --filter @villanelle/ret-frontend test:e2e
```

## 5. 目录结构

1. `src/api`：传输适配层
2. `src/store`：Redux 状态模块
3. `src/components`：视图组件
4. `src/runtime`：运行时策略
5. `src/platform`：平台能力解析
6. `__e2e__`：Playwright 场景

## 6. 本包约束

1. 开发与 E2E 默认端口基线为 `5173`
2. 健康检查失败时阻断登录与工作区渲染
3. `shared` 构建是类型解析稳定性的前置条件

## 7. 术语

本节按英文主词 alphabetical 排序，英文在前，中文在后。

### A

1. **API Adapter** - API 适配层
   定义：将统一 API 调用映射到 Web HTTP 或 Electron IPC 实现的抽象层。

### H

1. **Health Polling** - 健康轮询
   定义：按固定间隔执行后端可用性探测的机制。

### L

1. **Login Status** - 登录状态
   定义：用于界面门控的前端认证状态机输出。

### M

1. **Model Config Loading** - 模型配置加载
   定义：登录后读取模型配置并决定工作区放行与否的阶段。

### N

1. **Notification Slice** - 通知状态域
   定义：集中管理全局通知事件的 Redux 模块。

### P

1. **Platform Runtime** - 平台运行态
   定义：用于判定当前运行于 Web 还是 Electron 的能力解析结果。

### R

1. **Record Workspace** - 记录工作台
   定义：承载记录查询与变更操作的主界面区域。

### S

1. **Service Down State** - 服务不可用态
   定义：健康检查失败后激活的前端阻断渲染状态。
