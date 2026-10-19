# GitHub Actions 自动化部署（CI/CD）方案

> 目标：当开发者将代码推送到 `main` 分支时，GitHub 自动触发工作流，通过安全 SSH 远程连接到腾讯云服务器，自动拉取最新代码、安装依赖、编译、执行数据库迁移，并让 PM2 无缝平滑重启服务。

---

## 1. 自动化流水线流程图

```
[开发者本地] ──git push──> [GitHub 仓库: main 分支]
                                   │
                                   ▼ 触发 Webhook
                      [GitHub Actions Runner]
                                   │
                                   │ 1. 验证 SSH 密钥 (Secrets)
                                   │ 2. 建立加密通道连接腾讯云 118.25.40.19
                                   ▼
                      [腾讯云服务器 118.25.40.19]
                                   │
                                   ├──> 1. git pull origin main (拉取最新代码)
                                   ├──> 2. pnpm install (同步最新依赖)
                                   ├──> 3. pnpm --filter backend build (编译后端产物)
                                   ├──> 4. prisma migrate deploy (自动化表结构升级)
                                   └──> 5. pm2 reload backend (零中断平滑热重启)
```

---

## 2. GitHub 仓库 Secrets 配置（一次性配置）

在 GitHub 仓库页面打开：
**Settings** ➔ **Secrets and variables** ➔ **Actions** ➔ **New repository secret**，添加以下 3 个配置项：

| Secret 名称 | 填入的值 | 说明 |
|---|---|---|
| **`SERVER_HOST`** | `118.25.40.19` | 腾讯云服务器公网 IP |
| **`SERVER_USER`** | `root` | 登录用户名 |
| **`SERVER_SSH_KEY`** | 本地私钥全部内容（`cat ~/.ssh/id_ed25519` 后的内容） | 用于 GitHub Actions 登录服务器鉴权 |
| **`SERVER_PORT`** | `22` | SSH 端口（可选，默认 22） |

> ⚠️ **关于 `SERVER_SSH_KEY` 的获取与权限**：
> 1. 在本地 Mac 终端运行：
>    ```bash
>    cat ~/.ssh/id_ed25519
>    ```
> 2. 复制完整的输出（包含 `-----BEGIN OPENSSH PRIVATE KEY-----` 和 `-----END OPENSSH PRIVATE KEY-----`）。
> 3. 粘贴到 GitHub Actions 的 Secret `SERVER_SSH_KEY` 中。GitHub 会对其进行强加密，任何人无法再读取明文。
> 4. 因服务器 `/root/.ssh/authorized_keys` 中已有该密钥的公钥，GitHub Actions 凭此私钥即可建立安全连接。

---

## 3. GitHub Actions 工作流文件定义

在项目根目录创建 `.github/workflows/deploy.yml`（已自动为您创建）。

---

## 4. 首次使用前的服务器前置准备

在 GitHub 首次触发自动部署前，请确保服务器上已经**克隆了仓库并配置了 `.env`**：

1. 服务器上存在 `/var/www/ecommerce-app` 目录；
2. 服务器该目录配置了正确的 remote 指向本仓库；
3. `/var/www/ecommerce-app/apps/backend/.env` 已创建且填写好数据库等敏感参数（由于 `.env` 包含线上密码，属于安全隐私，**绝不通过 Git 传输**，由服务器本地持久维护）。

---

## 5. 验证与排查

1. 当代码 push 到 `main` 分支后，进入 GitHub 仓库的 **Actions** 标签页，可以看到正在运行的 `Deploy to Tencent Cloud` 流水线。
2. 点击进入工作流可查看详细的执行步骤与实时日志。
3. 若出现某一步失败，工作流会及时标红报警，且不会中断旧的服务进程（PM2 会继续保持现有版本的运行）。
