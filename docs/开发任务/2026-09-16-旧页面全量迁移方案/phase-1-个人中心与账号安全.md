# Phase 1 · 个人中心与账号安全

> 归属旧页面（4 个，原均无路由无页面）：AccountInfoPage、ChangePasswordPage、ChangePhonePage、PhoneVerificationPage
> 目标：补齐 `/settings/account-info`、`/settings/change-password`、`/settings/change-phone`、`/settings/verify-phone` 四个真实页面，并收口服务端改密/改手机能力。
> 状态：✅ 已完成（2026-09-17，desktop 渲染层构建 3013 模块通过）

---

- [x] 1.1 收口服务端改密与改手机接口
      现状: `apps/backend/src/auth/auth.controller.ts` 仅 `POST /api/auth/login`（改为新增 `POST /api/auth/change-password`、`POST /api/auth/change-phone`，均 JWT 守卫）；`apps/backend/src/auth/auth.service.ts` 增 `changePassword`（校验原密码 + 重哈希）与 `changePhone`；新增 `dto/change-password.dto.ts`、`dto/change-phone.dto.ts`。
      依据: 架构图-图1 C1；design.md「四、认证与权限」
      验证: `pnpm --filter backend build` ➔ 预期: tsc 编译通过。
      证据: (2026-09-17, `pnpm --filter backend build` 通过，无错误输出)

- [x] 1.2 新增前端个人中心 4 页并挂路由
      现状: `apps/desktop/src/renderer/src/main.tsx` 原无 `/settings/account-info|change-password|change-phone|verify-phone`；新增 `pages/AccountInfoPage.tsx`、`ChangePasswordPage.tsx`、`ChangePhonePage.tsx`、`PhoneVerificationPage.tsx`（Arco 组件）并挂 4 个路由。
      依据: 架构图-图1 A2；design.md「一、业务范围对齐」个人中心边界
      验证: `pnpm --filter desktop build` ➔ 预期: 渲染层构建成功（模块数 3009→3013）。
      证据: (2026-09-17, `pnpm --filter desktop build` 通过，3013 modules，out/renderer 产物生成)

- [x] 1.3 接入个人中心入口与账号信息展示
      现状: 新顶栏 `apps/desktop/src/renderer/src/layouts/AppLayout.tsx` 增设「系统设置-个人中心」入口（`/settings/account-info`）；同时修复顶栏退出按钮引用未定义 `logout` 的现存 bug（补 `useAuth((s)=>s.logout)`）。
      依据: 架构图-图1 A2；页面迁移矩阵 `/settings/account-info`
      验证: `pnpm --filter desktop build` ➔ 预期: 构建通过，账号信息页展示登录态 user 字段。
      证据: (2026-09-17, `pnpm --filter desktop build` 通过)

- [x] 1.4 短信验证码能力位决策与落地
      现状: 旧 PhoneVerificationPage/ChangePhonePage 的发送与验证均为 `console.log` TODO 桩，无真实短信服务。
      依据: tasks.md「方案待修订项」短信验证码
      验证: 决策为「能力位预留」——PhoneVerificationPage 明确标注"未接入短信验证码服务"并提供改密/改绑定手机入口，不伪装可发送验证码；改密/改手机走 JWT 校验（无需短信）即可真实生效。
      证据: (2026-09-17, 决策落定：短信能力位预留，无假功能；改动走 JWT 接口)