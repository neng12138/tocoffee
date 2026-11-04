# ToCoffee P0 实施计划

> 依据：`docs/superpowers/specs/2026-11-04-tocoffee-design.md`（已批准，2026-11-04）
> 范围：单店、自提、P0；本地 Docker + H5 + 微信开发者工具
> 工期：3 周（15 个工作日），一个人全栈
> 原则：每个任务结束都保持「可启动、可演示」；先打通一条订单主链路，再补管理能力

## 1. 完成定义

P0 完成时，必须同时满足：

- 顾客端 H5 和微信开发者工具都能完成：登录 → 看菜单 → 选规格 → 加购 → 结算 → mock 支付 → 拿到取餐码 → 看订单状态。
- 管理端能完成：登录 → 看新单（5 秒内）→ 接单 → 出杯 → 确认取餐 → 拒单退款。
- 预约单支付后不响铃、不能接单；提前 10 分钟（或制作时长 + 2 分钟）释放，释放后置顶。
- 打烊后当日 `READY` 自动转 `NO_SHOW`；工作台按 10.7 口径统计。
- 管理端能维护分类/商品/规格/营业时间/接单开关/沽清/图片。
- `docker compose up -d` + migrate + seed 后，按 README 10 分钟内可复现完整演示。
- 三端目录结构、分层和依赖方向符合 `docs/architecture/project-structure.md`；`src` 根目录不堆业务文件。
- 每个开发日都有 `docs/dev-log/YYYY-MM-DD.md`，`PROGRESS.md` 状态和 commit 已更新；日志里的验证命令可复现。
- `apps/api` 与 `apps/admin` 的 `npm run build` 通过；`apps/passenger` 的 `vue-tsc --noEmit` 通过；核心单测与 e2e 通过。

## 2. 总体策略

1. **API 先行**：先用 curl/Swagger 把契约跑通，再接前端，避免双端互相等。
2. **纵向切片**：每完成一个切片就接一端 UI，不做「全部后端做完再写页面」。
3. **mock 支付独立**：`PaymentProvider` 接口 + `MockPaymentProvider`；订单链路不依赖微信支付 SDK。
4. **金额只用分**：数据库、API、前端计算全用整数分，只在展示层格式化为元。
5. **时间统一**：数据库 `timestamptz`；营业日/取餐码用 `Asia/Shanghai`；工具函数集中，禁止各模块自己 `new Date()` 算营业日。
6. **不引入 workspace**：三个 app 独立 `npm install`，根目录只放 compose、README、env 示例。

## 3. 仓库骨架（Day 1）

```
ToMe/
  apps/
    api/                 NestJS
    admin/               Vue3 + Vite + Element Plus
    passenger/           uni-app + Vue3 + TS
  docs/
    architecture/project-structure.md   目录职责/依赖方向/命名规范
    superpowers/specs/2026-11-04-tocoffee-design.md
    superpowers/plans/2026-11-04-tocoffee-p0-plan.md
  docker-compose.yml
  .env.example
  .gitignore
  README.md
```

任务：

- 先按 `docs/architecture/project-structure.md` 建目录骨架，再写第一个文件；目录职责、分层、依赖方向、命名以该文档为准。
- 仓库已初始化并推送；当前工作分支 `nengxiong`（跟踪 `origin/nengxiong`），首次提交 `02e1f4c` 已包含设计、结构规范与本计划。**不要再 `git init`**；后续默认提交到 `nengxiong`，只有用户明确要求才推 `main`。
- `.gitignore` 已包含 `node_modules`、`dist`、`.env`、`uploads`、`*.log`、`.DS_Store` 等；按实际脚手架补充。
- `docker-compose.yml`：`postgres:16`，项目名 `tocoffee`，容器 `tocoffee-postgres`，库/用户/密码 `tocoffee`，主机端口 **5433**（避开 OneSoon 的 5432），卷 `tocoffee_pgdata`，网络 `tocoffee_default`，健康检查 `pg_isready`。
- 与 OneSoon 完全隔离：不复用 `onesoon` 的库、容器、卷、网络；API 启动时校验 `current_database() = 'tocoffee'`。
- `.env.example`：按设计 12.5 节，补 `DATABASE_URL`、JWT 双 secret、`AUTH_DEV_MODE=true`、`PAYMENT_MODE=mock`、`PUBLIC_BASE_URL`。
- 首次启动前复制 `.env.example` 为 `.env`（已忽略）；API 从 `.env` 读取连接串和 JWT secret，Compose 用默认值也能起库。
- `README.md`：环境要求、四条启动命令、演示账号、常见问题。
- `apps/api`：NestJS CLI 脚手架，端口 3000，全局前缀 `/api`，Swagger 仅 dev。
- `apps/admin`：Vite + Vue3 + TS + Element Plus + Pinia + Vue Router + Axios，端口 5173。
- `apps/passenger`：官方 uni-app Vue3 + TS 模板（`npx degit dcloudio/uni-preset-vue#vite-ts`）；失败则按官方依赖手搭；端口 5174。

