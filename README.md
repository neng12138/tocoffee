# ToCoffee

单店自提咖啡点单小程序：顾客端（微信小程序 / H5）+ 门店管理端 + NestJS API。

## 当前状态

D1–D12 已完成：Docker PostgreSQL、三端脚手架、`/api/health`、15 张业务表与初始 seed（5 分类 / 12 商品 / 5 规格组）、顾客/员工 JWT 登录、门店与菜单查询 API、顾客端首页/菜单/规格弹层/购物车、管理端登录/分类/商品/规格 CRUD/图片上传、服务端 quote 定价与金额单测、创建待支付订单（幂等 / 价格变化检测 / 预约释放时间）、mock 支付/取餐码/订单查询与取消、顾客端登录/结算/支付结果页，以及管理端订单看板（接单/出杯/确认取餐/拒单退款、预约 Tab、5 秒轮询与新单提示音）。D10 增加支付超时取消、预约单释放与打烊 `NO_SHOW` 定时任务；D11 增加管理端工作台统计与门店设置；D12 增加顾客端订单列表与详情、按状态分组、5 秒进度轮询与再来一单。
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

本地 `.env` 的 `AUTH_DEV_MODE=true` 时，`POST /api/auth/code` 会在响应里返回 `devCode`，用于 mock 短信登录；生产必须关闭。顾客 token 默认 7 天，员工 token 默认 24 小时，两者使用不同 secret 与 audience，不能互用。

### 2.2 D5 管理端接口

全部需要员工 Bearer token；数据按当前员工的 `storeId` 隔离。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST | `/api/admin/categories` | 分类列表 / 新建 |
| PATCH / DELETE | `/api/admin/categories/:id` | 修改 / 归档 |
| GET / POST | `/api/admin/products` | 商品列表（支持分类、状态、关键词）/ 新建 |
| GET / PATCH / DELETE | `/api/admin/products/:id` | 详情 / 修改 / 归档 |
| PATCH | `/api/admin/products/:id/status` | 上架、沽清、下架 |
| GET / POST | `/api/admin/spec-groups` | 规格组列表 / 新建 |
| PATCH / DELETE | `/api/admin/spec-groups/:id` | 修改 / 删除（被商品引用时 409） |
| POST | `/api/admin/spec-groups/:id/options` | 给规格组新增选项 |
| PATCH / DELETE | `/api/admin/spec-options/:id` | 修改 / 删除选项 |
| POST | `/api/admin/uploads` | 上传商品图，jpg/png/webp，≤2MB |

归档不会物理删除：分类变 `DISABLED`，商品变 `OFF_SHELF`；顾客端只展示启用分类与在售/售罄商品。

### 2.3 D6 报价接口

`POST /api/orders/quote`，需要顾客 Bearer token。服务端按商品当前价格和规格加价重算，不信任客户端金额。

```json
{
  "items": [
    {
      "productId": "00000000-0000-4000-8000-000000000201",
      "quantity": 2,
      "optionIds": [
        "00000000-0000-4000-8000-000000000401",
        "00000000-0000-4000-8000-000000000403",
        "00000000-0000-4000-8000-000000000407",
        "00000000-0000-4000-8000-000000000410"
      ]
    }
  ],
  "pickupTimeType": "ASAP"
}
```

- `pickupTimeType=ASAP`：`estimatedReadyAt = now + prepMinutes + queueCount × perOrderMinutes`，最多 30 分钟；`queueCount` 只算已支付/制作中的立即单和已释放的预约单。
- `pickupTimeType=SCHEDULED`：必须带 `scheduledAt`，按上海时区 15 分钟粒度，最早当前 +15 分钟，最晚当前 +2 小时，且必须在营业时间内；`estimatedReadyAt = scheduledAt`。
- 金额字段：`itemsAmountCents`、`discountCents`、`payableCents`，全部整数分；D6 暂无优惠，`discountCents=0`。
- 错误：`VALIDATION_ERROR` / `SPEC_REQUIRED` 400，`PRODUCT_UNAVAILABLE` / `STORE_CLOSED` 409，未登录 401。
- D6 只做服务端报价与单测；D7 已提供创建订单 API，结算页与支付在 D8 接入。本地手工冒烟 2 杯中杯热生椰拿铁 = 4400 分。

### 2.4 D7 创建订单

`POST /api/orders`，需要顾客 Bearer token；请求体与 quote 相同，另加 `expectedTotalCents`，可选 `remark`、`contactName`、`contactPhone`。

