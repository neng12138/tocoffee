# ToCoffee

单店自提咖啡点单小程序：顾客端（微信小程序 / H5）+ 门店管理端 + NestJS API。

## 当前状态

D1 已完成：Docker PostgreSQL、三端脚手架、`/api/health`、H5/小程序构建均通过。
微信开发者工具的自动导入受 AppID 限制（`touristappid` 被新版 IDE 拒绝），首次导入需手动选择测试号或填入可用 AppID；其余 D1 验收已通过。

## 文档

- [P0 设计文档](docs/superpowers/specs/2026-11-04-tocoffee-design.md)：范围、角色、领域模型、数据模型、API、双端结构、测试与验收
- [P0 实施计划](docs/superpowers/plans/2026-11-04-tocoffee-p0-plan.md)：3 周 15 天排期、每日可演示目标、测试矩阵、演示脚本
- [目录结构规范](docs/architecture/project-structure.md)：三端目录树、分层职责、依赖方向、命名规范
- [每日开发日志规范](docs/dev-log/README.md)：每日收尾七步流程与检查命令
- [开发进度总表](docs/dev-log/PROGRESS.md)：D1–D15 状态、日志链接、commit

## 技术栈

| 端 | 技术 |
|---|---|
| 顾客端 | Vue 3 + uni-app + TypeScript + Pinia（编译微信小程序 / H5） |
| 管理端 | Vue 3 + Vite + Element Plus + Pinia |
| API | NestJS + Prisma + PostgreSQL 16 |
| 运行 | Docker Compose，PostgreSQL 主机端口 **5433**，与 OneSoon 隔离 |

## 本地开发

### 0. 环境要求

- Node.js 24+、npm 11+
- Docker Desktop
- 微信开发者工具（仅小程序走查需要）

### 1. 启动数据库

```powershell
Copy-Item .env.example .env
docker compose up -d
docker compose ps
```

`tocoffee-postgres` 应为 `healthy`，主机端口 `5433`。不要复用 OneSoon 的 5432 容器。

### 2. 启动 API

```powershell
cd apps/api
Copy-Item .env.example .env
npm install
npx prisma generate
npm run start:dev
```

- API：<http://localhost:3000/api>
- 健康检查：<http://localhost:3000/api/health>，返回 `{"status":"ok","db":"up"}`
- Swagger：<http://localhost:3000/api/docs>

### 3. 启动管理端

```powershell
cd apps/admin
npm install
npm run dev
```

打开 <http://127.0.0.1:5173/>。D1 只有工作台占位页和 API 健康检查按钮；登录在 D5 接入，演示账号 `owner / admin123`。

### 4. 启动顾客端

H5：

```powershell
cd apps/passenger
npm install
npm run dev:h5
```

打开 <http://127.0.0.1:5174/>。

微信小程序：

```powershell
cd apps/passenger
npm run dev:mp-weixin
```

首次在微信开发者工具中导入 `apps/passenger/dist/dev/mp-weixin`，AppID 选择「测试号」或填入可用 AppID。导入一次后，后续直接打开最近项目；只有切到 `dist/build/mp-weixin`、删除 `dist` 或换电脑时才需重新导入。

### 5. 一键检查

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/check.ps1
```

脚本检查容器健康、API 构建/测试、管理端构建、顾客端类型检查与空白错误；耗时约 1 分钟。

## 常见问题

- **5432 被占用**：ToCoffee 固定用 5433；不要改回 5432，避免连到 OneSoon。
- **H5 打开失败**：服务绑定在本机回环地址，请用 `http://127.0.0.1:5174/` 或 `http://localhost:5174/`，不要用局域网 IP。
- **微信开发者工具报「不存在此 AppID」**：项目当前用 `touristappid`。在导入窗口选择「测试号」，或在 `apps/passenger/src/manifest.json` 填入自己的小程序 AppID 后重新构建。
- **Prisma 版本**：必须保持 `prisma@6.19.3` 与 `@prisma/client@6.19.3`，不要裸装 `latest`（当前是 8.0.0-rc）。