验收：`GET /api/health` 返回 `{ status: "ok", db: "up" }`；管理端空白页可启动；H5 首页显示占位文案；`dev:mp-weixin` 能产出 `dist/dev/mp-weixin` 并被微信开发者工具导入。

## 4. 数据层（Day 2）

### 4.1 Prisma 模型

按设计 9.1 建 15 张业务表：

`stores`、`staff`、`members`、`verification_codes`、`categories`、`products`、`spec_groups`、`spec_options`、`product_spec_groups`、`orders`、`order_items`、`order_events`、`payments`、`refunds`、`pickup_counters`。

关键约定：

- 主键：业务表用 `uuid`；`product_spec_groups`、`pickup_counters` 用联合主键。
- `verification_codes`：`id`、`phone`、`code_hash`、`expires_at`、`consumed_at`、`created_at`；按 `phone + created_at` 索引，5 分钟过期。
- 金额：`Int`，字段名以 `Cents` 结尾。
- 状态：Prisma enum；值严格按设计 8.4。
- 时间：`DateTime @db.Timestamptz(3)`；`business_date` 用 `DateTime @db.Date`。
- 订单项保存 `productName`、`productImage`、`specSnapshot Json`、`specText`、`unitPriceCents` 快照。
- 索引与唯一约束按 9.3；部分唯一索引（`pickup_code` 非空）用 migration 里手写 SQL 补。
- 金额非负 `CHECK` 用 migration SQL 补；Prisma schema 注释说明。
- API 启动时校验 `current_database() = 'tocoffee'`，不匹配直接退出，避免误连 `onesoon`。

### 4.2 迁移与 seed

- 安装锁定版本：`npm i prisma@6.19.3 @prisma/client@6.19.3`；**不要裸 `npm i prisma`**（npm `latest` 当前是 8.0.0-rc，且与 client 7.x 不匹配）。
- `npx prisma migrate dev --name init`，检查生成的 SQL 含全部索引/约束。
- `prisma/seed.ts` 用 upsert，可重复执行：
  - 门店：ToCoffee 示例店，08:00–20:00，`prepMinutes=8`，`perOrderMinutes=2`。
  - 店主：`owner` / `admin123`（bcrypt）。
  - 5 分类、12 商品、5 规格组及选项，按设计附录 A。
  - 商品图：复制 3 张本地占位图到 `uploads/seed/`，URL 用 `PUBLIC_BASE_URL/uploads/seed/...`。
- `package.json` 增加 `seed`、`prisma:migrate`、`prisma:studio`。

验收：空库 `migrate deploy` + `seed` 成功；重复 seed 不产生重复数据；`prisma studio` 能看到 12 个商品和 5 个规格组。

## 5. 后端切片

### 5.1 公共层与鉴权（Day 3）

文件：

```
apps/api/src/
  main.ts / app.module.ts
  common/filters/all-exceptions.filter.ts
  common/interceptors/response.interceptor.ts
  common/guards/customer-jwt.guard.ts
  common/guards/staff-jwt.guard.ts
  common/decorators/current-user.decorator.ts
  common/errors/app-error.ts
  common/utils/money.ts
  common/utils/time.ts
  prisma/prisma.service.ts
```

- 全局 `ValidationPipe({ whitelist: true, transform: true })`。
- 错误统一 `{ code, message, details? }`；`AppError` 带 HTTP 状态与稳定 code。
- JWT：顾客 7 天 / 员工 12 小时，不同 secret 与 audience。
- 顾客登录：
  - `POST /api/auth/code`：手机号 → 生成 6 位码，5 分钟有效；`AUTH_DEV_MODE=true` 时响应带 `devCode`，不接短信。
  - `POST /api/auth/login`：手机号 + 验证码 → upsert member → 返回 `{ token, member }`。
  - `GET /api/auth/me`：返回当前会员。
