# shared README

## 1. 包定位

`shared/` 是跨运行时契约与领域语义的单一事实源。

## 2. 文档入口

1. 本包开发说明：`/shared/README.md`
2. 架构事实与约束：`/docs/架构事实与约束.md`
3. 长期治理目标：`/docs/长期治理目标.md`
4. 待办与改造计划：`/docs/待办与改造计划.md`

## 3. 常用命令 在仓库根目录执行

1. 构建
```bash
pnpm --filter @villanelle/ret-shared build
```

2. 类型检查
```bash
pnpm --filter @villanelle/ret-shared typecheck
```

3. 测试
```bash
pnpm --filter @villanelle/ret-shared test
```

4. 静态检查
```bash
pnpm --filter @villanelle/ret-shared lint
```

## 4. 对外导出入口

1. `@villanelle/ret-shared`
2. `@villanelle/ret-shared/contracts`
3. `@villanelle/ret-shared/contracts/base`
4. `@villanelle/ret-shared/config`
5. `@villanelle/ret-shared/domain`
6. `@villanelle/ret-shared/application`

## 5. 变更约束

1. 契约变更必须先在 `shared` 完成
2. schema 变更必须补回归测试
3. 错误语义变更必须评估跨端影响

## 6. 术语

本节按英文主词 alphabetical 排序，英文在前，中文在后。

### B

1. **Base Contract** - 基础契约
   定义：跨端复用的通用契约定义集合。

### C

1. **Client Error Message Baseline** - 客户端错误语义基线
   定义：供各端复用的统一用户可见错误语义集合。

2. **Contract Drift** - 契约漂移
   定义：同名接口在不同运行时出现结构或语义不一致。

### E

1. **Envelope Helper** - Envelope 辅助器
   定义：构造稳定成功/失败响应结构的共享工具。

### L

1. **Log Redaction** - 日志脱敏
   定义：对密码、令牌、邮箱等敏感字段执行屏蔽的规则体系。

### P

1. **Password Policy** - 密码策略
   定义：仓库级统一密码复杂度要求。

### S

1. **Schema Single Source of Truth** - Schema 单一事实来源
   定义：schema 在 shared 定义并由消费端统一引用的原则。

2. **Security Policy** - 安全策略
   定义：跨端统一的认证相关策略集合。
