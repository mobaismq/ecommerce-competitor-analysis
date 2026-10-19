# 店透视采集代码接入说明

代码来源：用户提供的 `diantoushi-scraper-share-20261016.zip`，2026-10-16 接入当前 main-dev 工作副本。包内 Python/AppleScript 采集、清洗、可选 MySQL 工具保留在 `skills/` 相应目录；未复制账号、密钥或历史采集结果。

## 当前入口

「AI数据采集 → 开始采集」通过 Electron 主进程运行 `skills/diantoushi-product-research/scripts/run_desktop_collection.py`。该适配器调用分享包的 Mac 完整版采集器；关键词、竞品数量、价格区间、翻页深度、速度档位均作为命令行参数传入，不拼接 shell 命令。

采集器的真实 stdout/stderr 持续追加到当前任务 `run.log`；完成后适配器输出单行 JSON，包含导出文件、结构化商品和数量统计。主进程将商品、SKU、问大家、评价写入本地 SQLite 的 CollectionJob/ProductSnapshot 及关联快照表，分析报告按相同关键词即可读取。原始商品字段、图片侧写、导出目录保存在 ProductSnapshot.rawJson.sourceData；Excel 和图片文件保存在任务目录。

该页面不调用旧 MySQL 建表/导入器。源码包的 MySQL 工具继续保留供单独使用，旧 CDP 版本也保留；Windows 批量采集未接入本页面，会明确报错，不会静默退化为单商品。

## 本机准备

1. macOS、Google Chrome，安装店透视插件并登录自己的淘宝/天猫和店透视账号。
2. Chrome 菜单「查看 → 开发者 → 允许来自 Apple 事件的 JavaScript」。
3. 根据 macOS 提示，为运行应用/终端配置控制 Chrome/System Events 的自动化权限、辅助功能权限。应用不会自动修改系统授权。
4. 安装 Apple Command Line Tools（Swift）；Chrome 下载目录使用 Downloads，关闭每次下载询问。
5. 运行采集时保持电脑解锁，避免同时操作浏览器或启动另一个采集器。验证码/风险页面由采集器停止处理，需人工完成后重新开始。

开发时安装 Python 依赖：`apps/desktop/resources/python/bin/python3 -m pip install -r apps/desktop/requirements.txt`。

## 数据与停止行为

一件商品也走批量目录格式，避免主数据落到桌面散乱目录。任务输出在配置的数据根的 `ecommerce/collections/<jobId>/`，当前本机启动脚本把根设在项目的 `apps/desktop/data/runtime/`。

「停止」会标记取消并终止 Python 进程组（包括它启动的 AppleScript/Swift 子进程）。异步退出期间仍锁定当前任务，避免两个采集器同时控制 Chrome。取消状态不会被后续异常覆盖成失败；下载失败、无商品数据不能标为成功。部分 SKU/问大家/评价/图片缺失会保留已有数据并在日志标记，不生成替代内容。

## 验证范围

Python 离线测试覆盖 XLSX 清洗、销量/销售额单位、SKU/问答/评价/追评、图片元数据、部分数据与空目录。桌面端测试覆盖参数传递、进度流、本地入库、报告读取与取消；数据在隔离临时 SQLite 中，不写入用户业务库。另执行 TypeScript 检查与桌面构建。

尚未以真实淘宝/店透视账号执行在线采集；插件界面、登录和系统授权需在首次真实任务时确认。