```json
{
  "items": [
    {
      "productId": "00000000-0000-4000-8000-000000000201",
      "quantity": 2,
      "optionIds": [
        "00000000-0000-4000-8000-000000000402",
        "00000000-0000-4000-8000-000000000403",
        "00000000-0000-4000-8000-000000000407",
        "00000000-0000-4000-8000-000000000410",
        "00000000-0000-4000-8000-000000000413"
      ]
    }
  ],
  "pickupTimeType": "ASAP",
  "expectedTotalCents": 5800,
  "remark": "少冰"
}
```

- Header `Idempotency-Key` 必填，8–64 位字母、数字、下划线或连字符；同一会员同一 key 重复提交返回原订单，不会重复建单。
- 服务端重新 quote；`expectedTotalCents` 与 `payableCents` 不一致返回 409 `PRICE_CHANGED`，`details.quote` 是新报价。
- 成功返回 201，状态 `PENDING_PAYMENT`，含 `orderNo`、`businessDate`、`expiresAt`（15 分钟）、预约单 `releaseAt`、items 快照与 events。
- 订单号格式 `T + yyMMddHHmmss + 4 位随机`；预约单 `businessDate` 取取餐日，`releaseAt = scheduledAt - max(10, prepMinutes + 2) 分钟`（不早于创建时间）。
- 立即单当前先把 `businessDate` 记为创建日；D8 支付时若跨日，必须按支付日修正。15 分钟超时的支付拦截也在 D8。
- D7 只做创建订单 API；结算页、支付、订单查询和取消在 D8。

### 2.5 D8 支付、取餐码与订单

以下接口均需要顾客 Bearer token，且只能操作自己的订单。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/orders/:id/pay` | mock 支付；成功返回 `PAID` 订单与取餐码 |
| GET | `/api/orders` | 当前会员订单列表，支持 `status`、`page`、`pageSize` |
| GET | `/api/orders/:id` | 订单详情（含商品快照与事件） |
| POST | `/api/orders/:id/cancel` | 取消待支付订单，可带 `reason` |

- 支付条件：仅本人、仅 `PENDING_PAYMENT`、未超过 `expiresAt`；重复支付同一订单直接返回已支付结果，不会重复扣款。过期返回 409 `ORDER_EXPIRED`，非待支付返回 409 `ORDER_NOT_PAYABLE`。
- 支付成功：状态变 `PAID`，写 `paidAt`、`businessDate`、`pickupCode`、`estimatedReadyAt`、`releaseAt`（预约单），并写 `payments` 与订单事件。
- 取餐码：`A001` 格式，按门店 + 营业日重置；支付成功时才生成并占用号段，取消/退款不回收。立即单营业日取支付日，预约单取取餐日。
- ETA：立即单 `paidAt + prepMinutes + queueCount × perOrderMinutes`，封顶 30 分钟；预约单等于 `scheduledAt`；写单后不随队列变化。
- 预约单支付后仍是 `PAID`，到 `releaseAt` 才释放进待接单；立即单支付后直接进待接单。
- 取消仅允许 `PENDING_PAYMENT`，其他状态返回 409 `ORDER_INVALID_STATUS`；过期订单的自动取消在 D10。

### 2.6 顾客端下单流程

1. 菜单选规格加购，购物车「去结算」进入 `/pages/checkout/checkout`。
2. 未登录先跳 `/pages/login/login`，验证码登录后回到结算页。
3. 结算页调用 `POST /api/orders/quote` 服务端报价，可选择立即取餐或 15 分钟粒度的预约时间。
4. 提交时带 `Idempotency-Key` 创建订单并调用支付；成功后跳 `/pages/order/result` 展示取餐码。
5. key 与结算内容绑定：购物车、取餐方式/预约时间、联系人/手机号/备注任一变化，会取消旧待支付订单并换新 key；支付成功或上一笔订单已结束，重新结算也会换新 key。
6. 待支付订单会暂存在本地，可回到结算页继续支付；过期后清掉待支付状态。

### 2.7 D9 管理端订单看板

以下接口均需要员工 Bearer token，并按当前员工的 `storeId` 隔离。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/orders` | 订单列表，支持 `tab=ACTIVE/SCHEDULED/ALL`、`status`、`type`、`date`、`keyword`、分页 |
| GET | `/api/admin/orders/:id` | 订单详情（商品快照 + 状态时间线） |
| POST | `/api/admin/orders/:id/accept` | 接单：`PAID → ACCEPTED` |
| POST | `/api/admin/orders/:id/ready` | 出杯：`ACCEPTED → READY` |
| POST | `/api/admin/orders/:id/complete` | 确认取餐：`READY → COMPLETED` |
| POST | `/api/admin/orders/:id/reject` | 拒单退款，body `{ reason }`，`PAID/ACCEPTED/READY/NO_SHOW → REFUNDED` |