- 员工登录：
  - `POST /api/admin/auth/login`：用户名 + 密码 → bcrypt 校验 → `{ token, staff }`。
  - `GET /api/admin/auth/me`。
- 登录失败限流：同 IP/账号 5 次/分钟（内存桶即可，P0 不引 Redis）。

验收：curl 能拿到双端 token；无 token/错 token 返回 401；`AUTH_DEV_MODE=false` 时 `/auth/code` 不返回 `devCode`。

### 5.2 门店与菜单（Day 3–4）

公开接口：

- `GET /api/store`：门店信息、营业状态、今日营业时间、取餐提示。
- `GET /api/menu`：分类 + 在售商品 + 关联规格组/选项；售罄商品也返回，带 `status`。
- `GET /api/products/:id`：商品详情 + 规格组。

管理接口（`OWNER`）：

- `GET /api/admin/store`、`PATCH /api/admin/store`（名称/地址/电话/营业时间/接单开关/制作时长/提示语）。
- `GET/POST/PATCH/DELETE /api/admin/categories`（DELETE 实为归档/置 status）。
- `GET/POST/PATCH /api/admin/products`、`PATCH /api/admin/products/:id/status`。
- `GET/POST/PATCH /api/admin/spec-groups`、`POST/PATCH/DELETE /api/admin/spec-options`。
- `PUT /api/admin/products/:id/spec-groups`：整体替换关联与排序。
- `POST /api/admin/uploads`：jpg/png/webp ≤2MB，随机文件名，返回 URL。

验收：seed 后 `GET /api/menu` 返回 5 分类 12 商品；管理端能改价、沽清、改营业时间；上传图片可通过 `PUBLIC_BASE_URL` 访问。

### 5.3 报价与定价（Day 6）

- `POST /api/orders/quote`：
  - 入参：`items[{ productId, quantity, optionIds[] }]`、`pickupTimeType`、`scheduledAt?`。
  - 校验：商品在售、规格组必选/多选上限、选项属于该商品、数量 1–20。
  - 计算：`basePrice + Σ optionDelta` × quantity；返回明细、`itemsAmountCents`、`payableCents`、`estimatedReadyAt`。
  - 预约单：`estimatedReadyAt = scheduledAt`；立即单：`now + prepMinutes + queueCount × perOrderMinutes`，上限 30 分钟。
- `PricingService` 纯函数化，单测覆盖：加价、数量、必选、多选上限、售罄、预约时间边界。

验收：quote 金额与手算一致；非法规格返回 `SPEC_REQUIRED`/`PRODUCT_UNAVAILABLE`；预约时间不在营业时间返回 `STORE_CLOSED`。

### 5.4 下单、支付、取餐码（Day 7–8）

- `POST /api/orders`：
  - Header `Idempotency-Key`；按 `(member_id, key)` 唯一，重复请求返回原订单。
  - 服务端重算金额；与 `expectedTotalCents` 不一致返回 409 `PRICE_CHANGED` + 新报价。
  - 生成 `order_no`、`expires_at = now + 15min`、`business_date`、`release_at`（预约单）。
  - 状态 `PENDING_PAYMENT`；写 `order_events`。
- `POST /api/orders/:id/pay`：
  - 仅本人、仅 `PENDING_PAYMENT`、未过期。
  - `MockPaymentProvider` 立即成功；事务内写 `payments`、置 `PAID`、生成取餐码、算 `estimated_ready_at`、写事件。
  - 幂等：已 `PAID` 直接返回订单。
- `GET /api/orders`、`GET /api/orders/:id`：本人订单，含 items/events/取餐码。
- `POST /api/orders/:id/cancel`：仅 `PENDING_PAYMENT`；置 `CANCELED`。
- 取餐码：`PickupCodeService` 事务 + `pickup_counters` + 冲突重试；格式 `A001`，按门店 + `business_date` 重置。
- 订单号：`T + yyMMddHHmmss + 4 位随机`；唯一冲突重试 3 次。

验收：完整下单→支付→取餐码；重复支付不重复扣款/不重复建单；价格改动返回 409；15 分钟后不能支付。

### 5.5 管理端订单工作流（Day 9）

