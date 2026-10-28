---
name: electron-window-test
description: 用真实 Electron 窗口自动测试 SokeClaw/Zework 渲染层（src/renderer），绕过登录、给主进程 IPC 打桩、推送对话流事件、截图并与 HEAD 做几何对比。用户说「测一下窗口」「启动 Electron 测试」「截图看看页面」「页面长得对不对」「Playwright 拉起桌面端」「验证渲染改动」，或改了 src/renderer 需要在真实窗口确认时触发。
---

# 真实 Electron 窗口测试

渲染层要在 Electron 里验：`window.workclaw` 由 preload 注入，普通浏览器打开 `localhost` 没有这座桥。build 过 ≠ 运行无误。

> **不要每次都全量跑窗口测试(用户 2026-10-21 定)。** 整组 40 条要 3 分钟以上，太浪费时间。
> 每次只跑**本次改动牵涉的 spec**(对照下文「改动 → spec 速查」挑;牵涉几处就跑那几条,`-g` 能缩到一条就缩到一条)。
> 提交前、批次收尾、碰到共用文件也一样按改动挑，**不跑整组**。偶发失败先单独重跑那一条确认。
> 单测(node)便宜，批次收尾照旧全量四组。细则见下文「跑哪些测试：分层」。

## 入口怎么选

| 场景 | 做法 |
|---|---|
| 自动化测试 / 截图 | 先 `npm run build:renderer`，Playwright `electron.launch` 拉**打包入口**（`renderer-dist/index.html`）。不设 `WORKCLAW_VITE_DEV_SERVER` 时加载的就是它（`electron/renderer-target.cjs`） |
| 人工看开发页 | `npm run dev`（vite 5173 + Electron，`scripts/start-electron.cjs` 注入 `WORKCLAW_VITE_DEV_SERVER`） |

改了渲染层代码，跑自动化前必须重新 `build:renderer`，否则测的是旧产物。

## 现成范例

`test/e2e-playwright/chat-thread.spec.ts`：线程渲染、输入框写入 / 发送 / 流式回复、斜杠菜单三条用例，下面每个手法都在里面。
`test/e2e-playwright/agent-host.spec.ts`：**不打桩、跑真实执行链**——测试进程起一个本地假模型（Chat Completions SSE），经 `window.workclaw.chatStreamStart(msg, { apiKey, baseUrl, model, sessionId })` 发消息；对话在 agent 宿主进程（utilityProcess）里执行。宿主 pid 从临时 HOME 下 `.zev/logs/main.log` 的 `[agent-host] spawned pid=` 读，`SIGSTOP` 模拟卡死、`SIGKILL` 模拟崩溃。设 `E2E_APP_EXECUTABLE=<.app 里的可执行文件>` 即测打包产物。跑法：`npx playwright test test/e2e-playwright/<文件>.spec.ts`，截图落 `test-results/`（已 gitignore）。

## 跑哪些测试：分层(2026-10-20 用户定;2026-10-21 收紧窗口测试)

**窗口测试(Electron)只跑本次改动牵涉的 spec,不跑整组。** 共用文件改动、批次收尾也一样：按下方速查表挑出受影响的 spec 跑;改动牵涉多处就把那几条都跑上。

| 时机 | 单测(node) | 窗口测试 |
|---|---|---|
| 开发中每改一次 | 只跑相关测试文件 | 相关 spec,或 `-g <用例名>` 只跑那一条 |
| 每次提交前(每个 phase) | 只跑改动相关的核心测试文件;碰到共用文件(`app.react.js`、`main.cjs`、`preload.cjs`、`domain-config.mjs`、`openai-agents-runtime-service.cjs`、`agent-host/*`)也按改到的那段功能挑，**不跑全量**(用户 2026-10-27 定) | 改动牵涉的 spec(共用文件按改到的那段功能挑) |
| 批次收尾 / 发版前 | 全量单测四组(`test/entities`、`test/electron`、`test/app`、`test/e2e`),与改动前失败名单逐条对比，零新增红 | 本批改动牵涉的 spec |

提交说明与任务文档写清本次跑的是哪一层、跑了哪些。

