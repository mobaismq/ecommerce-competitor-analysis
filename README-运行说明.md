# 电商竞品分析项目

这个文件夹用于集中管理当前项目的前端、本地后端、店透视 RPA 下载脚本和 MySQL 入库脚本。

## 目录结构

- `app/`：前端项目和本地接口代码
  - `src/app/`：页面和前端业务逻辑
  - `src/server/`：本地 API、豆包 Ark 调用、报告生成、数据库查询等后端逻辑
  - `package.json`：前端项目依赖和启动命令
  - `.env.local`：本机数据库、模型 Key 等本地配置
- `skills/diantoushi-product-research/`：店透视 RPA 下载脚本
  - `scripts/run_diantoushi_rpa.py`
  - `scripts/run_diantoushi_rpa_cdp.py`
  - `scripts/import_completed_batch.py`
- `skills/mysql-import/`：店透视导出数据清洗和 MySQL 入库脚本
  - `run_mysql_import.py`
  - `clean_data.py`
  - `load_to_mysql.py`

## 启动

### 1. 启动后端服务（独立 Node 服务，默认端口 8787）

```bash
cd app
npm install
npm run server
```

### 2. 启动前端（Vite，自动把 /api 代理到 8787 后端）

```bash
cd app
npm run dev
```

启动后访问前端：

```text
http://localhost:5173/
```

> 说明：后端 API 已拆分为独立 Node HTTP 服务，代码在 `app/server/`（`index.js` 入口 + `apiHandler.js` 路由），通过 Vite `server.proxy` 转发 `/api`。

## 说明

- 为了方便管理，没有复制 `node_modules/` 和 `dist/`，需要运行时用 `npm install` 重新安装依赖。
- 本地后端接口逻辑已经在 `app/src/server/` 里。
- 下载脚本和入库脚本也已单独放到 `skills/` 目录，方便后续继续维护。