- `GET /api/admin/orders`：状态/日期/类型/关键字筛选，分页。
- `GET /api/admin/orders/:id`：详情 + 事件。
- `POST /api/admin/orders/:id/accept`：`PAID → ACCEPTED`；未释放预约单 409 `ORDER_NOT_RELEASED`。
- `POST /api/admin/orders/:id/ready`：`ACCEPTED → READY`。
- `POST /api/admin/orders/:id/complete`：`READY → COMPLETED`。
- `POST /api/admin/orders/:id/reject`：`PAID/ACCEPTED/READY/NO_SHOW → REFUNDING → REFUNDED`，必填 reason；mock 退款立即成功。
- 所有状态变更用条件更新 `WHERE status = 期望值`，0 行返回 409 `ORDER_INVALID_STATUS`；写 `order_events`。

验收：并发双击接单只有一次成功；未释放预约单不能接单；拒单后订单变 `REFUNDED` 且顾客端可见原因。

### 5.6 定时任务（Day 10）

- `OrderExpiryJob`：每分钟，`PENDING_PAYMENT AND expires_at < now()` → `CANCELED`。
- `ScheduledOrderReleaseJob`：每分钟，`PAID + SCHEDULED + released_at IS NULL + release_at <= now()` → 置 `released_at`，写事件。
- `NoShowJob`：每日 23:59 `Asia/Shanghai`，当日 `READY` → `NO_SHOW`，写事件。
- 用 `@nestjs/schedule`；任务加锁/幂等（条件更新），多实例也能安全跑。

验收：手动把时间拨到 release_at 前/后，任务只释放一次；23:59 后 `READY` 变 `NO_SHOW`。

### 5.7 工作台（Day 11）

- `GET /api/admin/dashboard?date=YYYY-MM-DD`：
  - 营业额、订单数、客单价、待接单、待取餐、最近 10 单。
  - 口径严格按设计 10.7；退款按 `refunds.completed_at` 冲减。
- `DashboardService` 单测：跨日、退款、NO_SHOW、空数据。

验收：手工构造 3 单 + 1 退款，数字与 SQL 手算一致。

## 6. 顾客端（Day 4–5、8、12–14）

### 6.1 结构

```
apps/passenger/src/
  pages/index/index.vue
  pages/menu/menu.vue
  pages/checkout/checkout.vue
  pages/pay-result/pay-result.vue
  pages/order/list.vue
  pages/order/detail.vue
  pages/mine/mine.vue
  pages/login/login.vue
  components/StoreCard.vue
  components/ProductCard.vue
  components/SpecSheet.vue
  components/CartSheet.vue
  components/OrderStatus.vue
  stores/cart.ts
  stores/user.ts
  stores/store.ts
  api/client.ts
  api/auth.ts
  api/catalog.ts
  api/orders.ts
  utils/money.ts
  utils/time.ts
  static/placeholder-product.png
  static/placeholder-logo.png
```

### 6.2 页面与行为

- **首页**：门店卡（营业状态/地址/距离占位）、取餐提示、热销横滑、最近订单入口。
- **菜单**：左侧分类联动、右侧商品卡、售罄置灰；底部购物车浮条。
- **规格弹层**：默认项预选；必选未选禁用；多选上限；价格实时变。
- **购物车**：按门店隔离，持久化 `uni.storage`；同商品同规格合并；数量 stepper。
- **结算**：取餐时间（立即/预约 15 分钟粒度）、备注 ≤50 字、手机号、金额明细；进入时 quote。
- **支付结果**：取餐码 48px、预计时间、门店地址、状态条。
- **订单列表/详情**：状态时间线、取餐码、商品明细；`PAID/ACCEPTED/READY` 5 秒轮询，`onHide` 暂停。
- **登录**：手机号 + 验证码；dev 模式把 `devCode` 填到提示里，方便演示。
- **空态/异常**：休息中、售罄、空购物车、无订单、网络失败、支付超时、已预约、超时未取。

### 6.3 小程序适配

- 只用 `uni.*` API；禁止 `document`/`window`/`localStorage`。
- `rpx` + `env(safe-area-inset-bottom)`；底部 Tab 与购物车浮条不重叠。
- 图片 `mode="aspectFill"`，失败显示本地占位图。
- 条件编译处理 H5/小程序差异；第 1 周就在微信开发者工具跑通首页/菜单/规格。
- 不引入 Element Plus 或依赖 DOM 的 UI 库。