- 三 Tab：`ACTIVE` 为已支付/制作中/待取餐且已释放的订单；`SCHEDULED` 为已支付但未到释放时间的预约单；`ALL` 排除待支付和已取消。
- 默认查询上海时区今天，按 `businessDate` 过滤；关键字匹配订单号、联系人、手机号、取餐码。
- 所有状态动作使用条件更新，只有当前状态符合才生效；重复点击返回 409 `ORDER_INVALID_STATUS`。未释放预约单不能接单，返回 409 `ORDER_NOT_RELEASED`。
- 拒单必须填写原因，mock 环境立即退款：订单先到 `REFUNDING`，再 `REFUNDED`，原支付记录标记 `REFUNDED`，同时写两条订单事件。
- 看板每 5 秒轮询；新单提示音需要用户手势开启，未释放预约单不响铃；新单还会触发标题闪烁。

### 2.8 D10 定时任务

使用 `@nestjs/schedule`，随 API 进程启动，时区固定 `Asia/Shanghai`。

| 任务 | 频率 | 行为 |
|---|---|---|
| `OrderExpiryJob` | 每分钟 | 将 `PENDING_PAYMENT` 且 `expires_at <= now` 的订单条件更新为 `CANCELED`，写系统事件 |
| `ScheduledOrderReleaseJob` | 每分钟 | 将 `PAID + SCHEDULED + released_at IS NULL + release_at <= now` 的预约单释放，写系统事件 |
| `NoShowJob` | 每天 23:59 | 将当日（及更早）仍为 `READY` 的订单改为 `NO_SHOW`，不自动退款 |

- 三个任务都用条件更新，同一订单只会被处理一次；多实例同时跑时也只有一个实例能更新成功。
- 预约单释放后仍是 `PAID`，只是 `released_at` 有值，进入管理端「进行中」和待接单队列。
- 如果 23:59 时 API 没运行，下次启动后的 23:59 任务会补处理更早营业日遗留的 `READY` 订单，不会永久卡住。
- 任务默认每批 200 单；任务异常只记录日志，不影响 API 其他接口。
- `jobs.e2e-spec.ts` 覆盖：到期只释放一次、未到期不释放、超时订单只取消一次、23:59 当日订单转 `NO_SHOW`、未来订单不动、跨日补处理。

### 2.9 D11 管理端工作台与门店设置

以下接口均需要员工 Bearer token，并按当前员工的 `storeId` 隔离。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/dashboard?date=YYYY-MM-DD` | 工作台汇总：营业额、订单数、客单价、待接单/待取餐、最近 10 单 |
| GET | `/api/admin/store` | 当前门店设置 |
| PATCH | `/api/admin/store` | 修改门店设置，仅 `OWNER` 可操作 |

- 营业额按 `paid_at` 落在统计日（上海时区）的实付金额统计，并减去当日完成的退款；订单数同口径，包含 `NO_SHOW`，不包含待支付/已取消。
- 客单价 = 营业额 ÷ 订单数，四舍五入到分；0 单返回 `null`，前端显示 `—`。
- 待接单/待取餐是当前实时单量，不受统计日限制；待接单只算已释放的预约单或立即单。
- 最近订单按创建时间倒序取 10 条，排除待支付和已取消。
- 管理端工作台每 10 秒轮询，只刷新数字和最近订单，不打断当前操作。
- 门店设置支持名称、地址、电话、7 天营业时间、接单开关、单杯制作时长、每单占用间隔、取餐提示、取餐码前缀。
- 营业时间按周一到周日配置，P0 不支持跨天；打烊时间必须晚于开门时间。保存后顾客端门店/菜单/quote 下一次请求立即生效。
- 取餐码前缀只允许 1–4 位字母或数字，后端统一转大写；修改前缀只影响之后新生成的取餐码，不回溯旧订单。

### 2.10 D12 顾客端订单列表与详情

`GET /api/orders` 新增 `tab` 参数，仍保留 `status` 精确筛选：

| tab | 包含状态 |
|---|---|
| `ALL` | 当前会员全部订单 |
| `PENDING_PAYMENT` | `PENDING_PAYMENT` |
| `ACTIVE` | `PAID`、`ACCEPTED`、`READY` |
| `FINISHED` | `COMPLETED`、`NO_SHOW` |
| `CANCELED` | `CANCELED`、`REFUNDING`、`REFUNDED` |

- 列表按创建时间倒序分页，默认每页 10 条；支持下拉刷新与触底加载。
- 顾客端「我的订单」分 5 个 Tab；未登录显示登录引导，空 Tab 显示独立空态，异常显示错误文案与重试。
- 订单卡展示订单号、下单时间、状态、取餐方式、取餐码、商品摘要、金额与操作。
- 详情页展示门店名称/地址/电话、取餐码、预计出杯、商品快照、备注、金额与订单事件时间线。
- 详情在 `PENDING_PAYMENT`、`PAID`、`ACCEPTED`、`READY` 状态每 5 秒轮询；页面隐藏时停止，返回时恢复，只在状态变化时 toast 提示。
- 「再来一单」按订单项快照还原商品和规格，加入购物车后跳菜单；已下架/售罄商品会被跳过并提示。
- 「全部订单」返回列表；「返回首页」回首页。

### 3. 启动管理端

```powershell
cd apps/admin
npm install
npm run dev
```

打开 <http://127.0.0.1:5173/>。D5 已接入员工登录、token 持久化、401 跳转，以及分类、商品、规格和图片上传；D9 新增订单看板；D11 新增工作台统计与门店设置。演示账号 `owner / admin123`。

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
- 购物车：Pinia + `uni.setStorageSync`，同商品同规格合并，支持改数量、删除、清空、合计；「去结算」已接 D8 结算页。
- 商品图由 API 的 `/uploads` 静态目录提供；H5 走 Vite `/api` 代理，小程序开发期直连 `http://127.0.0.1:3000/api`。

