# Phase 2：认证与权限

- [ ] 2.1 实现长效 JWT Access Token 登录、登出和 401 处理
      现状: 旧后端使用 Cookie Session，新方案要求长效 Access Token + localStorage
      依据: 图1-B1、架构图「认证状态机」、design.md「认证与权限」
      验证: `curl -i -X POST http://127.0.0.1:8787/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"<测试密码>"}'` ➔ 预期: 返回 200 和 Access Token，失效 Token 请求返回 401
      证据: 

- [ ] 2.2 实现语义权限、租户、部门和店铺范围校验
      现状: 旧权限逻辑分散在 `app/src/server/roleManagement.js`、`deptManagement.js` 等文件
      依据: 图1-B2、design.md「多租户设计」「权限」
      验证: `node test_permission_scope.js` ➔ 预期: 有权限返回 200，无权限返回 403，跨租户资源不可读取
      证据: 

- [ ] 2.3 实现前端认证 Store、localStorage 持久化和 Axios 拦截器
      现状: 新 frontend 认证 Store 缺失，旧页面不作为新状态管理基线
      依据: 图1-B1、架构图「认证」
      验证: `pnpm --filter frontend build` 并执行浏览器登录后刷新页面 ➔ 预期: Token 写入 localStorage，刷新后仍可请求受保护接口，401 后清态跳登录页
      证据: 

- [ ] 2.4 实现前端路由、菜单和按钮权限控制
      现状: 新前端权限组件和路由守卫缺失
      依据: 图1-B2、design.md「权限」
      验证: `node test_frontend_permissions.js` ➔ 预期: 无权限菜单/按钮不可见，直接访问受保护路由被拦截
      证据: 