验收：H5 375px 无横向滚动；开发者工具主流程可走通；`vue-tsc --noEmit` 通过。

## 7. 管理端（Day 5、9、11–12）

### 7.1 结构

```
apps/admin/src/
  layout/AppLayout.vue
  views/login/LoginView.vue
  views/dashboard/DashboardView.vue
  views/orders/OrdersView.vue
  views/products/ProductsView.vue
  views/products/ProductEditView.vue
  views/specs/SpecsView.vue
  views/store/StoreView.vue
  components/OrderCard.vue
  components/OrderDrawer.vue
  components/StatusTag.vue
  components/ImageUpload.vue
  components/SpecGroupEditor.vue
  api/client.ts / auth.ts / orders.ts / catalog.ts / store.ts / dashboard.ts
  stores/auth.ts
  router/index.ts
  styles/element-overrides.css
```

### 7.2 页面与行为

- **登录**：`owner` / `admin123`；token 存 localStorage；401 清 token 跳登录。
- **订单看板**：三个 Tab「进行中 / 预约 / 全部」；默认进行中；5 秒轮询；新单提示音 + 标题闪烁；预约单释放后自动进入进行中并置顶。
- **订单操作**：接单/出杯/确认取餐/拒单退款；按钮按状态显示；请求中禁用；失败 toast + 刷新。
- **商品**：列表 + 编辑表单（价格元转分、图片上传、规格组多选、排序、状态）。
- **规格**：组列表 + 选项表格；加价/默认/可用即时保存。
- **门店**：7 天营业时间编辑器、接单开关、制作时长、取餐提示。
- **工作台**：4 个统计卡 + 最近 10 单；10 秒轮询；口径 hover 提示。
- **提示音**：顶部「开启提示音」按钮解锁；状态存 localStorage；未解锁时红点/标题闪烁兜底。

验收：1280px 布局正常；从新单到出杯全流程可点；商品改价后 C 端下次请求生效。

## 8. 测试矩阵

### 8.1 单元测试（Jest）

- `PricingService`：基础价、选项加价、数量、必选、多选上限、售罄、预约边界。
- `OrderStateService`：全部合法转换、非法转换、未释放预约单接单。
- `BusinessHoursService`：营业中/休息/边界分钟/预约落点。
- `PickupCodeService`：补零、日切、跨日预约、并发冲突重试。
- `OrderReleaseService`：`release_at` 公式（制作 8 分钟→提前 10 分钟；制作 15 分钟→提前 17 分钟）。
- `DashboardService`：支付口径、退款冲减、NO_SHOW、空数据。

### 8.2 e2e（Supertest）

1. 顾客登录 → 菜单 → quote → 下单 → mock 支付 → 取餐码。
2. 管理端登录 → 接单 → 出杯 → 确认取餐。
3. 重复 `Idempotency-Key` 返回同一订单。
4. 重复支付幂等。
5. 改价后下单返回 409 `PRICE_CHANGED`。
6. 非法状态转换 409。
7. 预约单支付后不响铃/不能接单；到 `release_at` 释放。
8. 打烊后 `READY → NO_SHOW`。
9. 跨日预约取餐码落在取餐日。
10. 退款后工作台金额冲减。

测试库：独立 `tocoffee_test` 数据库；每个用例前 truncate；`prisma migrate deploy` 建表。

### 8.3 手工验收

按设计 14.2 清单逐项勾；重点：H5 + 微信开发者工具各走一遍；375px/1280px；提示音；预约单；拒单退款。

## 9. 三周排期

### 第 1 周：能看菜单、能加购、能改菜单

| 天 | 任务 | 当日可演示 |
|---|---|---|
| D1 | 仓库/compose/三个脚手架/health | 三个端能启动 |
| D2 | Prisma 15 表/migrate/seed | 数据库有示例菜单 |
| D3 | 鉴权/门店/菜单 API | curl 能登录、拿菜单 |
| D4 | C 端首页/菜单/规格/购物车 | H5 能选规格加购 |
| D5 | 管理端登录 + 分类/商品/规格 CRUD + 上传 | 后台能改菜单 |

周验收：C 端加购金额正确；后台改价后 C 端刷新生效。

### 第 2 周：订单主链路闭环

