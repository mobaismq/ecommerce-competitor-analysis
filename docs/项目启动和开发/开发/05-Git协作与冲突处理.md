# 05 Git 协作与冲突处理

## 1. 分支模型（以远端实际分支为准）

| 分支 | 角色 |
|---|---|
| `origin/main` | 主干，最终合入目标 |
| `origin/main-dev` | **集成开发线（当前活跃）**，日常开发的基准分支 |
| `origin/dev` | 旧开发分支，不要基于它开发（以团队最新通知为准） |
| `origin/feature/*` | 个人/专题特性分支（如 feature/mobai） |

**日常流程**：

```bash
git pull origin main-dev                 # 1. 先更新基准
git checkout -b feature/<你的名字或主题> main-dev   # 2. 从 main-dev 切特性分支
# ... 开发、小步提交 ...
# 3. 完成后合回 main-dev（团队无特殊要求时优先 PR；紧急小改可直接合并）
```

拿不准合入方向时先问一句，再动 main / main-dev。

## 2. 提交规范

- 格式：`type(scope): 中文描述`，如 `feat(desktop): 图库支持批量导出`、`fix(backend): 登录 Token 过期未刷新`
- 常用 type：`feat` / `fix` / `refactor` / `chore` / `docs`
- 一个提交一个意图；大改动按 Phase 拆小提交
- **提交前门禁**：`pnpm typecheck` + 相关单测通过；Phase 交付前 `pnpm build` 通过
- 永远不提交：`.env`（任何密钥）、`node_modules`、`dist`、本地数据库文件、`rpa_runs/` 等运行时产物，勿 force add

## 3. 冲突处理（按文件类型定点解决）

### 3.1 `pnpm-lock.yaml` 冲突（最常见）

**不要手改 lock 文件**。解法：

```bash
git checkout --theirs pnpm-lock.yaml   # 先取任意一边（theirs/ours 均可）
pnpm install                            # 以两边 package.json 的并集重新生成
git add pnpm-lock.yaml
```

然后 `pnpm typecheck` 确认依赖树没破。

### 3.2 Prisma 迁移目录冲突（backend `prisma/migrations/`）

- 迁移目录按时间戳命名，两个新迁移通常**不冲突、都要保留**：全盘接受双方新文件即可。
- 若同一迁移文件被双方改过：以 main-dev（先合入方）为准，另一个人重新生成新迁移，**禁止修改已应用的迁移**。
- 解完后 `pnpm --filter backend db:migrate` 验证本地库能走通。
- desktop 的迁移（`apps/desktop/prisma/migrations/`）是固定 init 文件，正常开发不应产生冲突；出现即说明有人手改了 init，拉正主修复。

### 3.3 普通代码冲突

1. 优先理解双方意图后合并，**以 main-dev 上的最新设计意图为准**（拿不准看对应 capability/service 的最新 spec 测试）。
2. 仍拿不准就联系对方作者确认，不要盲选「take theirs」。
3. 解完必须跑 `pnpm typecheck` + 相关单测，再继续。

### 3.4 `docs/` 与规范文档冲突

本目录（`docs/项目启动和开发/`）的冲突按「内容最新、描述当前现状」为准合并。

## 4. 同步与回滚建议

- 拉取后如本地起不来，先 `pnpm install`（lock 变了）再 `pnpm --filter backend db:migrate`（schema 变了），最后 `pnpm check-env`。
- 特性分支开发期间定期 `git fetch origin && git rebase origin/main-dev`（或 merge，团队现状两者皆有，保持自己分支内一致即可），减小最终合并冲突面。
- 回滚单个提交用 `git revert <sha>`（生成反向提交），已推送的分支禁止 `reset --force`。
