# ADR-003 双传输统一 SDK

## 元数据（Metadata）

- 状态：Accepted
- 关联架构章节：3. 运行形态；4. 传输与认证语义

## 架构对齐（Architecture Alignment）

本 ADR 对上述相关架构章节具有规范性约束作用。

## 背景（Context）

同一业务能力需同时服务 Web（HTTP API）与 Desktop（IPC），避免前端分叉。

## 决策（Decision）

1. 建立统一 API 抽象，按运行时选择 HTTPS/HTTP 或 IPC。
2. 请求/响应契约仅来源于 `@villanelle/ret-shared/contracts`（源码位于 `shared/src/contracts`）。
3. 错误语义与 envelope 结构在两种传输中保持一致。

## 备选方案（Alternatives）

1. 分别维护 web SDK 与 electron SDK：灵活但会产生漂移。

## 影响（Consequences）

正向影响：
1. 客户端调用一致。
2. 跨运行时回归成本降低。

负向影响：
1. 统一 API 层需要处理两种传输适配细节。

## 回退触发条件（Rollback Triggers）

1. 双传输抽象引起不可接受的性能或可维护性问题。
