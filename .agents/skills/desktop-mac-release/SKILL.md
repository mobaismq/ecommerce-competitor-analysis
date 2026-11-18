---
name: desktop-mac-release
description: 在 macOS 上一次性打包 M 系列 (arm64) 与 Intel 系列 (x64) 桌面端体验包 (.dmg)，明确产物交付清单与未签名安装避坑指南。当用户要求"打 Mac 包"、"同时打 M 系列和 Intel 包"、"打包发给用户体验"时触发。
---

# macOS 双架构本地打包与分发指南

本 Skill 用于在**单台 Mac（推荐 Apple Silicon + Rosetta 2）**上同时打出适用于 **M 系列芯片（arm64）** 和 **Intel 芯片（x64）** 的两个桌面端 `.dmg` 安装包，用于发给内部或种子用户体验。

---

## 一、为什么不能直接用一行 `electron-builder --mac --arm64 --x64`？

本项目桌面端包含两类**架构强绑定**的原生运行时资产，如果直接同时传 `--arm64 --x64` 会导致其中一个架构包在用户电脑上启动报错：
1. **内置 Python 运行时**（`apps/desktop/resources/python/`）：`arm64` 和 `x64` 必须分别下载对应架构的 `python-build-standalone` 并执行 `pip install`。
2. **Prisma SQLite 引擎**（`apps/desktop/src/generated/prisma/`）：`arm64` 需 `libquery_engine-darwin-arm64.dylib.node`，`x64` 需 `libquery_engine-darwin.dylib.node`。

因此必须**分架构依次准备运行时、生成引擎并打包**，最后恢复本机开发环境的运行时。

---

## 二、前置条件

1. 当前机器为 **macOS**。
2. 若在 **M 系列 Mac** 上顺带打 **Intel (`x64`) 包**，需已安装 **Rosetta 2**（脚本会自动检测；若未安装可执行 `softwareupdate --install-rosetta --agree-to-license`）。
3. 打包前建议先确认代码检查通过：
   ```bash
   pnpm typecheck
   ```

---

## 三、一键打包命令

在仓库根目录执行配套脚本：

```bash
# 1. 同时打 M 系列 (arm64) + Intel (x64) 两个安装包（推荐）
node .agents/skills/desktop-mac-release/scripts/build_mac_dual.mjs

# 2. 如果只想单打某一个架构：
node .agents/skills/desktop-mac-release/scripts/build_mac_dual.mjs --arch=arm64
node .agents/skills/desktop-mac-release/scripts/build_mac_dual.mjs --arch=x64
```

> **脚本会自动完成**：
> 1. 编译前端与主进程代码（`pnpm build`）并准备店透视浏览器扩展（`pnpm prepare-extension`）；
> 2. 分别切换 `resources/python` 和 Prisma 引擎，依次打包 `--arm64` 与 `--x64` 的 `.dmg`（关闭代码签名自动探测 `CSC_IDENTITY_AUTO_DISCOVERY=false`）；
> 3. 打包完成后自动恢复本机架构的 Python 和 Prisma 引擎，不影响日常 `pnpm dev`。

---

## 四、发哪个文件给用户？（交付物清单）

打包产物全部位于 **`apps/desktop/dist/`** 目录下：

| 产物 | 适用用户 | **是否发给用户** |
| :--- | :--- | :--- |
| **`电商竞品分析-<版本号>-arm64.dmg`** | M1 / M2 / M3 / M4 等 **M 系列芯片 Mac** | ⭐ **发这个（M 系列用户）** |
| **`电商竞品分析-<版本号>-x64.dmg`** | **Intel 芯片老款 Mac** | ⭐ **发这个（Intel 用户）** |
| `mac-arm64/`、`mac/` 目录下的 `.app` | 解包后的绿色目录 | ❌ **不要发！** 微信/网盘压缩传输极易丢失可执行文件权限，导致运行报 `Permission denied`。 |
| `*.blockmap`、`latest-mac.yml` | 自动更新元数据 | ❌ **不要发！** |

> **如何区分用户是哪款 Mac？**  
> 让用户点击屏幕左上角 ** 苹果图标 → 关于本机**：  
> - 看到“芯片：Apple M1/M2/M3/M4” ➔ 发 **`-arm64.dmg`**  
> - 看到“处理器：Intel ...” ➔ 发 **`-x64.dmg`**

---

## 五、发给用户后必附的注意事项（防拦截指南）

由于本地打包**未配置 Apple 开发者企业签名与公证**，用户在 macOS 上首次打开时会被系统安全机制拦截。发包时请一并附上下述说明：

1. **安装方式**：双击 `.dmg` 后，把「电商竞品分析」图标拖入右侧 `Applications（应用程序）` 文件夹，**不要直接在打开的磁盘镜像里运行**。
2. **首次打开被拦截（提示“无法检查是否包含恶意软件”或“来自身份不明的开发者”）**：
   - 打开 **访达（Finder）→ 应用程序**；
   - **按住 `Control` 键点击（或右键点击）**「电商竞品分析」→ 选择 **“打开”**；
   - 在弹窗中点击 **“仍要打开”**（仅首次需要，之后可直接双击打开）。
3. **极端情况（提示“文件已损坏，无法打开，应该将它移到废纸篓”）**：
   - 打开 Mac **终端（Terminal）**，粘贴执行以下命令解除系统隔离属性即可：
     ```bash
     xattr -cr "/Applications/电商竞品分析.app"
     ```
4. **运行环境要求**：
   - 若用户使用竞品采集功能，电脑需已安装 **Google Chrome**（或 Edge）。
   - 如果用户不清楚自己电脑的芯片类型，可先查看“关于本机”；若装错架构，App 可能无法启动或闪退。

