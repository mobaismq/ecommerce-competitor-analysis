# 电商竞品分析项目

这个文件夹用于集中管理当前项目的前端、本地后端、店透视 RPA 下载脚本和 MySQL 入库脚本。

## 目录结构

- `app/`：前端项目和 Vite 开发服务
  - `src/app/`：页面和前端业务逻辑
  - `src/server/`：豆包 Ark 调用、报告生成、数据库查询等后端业务模块
  - `package.json`：前端项目依赖和启动命令
  - `.env.local`：本机数据库、模型 Key 等本地配置
- `backend/`：独立 Node 后端服务
  - `server.js`：承接 `/api/auth`、`/api/report`、`/api/product-sets`、`/api/taobao`、`/api/platform`、`/api/store`、`/api/account` 等接口
  - 暂不承接 `/api/rpa`，RPA 仍保留在 Vite 本地开发层
- `skills/diantoushi-product-research/`：店透视 RPA 下载脚本
  - `scripts/run_diantoushi_rpa.py`
  - `scripts/run_diantoushi_rpa_cdp.py`
  - `scripts/import_completed_batch.py`
- `skills/mysql-import/`：店透视导出数据清洗和 MySQL 入库脚本
  - `run_mysql_import.py`
  - `clean_data.py`
  - `load_to_mysql.py`

## 启动后端

```bash
cd /Users/songmeiqin/Documents/电商/backend
npm run dev
```

默认后端地址：

```text
http://127.0.0.1:8787/
```

本地开发默认账号：

```text
账号：admin
密码：admin123
```

生产环境必须配置：

```bash
NODE_ENV=production
ADMIN_USERNAME=admin
ADMIN_PASSWORD=一段足够长的随机密码
SESSION_SECRET=至少32位随机字符串
FRONTEND_ORIGIN=https://你的前端域名
```

生产环境缺少 `ADMIN_PASSWORD` 或 `SESSION_SECRET` 时，后端会拒绝启动。

## 启动前端

```bash
cd /Users/songmeiqin/Documents/电商/app
npm install
npm run dev
```

启动后访问：

```text
http://127.0.0.1:5173/
```

## 说明

- 为了方便管理，没有复制 `node_modules/` 和 `dist/`，需要运行时用 `npm install` 重新安装依赖。
- 前端开发服务会把 `/api/auth`、`/api/report`、`/api/product-sets`、`/api/taobao`、`/api/platform`、`/api/store`、`/api/account` 等接口代理到 `backend`。
- `/api/rpa` 仍在前端 Vite 本地服务中，后续可以再拆成独立 worker；生产模式默认关闭，避免外部触发本机 RPA。
- 后端业务 API 已加管理员登录态校验，登录 Cookie 使用 `HttpOnly`，生产环境需要放在 HTTPS 反向代理后面。
- 下载脚本和入库脚本也已单独放到 `skills/` 目录，方便后续继续维护。