改动 → spec 速查:

| 改的是 | 跑 |
|---|---|
| 对话页 / 输入框 / 消息渲染(assistant-ui、`assistant-content*`) | `chat-thread.spec` |
| 提问卡 / 审批卡 | `interaction-cards.spec` + `agent-host.spec -g "提问\|审批"` |
| 对话执行链、宿主、工具、MCP、连接器运行 | `agent-host.spec` |
| 连接器页、自定义 MCP | `connectors-page.spec` |
| 技能页、技能详情、技能工具 | `skills-page.spec` |
| 专家页、我的专家、导入、输入框专家 | `experts-page.spec` |
| 专家团运行、成员卡 | `expert-team.spec` |
| 模型选择 / 分组、模型目录对账、登录成功、切组织 | `model-routing.spec` |
| 任务看板、项目、任务活动运行(看板新建任务自动运行) | `task-board.spec` |
| 会话列表 / 会话存储(新建、重命名、删除、库里读回(app.db,在后端宿主子进程)、懒加载消息) | `conversations.spec` |

改了渲染层先 `npm run build:renderer` 再跑。

## 标准步骤

1. **临时用户目录 + 临时 HOME**：`--user-data-dir=<mkdtemp>`，`env: { HOME: <同一 mkdtemp>, NODE_ENV: 'test', WORKCLAW_E2E: '1' }`；结束 `rmSync`。状态目录 `~/.zev` 按 `os.homedir()` 定位（`main.cjs` `getWorkclawStateDir`），**不随 `--user-data-dir` 走**：不改 HOME 时，真跑执行链会把会话写进本人 `~/.zev/openai-agents/sessions/`，并在 `wework-device-sync.json` 的 outbox 排队上传到本人账号（2026-10-20 实踩）。
2. **等主窗口**：轮询 `app.windows()` 找 URL 含 `index.html` 的窗口（跳过 splash）。
3. **主进程 IPC 打桩**（在注入登录态之前做）：
   ```ts
   await app.evaluate(({ ipcMain }) => {
     ipcMain.removeHandler('workclaw:auth:organizations');
     ipcMain.handle('workclaw:auth:organizations', () => ({ organizations: [] }));
   });
   ```
   常用桩：

   | 通道 | 桩返回 | 不打会怎样 |
   |---|---|---|
   | `workclaw:auth:organizations` | `{ organizations: [] }` | 假 token 遇 401 → 约 10s 后登出回登录页 |
   | `workclaw:auth:sync-built-in-models` | `{ ok: true }` | 同上 |
   | `workclaw:model-tier:catalog` | `{ ok: false, credentialAvailable: false, required: false }` | 输入框一直「正在加载可用模型…」禁用（这是代码认可的本地模型模式） |
   | `workclaw:skills:projection` | `{ skills: [{ name, description, runtime: 'openai-agents' }] }` | 技能列表为空 |
   | `workclaw:chat:stream:start` | `{ ok: true, streamId: '<固定 id>' }`，可把参数记到 `globalThis` 供断言 | 真的去调模型 |

   通道名查 `electron/preload.cjs` 的 `IPC_INVOKE_METHODS`。只在测试里打桩，生产代码不加测试钩子。

   **后端宿主的通道打不了桩**(5a-7):对话、技能 / 专家 / 套件 / 自定义 MCP / 连接器 / 平台绑定 / 授客凭证提示的通道在后端宿主，渲染层经 MessagePort 直连(表见 `src/renderer/shared/ipc/backend-connection.mjs` 的 `BACKEND_METHOD_CHANNELS`),不在 `ipcMain` 也不在 `window.workclaw` 上。改用真实数据：
   - 技能：`support/seed-skills.ts` 的 `seedSkills(win, [{ name, description }])` 把技能装进临时 HOME 的账本(内置技能也在，别断言总数)。
   - 从测试直接调后端通道 / 收后端事件:`support/backend-probe.ts` 的 `installBackendProbe(win)`(初始化脚本 + 内部 reload,之后要重装依赖页面状态的记录器)→ `backendInvoke(win, 'workclaw:plugins:set-enabled', {...})`、`backendEvents(win, 'workclaw:connectors:event')`。
   - 后端要用的主进程能力(原生对话框、`shell.openExternal` / `openPath`、装技能确认框)仍在主进程执行：照旧 `app.evaluate(({ dialog }) => { dialog.showOpenDialog = ... })` 换掉即可。