#### D8 已实现

- 登录：手机号 + 验证码，开发环境自动填入 `devCode`；token 与会员信息存 uni storage。
- 结算：服务端 quote、立即/预约取餐、联系人/手机号/备注、待支付订单恢复与继续支付。
- 支付：mock 支付成功后清空购物车，跳转结果页展示 `PAID`、取餐码、预计出杯时间与订单明细。
- 订单：支持列表、详情、取消待支付订单；支付幂等，重复点击不会重复扣款。

#### D9 已实现

- 订单看板：进行中/预约/全部三 Tab、日期筛选、5 秒轮询、新单提示音与标题闪烁。
- 状态流转：接单 → 出杯 → 确认取餐；条件更新防重复点击，未释放预约单不能接单。
- 拒单退款：填写原因后 mock 立即退款，状态经历 `REFUNDING → REFUNDED`，保留订单事件。
- 订单详情：商品快照、规格文本、金额、支付/预计出杯时间、状态时间线。

#### D11 已实现

- 工作台：营业额、订单数、客单价、当前待接单/待取餐四个统计卡；日期切换、10 秒轮询、最近 10 单。
- 统计口径：按支付时间归日，退款按退款完成日冲减；待接单/待取餐为实时单量，最近订单排除待支付/已取消。
- 门店设置：基础信息、7 天营业时间、接单开关、制作时长、每单间隔、取餐提示、取餐码前缀。
- 权限：门店设置只有店主可保存，店员可以查看；营业时间、制作时长修改后顾客端立即生效。

#### D12 已实现

- 订单列表：全部/待支付/进行中/已完成/已取消 5 个 Tab，分页、下拉刷新、触底加载、登录引导、空态与错误重试。
- 订单详情：门店信息、取餐码、预计出杯、订单号、商品快照、备注、金额、事件时间线与「全部订单」「再来一单」。
- 进度轮询：待支付/已支付/制作中/待取餐状态每 5 秒刷新；页面隐藏时停止，返回时恢复；状态变化 toast。
- 再来一单：把订单商品与规格还原后加购；商品下架/售罄时跳过并提示。
- 首页新增「我的订单」入口，可直接查看进行中、历史订单和取餐码。

#### D5 已实现

- 登录：员工账号密码登录，token 存 `localStorage`，路由守卫拦截未登录访问，401 自动清理并跳回登录页。
- 分类管理：列表、商品数、状态、新建/编辑、归档；归档后顾客端不再展示。
- 商品管理：搜索与分类/状态筛选，新建/编辑，价格元转分，图片上传/移除，标签、描述、规格组多选，上架/沽清/下架。
- 规格管理：规格组与选项的增删改、默认项切换、可用开关、必选/多选与选择数上下限；被商品引用的规格组禁止删除。
- 图片上传：`POST /api/admin/uploads`，本地保存到 `apps/api/uploads/products/YYYY/MM/`，返回绝对 URL；仅 jpg/png/webp、≤2MB。

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
