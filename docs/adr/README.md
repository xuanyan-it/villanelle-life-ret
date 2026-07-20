# ADR 索引与治理

## 目的

本目录存放 Ret 重构相关的架构决策记录（Architecture Decision Record, ADR）。
每个 ADR 对应一个可追踪的关键技术决策。

## ADR 标准结构

每个 ADR 必须包含：
1. 元数据（Metadata）
2. 架构对齐（Architecture Alignment）
3. 背景（Context）
4. 决策（Decision）
5. 备选方案（Alternatives）
6. 影响（Consequences）
7. 回退触发条件（Rollback Triggers）

## 命名规范

- 文件格式：`ADR-XXX-模块名称.md`

规则：
1. `XXX` 为三位编号。
2. 标题应简短并体现决策点。
3. 已采用 ADR 不建议频繁改名。

## 状态模型

建议状态：
1. Proposed
2. Accepted
3. Superseded
4. Deprecated

若被替代，旧 ADR 标为 `Superseded`，并指向新 ADR。

## ADR 清单（开发顺序）

1. `ADR-001-平台与工作区基线.md`
2. `ADR-002-前后端技术栈基线.md`
3. `ADR-003-传输与统一SDK基线.md`
4. `ADR-004-持久化拓扑基线.md`
5. `ADR-005-契约兼容与版本基线.md`
6. `ADR-006-数据库迁移基线.md`
7. `ADR-007-模型与评估基线.md`
8. `ADR-008-认证与会话基线.md`
9. `ADR-009-运维安全与可观测性基线.md`
10. `ADR-010-交付与发布治理基线.md`
11. `ADR-011-测试与质量门禁基线.md`
12. `ADR-012-幂等与错误语义基线.md`
13. `ADR-013-架构边界与例外治理基线.md`
14. `ADR-014-数据库暴露面与测试环境安全基线.md`

## 变更流程

1. 涉及架构边界变更时，必须新增或更新 ADR。
2. ADR 更新需评审通过后再合并实现。
3. ADR 变更后需同步 `架构事实与约束.md` 与相关治理文档。
4. 例外审批必须包含范围、失效日期与回补计划。
5. 规范更新顺序：`ADR -> 架构事实与约束 -> 待办与改造计划`。







