# ToCoffee

单店自提咖啡点单小程序：顾客端（微信小程序 / H5）+ 门店管理端 + NestJS API。

## 当前状态

D1–D4 已完成：Docker PostgreSQL、三端脚手架、`/api/health`、15 张业务表与初始 seed（5 分类 / 12 商品 / 5 规格组）、顾客/员工 JWT 登录、门店与菜单查询 API，以及顾客端首页、菜单、规格弹层和购物车。
小程序首次需在微信开发者工具手动导入 `apps/passenger/dist/dev/mp-weixin`；导入一次后后续直接打开最近项目。

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

## 品牌资源

- 完整 logo（透明底）：`apps/admin/public/brand/logo.png`；顾客端副本在 `apps/passenger/src/static/logo.png`
- 方形图标：`apps/admin/public/brand/logo-square.png`
- 杯形小标（favicon）：`apps/admin/public/brand/logo-mark.png`
- 原始图片：`docs/assets/brand/tocoffee-logo.jpg`

管理端侧边栏、登录页与顾客端首页均已接入；小程序端使用顾客端 `static/logo.png`。

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
npx prisma migrate deploy
npm run seed
npm run start:dev
```

- `migrate deploy` 应用 `prisma/migrations` 下的迁移；日常改 schema 用 `npx prisma migrate dev`
- `seed` 可重复执行：示例门店、owner、5 分类、12 商品、5 规格组、15 选项
- 演示账号：`owner / admin123`

- API：<http://localhost:3000/api>
- 健康检查：<http://localhost:3000/api/health>，返回 `{"status":"ok","db":"up"}`
- Swagger：<http://localhost:3000/api/docs>

### 2.1 D3 已实现接口

| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
| GET | `/api/store` | 门店信息与营业状态 | 公开 |
| GET | `/api/menu` | 当前门店菜单（分类 + 商品 + 规格） | 公开 |
| GET | `/api/products/:id` | 商品详情 | 公开 |
| POST | `/api/auth/code` | 发送顾客手机验证码 | 公开，5 次/分钟 |
| POST | `/api/auth/login` | 验证码登录，不存在则注册 | 公开，5 次/分钟 |
| GET | `/api/auth/me` | 当前顾客 | Bearer 顾客 token |
| POST | `/api/admin/auth/login` | 员工账号密码登录 | 公开，5 次/分钟 |
| GET | `/api/admin/auth/me` | 当前员工 | Bearer 员工 token |
| POST | `/api/admin/auth/change-password` | 修改当前员工密码 | Bearer 员工 token |

本地 `.env` 的 `AUTH_DEV_MODE=true` 时，`POST /api/auth/code` 会在响应里返回 `devCode`，用于 mock 短信登录；生产必须关闭。顾客 token 默认 7 天，员工 token 默认 12 小时，两者使用不同 secret 与 audience，不能互用。

### 3. 启动管理端

```powershell
cd apps/admin
npm install
npm run dev
```

打开 <http://127.0.0.1:5173/>。D3 管理端 UI 仍是占位页，登录页与门店/菜单管理在 D5 接入；API 已提供员工登录接口，演示账号 `owner / admin123`。

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

#### D4 已实现

- 首页：品牌 hero、门店营业状态、今日营业时间、制作时长、热销推荐。
- 菜单：左侧分类 + 右侧商品滚动联动，支持加载/失败/空态、售罄保留并禁用加购。
- 规格：底部弹层按规格组渲染，支持默认项、必选/多选、上下限、价格实时计算、数量 1–20。
- 购物车：Pinia + `uni.setStorageSync`，同商品同规格合并，支持改数量、删除、清空、合计；「去结算」当前为 D8 前的占位按钮。
- 商品图由 API 的 `/uploads` 静态目录提供；H5 走 Vite `/api` 代理，小程序开发期直连 `http://127.0.0.1:3000/api`。

### 5. 一键检查

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev/check.ps1
```

脚本检查容器健康、API 构建/静态检查/单测/e2e、管理端构建、顾客端类型检查与空白错误；耗时约 1–2 分钟。

## 常见问题

- **5432 被占用**：ToCoffee 固定用 5433；不要改回 5432，避免连到 OneSoon。
- **H5 打开失败**：服务绑定在本机回环地址，请用 `http://127.0.0.1:5174/` 或 `http://localhost:5174/`，不要用局域网 IP。
- **微信开发者工具报「不存在此 AppID」**：构建默认写 `touristappid`，会被新版 IDE 拒绝。手动导入时选择可用 AppID（本机已用 `wx7c9cd90fc226004b`）；或在 `apps/passenger/src/manifest.json` 填入自己的小程序 AppID 后重新构建。
- **Prisma 版本**：必须保持 `prisma@6.19.3` 与 `@prisma/client@6.19.3`，不要裸装 `latest`（当前是 8.0.0-rc）。
