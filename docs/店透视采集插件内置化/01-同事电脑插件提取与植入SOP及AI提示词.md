# 同事电脑店透视插件提取与植入工程 SOP（含 AI 提示词）

> 💡 **使用说明**：
> 如果当前开发电脑上没有安装店透视插件，但其他同事的电脑上已经安装并正在使用该插件，请将**本篇文档中的【AI 提示词模板】**直接发送给同事电脑上的 AI 助手（Cursor / Claude / Antigravity / ChatGPT）。AI 助手将全自动协助同事提取插件并置入项目中。

---

## 🎯 核心目标
1. 从同事已安装店透视的 Chrome 中找到该插件的解包文件夹（无需重新下载 crx）；
2. 复制到代码工程的 `resources/extensions/diantoushi` 目录下；
3. 配置打包与启动脚本，使安装包在任何用户的电脑上打开时，都能**自动加载店透视插件**，用户免手动安装！

---

## 🤖 专供同事电脑的 AI 提示词（直接复制给 AI）

````markdown
请帮我在本电脑上提取现有的「店透视」Chrome 扩展插件，并将其集成到电商竞品分析桌面客户端项目中，实现跨平台（Mac/Windows）自动打包与内置加载。

### 一、当前电脑环境探测与插件定位
1. 请根据我的当前操作系统（Mac 或 Windows）自动查找已安装的店透视插件目录：
   - **如果是 macOS**：
     请扫描 `~/Library/Application Support/Google/Chrome/Default/Extensions/` 及其它 Profile 目录；
   - **如果是 Windows**：
     请扫描 `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\`；
2. 扫描方法：检查各扩展文件夹下的 `manifest.json`，匹配 `"name"` 字段包含“店透视”或“diantoushi”的插件目录；
3. 找到版本号最稳定的目录后，将其内部的所有静态文件（含 manifest.json、content_scripts、background、assets、icons 等）完整复制到项目的：
   `<工程根目录>/resources/extensions/diantoushi/`；
4. 复制完成后，请排查并删除无用的 `_metadata` 或临时缓存文件夹，保持解包目录整洁。

### 二、工程打包配置检查（electron-builder.yml）
请检查并修改 `apps/desktop/electron-builder.yml`，在 `extraResources` 中添加：
```yaml
extraResources:
  - from: resources/python
    to: python
  - from: ../../skills
    to: skills
  - from: ../../resources/extensions
    to: extensions
```
确保无论在 Mac 打包还是在 Windows 打包时，`extensions/diantoushi` 都会被完整复制到打包产物的 `Contents/Resources/extensions`（Mac）或 `resources/extensions`（Windows）中。

### 三、跨平台自动挂载逻辑（apps/desktop/src/main/chrome.ts）
请确保桌面端启动 Chrome 实例时注入 `--load-extension` 参数：
```typescript
import { app } from 'electron'
import { join, resolve } from 'node:path'
import { existsSync } from 'node:fs'

export function resolveExtensionPath(): string | null {
  const desktopRoot = resolve(__dirname, '..', '..')
  const extDir = app.isPackaged
    ? join(process.resourcesPath, 'extensions', 'diantoushi')
    : resolve(desktopRoot, '..', '..', 'resources', 'extensions', 'diantoushi')
  return existsSync(join(extDir, 'manifest.json')) ? extDir : null
}
```
当拉起 Chrome 时自动追加命令行参数：
`--load-extension=${extensionPath}` 与 `--remote-debugging-port=9222`。

请先执行扫描并向我汇报找到的店透视插件路径及版本信息！
````

---

## 🛠️ 人工备用速查方案（如果不想用 AI 自动化扫描）

如果同事希望手动提取，可按以下 3 步操作：

### 1. 查找插件 ID
在 Chrome 浏览器地址栏输入：
`chrome://extensions/`
- 右上角打开 **「开发者模式」** 开关；
- 找到 **「店透视」** 插件卡片；
- 记下其 **ID**（例如：`abcdefghijklmnopqrstuvwxyz123456`）和 **版本号**（例如：`1.8.2`）。

### 2. 找到本地文件夹
- **macOS**：
  在终端执行：
  ```bash
  open ~/Library/Application\ Support/Google/Chrome/Default/Extensions/<插件ID>/<版本号>/
  ```
- **Windows**：
  在资源管理器地址栏输入并回车：
  ```cmd
  %LOCALAPPDATA%\Google\Chrome\User Data\Default\Extensions\<插件ID>\<版本号>\
  ```

### 3. 复制到代码工程
把该版本号文件夹里的所有内容，整体复制到本项目根目录的：
`resources/extensions/diantoushi/` 目录下即可！

---

## ⚠️ 跨平台注意事项（Mac 与 Windows 差异）

1. **绝对路径与相对路径转义**：
   - 在 Windows 下传入 `--load-extension` 时，路径中的反斜杠 `\` 建议统一使用正斜杠 `/` 或进行路径转义，避免 Chrome 启动解析参数截断；
2. **多扩展共存兼容**：
   - 如果后续还有其他辅助扩展，`--load-extension` 支持逗号分隔传多个路径（例如 `--load-extension=path1,path2`）；
3. **用户登录态隔离**：
   - 自动加载的扩展与独立 `--user-data-dir` 绑定，首次启动需在弹出的浏览器中登录一次淘宝/店透视，登录凭证会自动保存在桌面端本地数据根中，后续终身免登。
