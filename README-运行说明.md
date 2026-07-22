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

## 启动前端

```bash
cd /Users/shuishoukeke/Desktop/电商竞品分析项目-前后端源码-20260721-135110/app
npm install
npm run dev
```

启动后访问：

```text
http://127.0.0.1:5173/
```

## 说明

- 为了方便管理，没有复制 `node_modules/` 和 `dist/`，需要运行时用 `npm install` 重新安装依赖。
- 本地后端接口逻辑已经在 `app/src/server/` 里。
- 下载脚本和入库脚本也已单独放到 `skills/` 目录，方便后续继续维护。