| 天 | 任务 | 当日可演示 |
|---|---|---|
| D6 | quote/定价/单测 | 结算页金额正确 |
| D7 | 下单/幂等/超时 | 能创建待支付订单 |
| D8 | mock 支付/取餐码/订单查询/取消 | 支付后出取餐码 |
| D9 | 管理端订单看板/状态流转/提示音 | 接单→出杯→取餐 |
| D10 | 预约释放/NO_SHOW 任务 | 预约单按时进队列 |

周验收：一条完整订单从 C 端到 B 端闭环；并发/重复操作不脏数据。

### 第 3 周：管理完善、测试、演示

| 天 | 任务 | 当日可演示 |
|---|---|---|
| D11 | 工作台 + 门店设置 | 今日数据正确 |
| D12 | 订单详情/历史/空态/异常文案 | 异常场景不白屏 |
| D13 | e2e + 单测补齐 + 修 bug | 自动化测试通过 |
| D14 | UI 打磨/375px/开发者工具走查 | 双端体验完整 |
| D15 | README/演示脚本/全流程 dry run/日志索引 | 10 分钟演示 |

### 9.1 每日收尾（强制）

每天结束前按顺序做，缺一项不算完成当天任务：

1. 停新功能，只修当天引入的问题。
2. 跑检查：`docker compose ps`、API `npm run build`、API 单测、管理端 `npm run build`、顾客端 `npx vue-tsc --noEmit`、`git diff --check`；未到阶段的命令注明“跳过 + 原因”。
3. 手工冒烟当天“可演示”路径，记录结果。
4. 复制 `docs/dev-log/TEMPLATE.md` 到 `docs/dev-log/YYYY-MM-DD.md`，填写目标、完成项、验证命令与结果、决策、阻塞、明日计划。
5. 更新 `docs/dev-log/PROGRESS.md`：状态、日志链接、commit。
6. 代码 + 日志 + 文档变更一起提交，信息用 `feat(dayN): ...` / `fix(dayN): ...` / `chore(dayN): ...`。
7. 向用户汇报四件事：今日完成、验证结果、风险/阻塞、明日计划。

详细规范见 `docs/dev-log/README.md`。

## 10. 风险与应对

| 风险 | 应对 |
|---|---|
| uni-app 模板/依赖安装失败 | 先用 H5 跑通；模板失败则按官方依赖手搭；必要时用代理 |
| Prisma 部分唯一索引/CHECK 不支持 | 在 migration SQL 手写；`prisma migrate diff` 校验 |
| 小程序不支持某些 CSS/API | 第 1 周开发者工具走查；条件编译；不用 DOM 库 |
| 提示音被浏览器拦截 | 手动解锁按钮 + 红点/标题闪烁兜底 |
| 预约单排队导致晚点 | 看板置顶标红；P0 允许极端情况略晚，P1 做动态提前释放 |
| 时区/营业日算错 | 统一 `Asia/Shanghai` 工具 + 单测覆盖跨日 |
| 范围蔓延 | P1 清单写死；新增需求不进 P0 |

## 11. 演示脚本（README 同步）

1. `docker compose up -d`；`cd apps/api && npx prisma migrate dev && npm run seed && npm run start:dev`。
2. 管理端登录 `owner/admin123`，确认菜单和营业时间。
3. C 端 H5 登录（dev code），点一杯生椰拿铁：大杯/冰/少糖/燕麦奶/加浓缩，加购。
4. 结算选「立即取餐」，mock 支付，展示取餐码。
5. 管理端 5 秒内响铃，接单 → 出杯；C 端变「待取餐」。
6. 管理端点「确认取餐」，C 端完成；工作台营业额 +1。
7. 再演示一单预约：选 15 分钟后取餐，支付后显示「已预约」，管理端「预约」Tab 可见但不响铃；到点释放后进入进行中。

## 12. P0 不做（防止蔓延）

- 微信真实支付/退款、优惠券、积分/储值、发票。
- 多门店、堂食桌码、外卖配送。
- 打印小票、POS 对接、供应链库存。
- 店员账号/细粒度权限（只留 `OWNER`）。
- 云服务器/备案/HTTPS/真机发布。
- 对象存储（本地 uploads + volume）。

---

**执行顺序**：批准本计划后，从 Day 1 开始；每天按 9.1 做收尾检查、写 `docs/dev-log/` 日志并提交。遇到与设计冲突的实现细节，先记录在 `docs/notes.md`，不擅自扩大范围。