4. **注入登录态与数据**（`win.evaluate` 写 localStorage 后 `win.reload()`）：
   - `workclaw:user:v1` = `{ loggedIn: true, modelCredentialReady: true, userId, accessToken: '<假>' ... }`
   - `workclaw:initialAgentSetup:v1` = `'1'`、`workclaw:defaultOpenAIAgentInitialized:v1` = `'1'`（跳过引导）
   - 会话(5a-6 起在后端宿主子进程的 `app.db`):`localStorage` 写 `workclaw:activeConversationId:v1`,再调 `test/e2e-playwright/support/seed-conversations.ts` 的 `seedConversations(win, 会话数组)`(测试进程直接开同一个 `app.db` 先清空再写入，状态目录经生产 IPC `runtimeInfo` 问主进程;先过 `sanitizeConversations` 补默认字段;消息 `{ id, role, text, createdAt, seq }`,agentId 用 `openai-agents:main`),然后 `win.reload()`。验落盘用同文件的 `readStoredMessages(win, 标题)` / `readStoredTitles(win)`(直接读库;5a-7 起对话通道走 MessagePort,不在 `window.workclaw` / `ipcMain` 上，别再从页面调 `conversations*` 或包 `ipcMain._invokeHandlers` 计数，写库计数见 `conversation-stream.spec` 包 `MessagePort.prototype.postMessage`)
5. **推送对话流事件**：
   ```ts
   await app.evaluate(({ BrowserWindow }, payload) => {
     for (const w of BrowserWindow.getAllWindows()) w.webContents.send('workclaw:chat:stream:event', payload);
   }, { streamId, phase: 'delta', delta: '…' });   // 结束：{ streamId, phase: 'done', result: { text } }
   ```
6. **断言 + 收集错误**：监听 `pageerror` 与 `console` error，结尾断言为空；需要时监听 `request` 断言无意外外联。

## 必踩的坑

- **时间巧合**：没打 auth 桩时，前几秒能进对话页、之后被登出。早截图能「通过」不代表稳——断言要等足时间，并连跑多次确认。
- **进场动画**：`.message-row` 有 250ms `message-enter`，刚出现就截图会半透明。截图 / 读 opacity 前等 ~600ms。
- **渲染层日志**：renderer `console.log/warn/error` 经 preload 转发进 `~/.zev/logs/main.log`（`renderer:log`），临时探针日志带唯一前缀，收尾 grep 删净。
- **zsh glob**：`grep --include=*.js`、`renderer-dist/assets/*.js` 这类写法在 zsh 下会报 no matches 或漏文件；JS 产物在 `renderer-dist/assets/js/`。
- **反常结果先验工具**：脚本「全过」与直接跑测试矛盾时，先查脚本本身（例：拷出的模块缺依赖导致整文件加载失败，被误判为通过）。

## 与改造前对照（视觉回归）

肉眼看截图容易漏间距、高度这类差异，用数据比：

1. `git worktree add --detach <scratchpad>/head HEAD`，软链 `node_modules`，在里面 `npx vite build`。
2. 同一脚本、同一份注入数据分别拉 HEAD 与工作区，`getBoundingClientRect()` 量关键节点（如每个 `.message-row` 的 top/h/x/w、`.composer` / `textarea` / 底栏 / 发送按钮），并取关键计算样式。
3. 逐项 diff；有差异先定位原因（例：消息行包进新容器后父级 `gap` 失效；自增高 textarea 空态少一行），修完再比一次，并把关键尺寸写成用例断言。

## Electron 能力速查（实测）

- 沙盒 renderer（`sandbox: true` + `contextIsolation`）下，preload 里 `webUtils.getPathForFile(file)` 能拿到拖拽 / `<input type=file>` 真实文件的本地路径；内存构造的 File 返回 `''`；`File.path` 已为 `null`。
