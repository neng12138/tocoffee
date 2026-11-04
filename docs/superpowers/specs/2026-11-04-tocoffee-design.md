# ToCoffee 设计文档

> 状态：已批准（2026-11-04）· 待实施
> 范围：单店、自提、P0；本地 Docker + H5/微信开发者工具演示
> 技术栈：Vue3 + Element Plus（管理端）、uni-app + Vue3（顾客端）、NestJS、PostgreSQL、Docker

## 1. 背景与目标

### 1.1 为什么做

ToCoffee 是一家单店咖啡店。高峰期柜台排队、微信私聊点单容易漏单/记错规格，店主需要一个自己掌控的点单系统：

- 顾客在微信小程序里选品、选规格、支付，到店凭取餐码取咖啡。
- 店员在一个后台页面里完成接单、出杯、确认取餐，不再依赖纸质小票和聊天记录。
- 店主自己维护菜单、价格、规格、营业时间，不被 SaaS 的固定模板限制。

### 1.2 成功标准

- 熟练顾客从打开小程序到支付完成 ≤ 60 秒。
- 门店在一个页面完成「接单 → 出杯 → 确认取餐」，新订单 5 秒内出现并有提示。
- 价格 100% 由服务端计算；改价/下架不影响历史订单。
- 本地 `docker compose up` + seed 后，10 分钟内可演示完整闭环。
- **P0 验收范围 = 本地 Docker + H5 + 微信开发者工具**；不包含云服务器、备案域名、HTTPS、真机真实支付。
- 示例品牌 ToCoffee 与 12 款示例商品随 seed 提供；店主后台上传图片/改价替换。

## 2. 用户与角色

| 角色 | 使用的端 | 关键诉求 |
|---|---|---|
| 顾客 | 微信小程序（C 端） | 快速选品、规格清楚、支付顺手、到店即取 |
| 店员/咖啡师 | 管理端 Web（B 端） | 新单有声音、操作按钮大、能拒单/退款、能沽清 |
| 店主 | 管理端 Web（B 端） | 改菜单/价格/营业时间、看今日经营数据 |
| 系统定时任务 | API | 关闭超时未支付订单、清理过期验证码 |

P0 管理端先做「店主一个账号」，角色模型预留 `OWNER` / `STAFF`，P1 再开放店员账号与细粒度权限。

## 3. 范围

### 3.1 P0（本期，单店自提闭环）

**顾客端**

- 手机号 + 验证码登录（开发模式验证码回显，便于演示；生产接短信）。
- 首页：门店信息、营业状态、取餐提示、活动位、热销推荐、最近订单。
- 菜单：分类 + 商品列表、售罄状态、商品规格弹层、购物车。
- 结算：立即取餐 / 预约取餐时间、备注、服务端算价、模拟支付。
- 支付结果：取餐码、预计取餐时间、订单状态轮询。
- 订单：待支付/进行中/已完成/已取消列表与详情、再来一单。
- 我的：基础资料、订单入口、退出登录。

**管理端**

- 账号密码登录、修改密码。
- 工作台：今日营业额、订单数、待接单数、待取餐数、最近订单。
- 订单看板：新单提示音、接单、出杯、确认取餐、拒单退款、订单详情、按状态筛选、轮询刷新。
- 商品：分类 CRUD、商品 CRUD（图片、价格、分类、规格组、标签、排序、上下架、沽清）。
- 规格：规格组 CRUD、选项 CRUD（加价、默认值、可选状态）。
- 门店：名称、地址、电话、营业时间、接单开关、预计制作时长、取餐提示。
- 图片上传（本地磁盘，Docker volume 持久化）。

**平台**

- PostgreSQL 16 + Prisma 6.19.3（`prisma` 与 `@prisma/client` 同版本锁定）+ schema/migrations + seed。
- Docker Compose 起 Postgres；API/两个前端本地 npm 启动。
- Swagger（非生产环境）、健康检查、统一错误码、请求日志。
- 单元测试 + 订单闭环 e2e。

### 3.2 P1（下一期）

- 微信支付 v3 JSAPI、退款、支付回调验签。
- 微信静默登录（`wx.login` + `code2session`）。
- 优惠券、积分、储值/会员等级。
- 小票打印（飞鹅/易联云）、打印失败重试。
- 经营报表（营业额、商品销量、时段分布、门店对比）。
- 店员账号与权限、操作日志。
- 订单完成后的评价/投诉入口。

### 3.3 非目标（P0 不做）

- 外卖/配送、骑手调度、配送范围与运费。
- 多门店、加盟、总部-门店结算。
- 供应链/原料库存 ERP、POS 收银机对接。
- 发票、企业账户、团餐。
- 原生 App、支付宝/抖音小程序。
- 云服务器/备案域名/HTTPS/真机真实支付（P0 只做本地演示）。
- 推荐算法、复杂会员成长体系。

### 3.4 反目标（做了就算失败）

- 按「每个规格组合一个 SKU」建商品，导致菜单维护爆炸。
- 前端传总价、后端直接信任，导致改价/篡改。
- 管理端做成通用 CRUD，没有「接单-出杯-取餐」工作流。
- 为单店首期上微服务/消息队列/多租户，拖慢闭环。
- 把模拟支付写死在前端，后续接微信支付要重写订单链路。

## 4. 约束与已定决策

- 技术栈：Vue3 + Element Plus、NestJS、PostgreSQL、Docker（用户已定）。
- 顾客端形态：微信小程序；用 uni-app + Vue3 + TypeScript 一套代码同时产出 H5（开发预览）和 mp-weixin。
- 经营形态：单店、自提；数据模型仍保留 `store_id`，为多店留余地。
- 币种人民币，所有金额用「分」存整数，禁止浮点。
- 时区统一 `Asia/Shanghai`；数据库存 UTC，展示/营业日按门店时区计算。
- 界面中文；C 端移动优先（375/390/430px），B 端桌面优先（≥1280px）。
- 真实微信支付需要企业主体、小程序 AppID、微信支付商户号；P0 用 mock provider，接口按 provider 抽象。
- 开发机 Windows + Docker Desktop；本地端口 API 3000、admin 5173、passenger 5174、Postgres **5433**（避开 OneSoon 的 5432）。

## 5. 方案与取舍

### 5.1 产品形态

| 方案 | 说明 | 取舍 |
|---|---|---|
| A. 单店自提（选中） | 只服务一家店，先跑通点单-履约闭环 | 最快上线；后续加多店要补门店隔离/权限 |
| B. 多店连锁 | 一开始做总部/门店/价格/库存隔离 | 模型复杂 2-3 倍，首期风险高 |
| C. SaaS 套壳 | 有赞/客如云等 | 上线快，但定制难、数据不在自己手里、月费 |

选 A。单店先验证「顾客愿不愿意提前点、店员愿不愿意用」，再谈连锁。

### 5.2 顾客端技术

| 方案 | 取舍 |
|---|---|
| uni-app + Vue3（选中） | 一套代码出 H5 + 微信小程序；团队已有经验；生态成熟。代价：部分小程序能力需真机验证 |
| Taro + React | 跨端能力强，但团队是 Vue 技术栈，切换成本高 |
| 微信原生小程序 | 体验最稳，但要另写一套 H5，开发量翻倍 |

选 uni-app。要求：不直接操作 DOM，统一用 `uni.*` API；关键页面在微信开发者工具走一遍，本期若具备 AppID/HTTPS 再上真机。

### 5.3 后端形态

模块化单体（选中）而非微服务/Serverless。单店流量小，单体部署简单、事务清晰；模块边界按领域切，后续要拆再拆。

### 5.4 数据访问

Prisma（选中）vs 原生 `pg` vs TypeORM。选 Prisma：schema 即文档、迁移可回放、类型安全，适合 15+ 张表的首期。若团队坚持与 OneSoon 一致的原生 `pg`，可在开工前替换，不影响领域模型。**版本锁定 6.19.3**：npm 上 `prisma` 的 `latest` 目前指向 8.0.0-rc，不能裸 `npm i prisma`，否则会装到 RC 且与 `@prisma/client` 7.x 不匹配。

### 5.5 支付

P0 用 `PaymentProvider` 接口 + `MockPaymentProvider`：

- 下单只创建 `PENDING_PAYMENT` 订单。
- 调用支付接口时，mock provider 立即把订单标记 `PAID` 并生成取餐码；微信 provider（P1）返回 JSAPI 参数，等回调再标记 `PAID`。
- 订单、支付、退款链路不依赖具体 provider，P1 只加一个实现 + 回调控制器。

### 5.6 购物车

客户端 Pinia + 本地存储（选中），不建服务端购物车表。结算时服务端重新校验商品/规格/价格；避免购物车长期不失效、价格过期。

### 5.7 实时更新

P0 轮询：顾客订单详情 5 秒/次，管理端订单看板 5 秒/次。P1 再评估 SSE/WebSocket。轮询足够单店使用，且实现/排障简单。

## 6. 信息架构

### 6.1 顾客端（底部 4 Tab）

| 页面 | 路由 | 作用 | 关键元素 |
|---|---|---|---|
| 首页 | `pages/index/index` | 建立信任、快速开始点单 | 门店卡、营业状态、取餐提示、活动位、热销推荐、最近订单 |
| 点单 | `pages/menu/menu` | 选品与加购 | 分类侧栏、商品卡、搜索（P1）、购物车浮条 |
| 订单 | `pages/order/list` | 查看进行中/历史订单 | 状态 Tab、订单卡、再来一单 |
| 我的 | `pages/mine/mine` | 账户与入口 | 头像/昵称/手机号、订单入口、优惠券占位（P1）、退出 |
| 登录 | `pages/login/login` | 手机号登录 | 手机号、验证码、发送按钮、协议勾选 |
| 结算 | `pages/checkout/checkout` | 确认取餐信息并支付 | 商品摘要、取餐时间、备注、金额、提交/支付 |
| 支付结果 | `pages/pay-result/pay-result` | 展示取餐码与进度 | 取餐码大字、预计时间、状态、门店地址 |
| 订单详情 | `pages/order/detail` | 状态跟踪与售后 | 状态时间线、商品明细、金额、取餐码、操作 |

购物车用底部弹层（`CartSheet`），不单独占 Tab/路由。

### 6.2 管理端（侧边栏）

| 页面 | 路由 | 作用 |
|---|---|---|
| 登录 | `/login` | 账号密码登录 |
| 工作台 | `/` | 今日经营概览 + 最近订单 |
| 订单看板 | `/orders` | 接单、出杯、取餐、退款 |
| 商品管理 | `/products` | 分类、商品、上下架、沽清 |
| 规格管理 | `/specs` | 规格组、选项、加价、默认值 |
| 门店设置 | `/store` | 营业时间、接单开关、制作时长、取餐提示 |
| 账号设置 | `/account` | 修改密码（P0 简单页） |
| 营销/会员/报表/员工 | P1 | 后续扩展 |

管理端布局：左侧深咖啡色侧栏（ToCoffee 字标 + 菜单），顶部显示门店名/当前账号/退出，内容区白底卡片。

## 7. 核心流程

### 7.1 顾客点单（happy path）

1. 打开小程序 → 有 token 直接进首页；无 token 进登录页。
2. 首页展示门店（单店）与营业状态；点击「开始点单」进菜单。
3. 选商品 → 打开规格弹层 → 选必选规格（默认值预选）→ 调数量 → 加入购物车。
4. 购物车浮条显示件数/金额 → 打开购物车弹层 → 可改数量/删项 → 去结算。
5. 结算页：选「立即取餐」或「预约时间」→ 填备注 → 服务端 quote 算价 → 提交订单。
6. 订单创建为 `PENDING_PAYMENT`；点击「模拟支付」（P0）→ 订单变 `PAID`，生成取餐码与预计取餐时间。
7. 支付结果页展示取餐码；订单详情每 5 秒轮询状态。
8. 店员接单（`ACCEPTED`）→ 出杯（`READY`）→ 顾客到店报码 → 店员确认取餐（`COMPLETED`）。
9. 顾客可在订单详情「再来一单」，把历史商品重新加入购物车。

### 7.2 门店履约

1. 新 `PAID` 订单进入「待接单」，看板 5 秒轮询出现，播放提示音（需用户先点「开启提示音」）。
2. 店员点「接单」→ `ACCEPTED`（顾客端显示「制作中」）。
3. 做好后点「出杯」→ `READY`（顾客端显示「待取餐」，可取餐码）。
4. 顾客到店，店员核对取餐码 → 点「确认取餐」→ `COMPLETED`。
5. 若原料售罄/门店打烊：点「拒单退款」→ `REFUNDING` → mock 立即 `REFUNDED`，顾客端显示退款原因。

### 7.3 异常与边界

| 场景 | 处理 |
|---|---|
| 加购后商品被沽清 | 结算 quote 返回 `PRODUCT_UNAVAILABLE`，前端标红并提示移除 |
| 下单前价格被改 | `POST /orders` 带 `expectedTotalCents`，服务端重算不一致返回 409 `PRICE_CHANGED` + 新报价 |
| 15 分钟未支付 | 定时任务把 `PENDING_PAYMENT` 改 `CANCELED`；未支付不生成取餐码，无需回收 |
| 重复点击支付 | 支付接口幂等：已 `PAID` 直接返回当前订单；回调按 transaction_id 唯一 |
| 重复提交订单 | 客户端生成 `Idempotency-Key`，服务端按 `(member_id, key)` 唯一，重复请求返回同一订单 |
| 店员双击接单 | 条件更新 `WHERE status='PAID'`；0 行则返回当前状态，不重复推进 |
| 预约时间已过 | 提交时校验预约时间 ≥ 当前 + 15 分钟；已过则要求重选 |
| 预约单未到释放时间 | 只在管理端「预约」Tab 展示；不能接单（409 `ORDER_NOT_RELEASED`）；顾客端显示「已预约」；不响提示音 |
| 跨日预约 | `business_date` 取预约取餐日；取餐码在支付时占用取餐日号段，避免当天重号 |
| 打烊仍未取 | 23:59 定时任务把当日 `READY` 改 `NO_SHOW`；不自动退款，店员可手动退 |
| 门店休息 | 首页/菜单提示休息中；`POST /orders` 校验 `is_accepting_orders` 与营业时间 |
| 支付成功但页面断开 | 订单详情/订单列表可恢复；以服务端状态为准 |
| 已支付顾客想取消 | P0 引导联系门店；店员可拒单退款；P1 做顾客退款申请 |

## 8. 领域模型

### 8.1 商品与规格

商品用 `SPU + 规格组 + 选项`，不按组合建 SKU。

示例「生椰拿铁」：

- 杯型：中杯 +0 / 大杯 +3
- 温度：热 / 冰 / 少冰 / 去冰
- 糖度：标准 / 少糖 / 无糖
- 奶基：牛奶 +0 / 燕麦奶 +3 / 椰奶 +0
- 加料（多选，最多 3）：浓缩 +4 / 奶油 +3 / 糖浆 +2

规则：

- 规格组属于门店；商品通过 `product_spec_groups` 关联适用的组（美式不关联奶基）。
- 单选组必须且只能有一个默认项；多选组可设置默认项与最多可选数。
- 必选组未选不能加购；选项可单独置为「不可用」（如燕麦奶售罄）。
- 商品状态：`ON_SALE` / `SOLD_OUT` / `OFF_SHELF`；`SOLD_OUT` 前端置灰、不可加购。
- 订单项保存商品名、图片、规格快照、单价，历史订单不随菜单变化。

### 8.2 价格计算

```
unit_price_cents = product.base_price_cents + Σ(selected_option.price_delta_cents)
line_total_cents = unit_price_cents × quantity
items_amount_cents = Σ(line_total_cents)
payable_cents = items_amount_cents - discount_cents   // P0 discount = 0
```

- 所有金额整数分；前端只展示，不参与最终结算。
- quote 与下单使用同一套 `PricingService`，避免两处逻辑漂移。
- P0 无打包费/配送费/税费；价格即含税价。
- `expectedTotalCents` 只用于检测价格变化，不作为结算依据。

### 8.3 订单状态机

| 状态 | 顾客端文案 | 管理端文案 | 说明 |
|---|---|---|---|
| `PENDING_PAYMENT` | 待支付 | 待支付 | 下单后 15 分钟内可支付 |
| `PAID` | 已支付，等待接单 | 待接单 | 支付成功，取餐码已生成 |
| `ACCEPTED` | 制作中 | 制作中 | 店员已接单 |
| `READY` | 待取餐 | 待取餐 | 已出杯，等顾客取 |
| `COMPLETED` | 已完成 | 已完成 | 已取餐 |
| `NO_SHOW` | 已关闭（超时未取） | 超时未取 | 打烊后仍未取，系统自动关闭；不自动退款 |
| `CANCELED` | 已取消 | 已取消 | 未支付取消/超时关闭 |
| `REFUNDING` | 退款中 | 退款中 | 拒单/退款处理中（mock 极短） |
| `REFUNDED` | 已退款 | 已退款 | 退款完成 |

预约单支付后同样是 `PAID`，但在释放前不进入制作队列，顾客端显示「已预约 14:30 取餐」；释放后显示「等待接单」。详见 8.6。

允许的转换：

```
PENDING_PAYMENT → PAID | CANCELED
PAID            → ACCEPTED | REFUNDING
ACCEPTED        → READY | REFUNDING
READY           → COMPLETED | NO_SHOW | REFUNDING
NO_SHOW         → REFUNDING
REFUNDING       → REFUNDED
```

- 所有转换走 `OrderStateService`，非法转换返回 409 `ORDER_INVALID_STATUS`。
- 每次转换写 `order_events`，顾客端时间线直接读事件。
- 管理端按钮幂等：目标状态已达成返回 200 + 当前订单；跨状态非法才 409。
- 并发用条件更新（`UPDATE ... WHERE id=? AND status=? RETURNING *`），不依赖先读后写。

### 8.4 取餐码

- 格式：`A001`（前缀可配置，默认 `A`，3 位补零，超过 999 自动 4 位）。
- 按「门店 + 取餐营业日」每日重置；取餐营业日按 `Asia/Shanghai` 计算，即订单的 `business_date`。
- `business_date` 对立即单 = 支付日，对预约单 = `scheduled_at` 所在日（不是支付日）。
- 支付成功时生成并占用该取餐日的号；跨日预约会在支付时就锁定取餐日的号，避免取餐日重号。
- 未支付订单不占号；已支付后取消/退款的订单不回收号，允许当日序号有空洞。
- 生成方式：`pickup_counters(store_id, business_date, last_seq)`，事务内 `INSERT ... ON CONFLICT DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq`。
- 唯一约束：`(store_id, business_date, pickup_code) WHERE pickup_code IS NOT NULL`，冲突则重试一次。

### 8.5 预计取餐时间

P0 用可解释的简单公式，不做产能模型。

**立即单（ASAP）**：

```
estimated_ready_at = paid_at
                   + store.prep_minutes
                   + queue_count × store.per_order_minutes
```

- `queue_count`：支付时处于 `PAID`/`ACCEPTED`、且已进入制作队列的订单数（立即单 + 已释放的预约单），**不含未释放的未来预约单**；`per_order_minutes` 默认 2。
- 上限 30 分钟；结果写入订单，后续不随队列变化。
- 顾客端展示「预计 10:35 可取」；管理端按 `paid_at` 排序。

**预约单（SCHEDULED）**：

```
estimated_ready_at = scheduled_at
```

- 预约时间是顾客期望取餐时间，不是下单时间；不套用排队公式，避免显示「10 分钟后可取」。
- 系统在 `release_at` 把预约单释放进制作队列（见 8.6），店员按正常节奏制作，目标是 `scheduled_at` 前 2 分钟出杯，顾客到点直接取。
- 预约单释放后，管理端在待接单列表**置顶**并标「预约 14:30」；若当前排队预计会晚于 `scheduled_at`，卡片标红提醒店员优先制作；P0 不自动改 ETA，极端排队下允许略晚。

### 8.6 营业时间与预约

- `stores.business_hours` 存 JSON：`[{ "day": 1, "open": "08:00", "close": "20:00" }, ...]`，`day` 用 1-7（周一到周日）。
- 营业状态 = 在营业时间内 且 `is_accepting_orders = true`；手动打烊优先。
- 预约取餐：15 分钟粒度，最早「当前 + 15 分钟」，最晚「当前 + 2 小时」，且必须落在营业时间内。
- P0 不支持跨天营业（咖啡店通常不需要）；若后续需要，再扩展 `close_next_day`。

**预约单进入队列（释放）**

- `release_at = max(paid_at, scheduled_at - max(10, store.prep_minutes + 2) 分钟)`，写入订单。含义：**至少提前 10 分钟接单/制作**，且保证制作时长 + 2 分钟缓冲；制作 8 分钟的店，14:30 取餐会在 14:20 释放，14:28 左右出杯，不会放到 14:30 才接单，也不会提前太久导致咖啡变凉。
- 后台任务每分钟扫描：`status = PAID AND pickup_time_type = SCHEDULED AND released_at IS NULL AND release_at <= now()` → 置 `released_at = now()`，写 `order_events`（`SYSTEM`，备注「预约单进入制作队列」）。
- 释放前：管理端「预约」列表可见，但不进「待接单」，不响提示音；顾客端显示「已预约 14:30 取餐」。
- 释放后：进入「待接单」，响提示音；顾客端显示「等待接单」，接单后「制作中」。
- 顾客端状态文案优先级：`PAID + SCHEDULED + released_at IS NULL` → 已预约；`PAID + released_at IS NOT NULL` → 等待接单。

**打烊与超时未取**

- 每日 23:59（`Asia/Shanghai`）定时任务把当日 `READY` 且未取的订单改为 `NO_SHOW`，写事件（`SYSTEM`，备注「打烊超时未取」）。
- `NO_SHOW` 不自动退款；店员可在订单详情发起退款（`NO_SHOW → REFUNDING → REFUNDED`）。
- 看板「待取餐」只统计 `READY`，`NO_SHOW` 不再堆积；营业额仍按支付金额计入，退款完成后再冲减。

### 8.7 优惠（P1 预留）

P0 订单表保留 `discount_cents`、`coupon_id` 字段但恒为 0/null。P1 接入时：

- 优惠券在订单创建时锁定，支付成功核销，取消/超时释放。
- 折扣计算放在 `PricingService`，订单保存优惠快照。
- 叠加规则先做「一单一张券」，不做复杂叠加。

## 9. 数据模型

### 9.1 表清单

| 表 | 作用 | P0 |
|---|---|---|
| `stores` | 门店信息、营业时间、接单开关 | ✅ |
| `staff` | 管理端账号、角色 | ✅ |
| `members` | 顾客（手机号/openid） | ✅ |
| `verification_codes` | 手机验证码（开发模式） | ✅ |
| `categories` | 商品分类 | ✅ |
| `products` | 商品 SPU | ✅ |
| `spec_groups` | 规格组 | ✅ |
| `spec_options` | 规格选项与加价 | ✅ |
| `product_spec_groups` | 商品-规格组关联 | ✅ |
| `orders` | 订单主表 | ✅ |
| `order_items` | 订单项与规格快照 | ✅ |
| `order_events` | 状态流转时间线 | ✅ |
| `payments` | 支付记录（mock/微信） | ✅ |
| `refunds` | 退款记录 | ✅ |
| `pickup_counters` | 每日取餐码计数器 | ✅ |
| `coupons` / `member_coupons` | 优惠券 | P1 |
| `points_ledger` / `wallets` / `wallet_transactions` | 积分/储值 | P1 |
| `print_jobs` | 打印任务 | P1 |
| `audit_logs` | 管理端操作日志 | P1 |

### 9.2 核心字段

**stores**

`id`, `name`, `address`, `phone`, `latitude`, `longitude`, `business_hours jsonb`, `is_accepting_orders bool`, `prep_minutes int`, `per_order_minutes int`, `pickup_notice text`, `pickup_code_prefix varchar(4)`, `created_at`, `updated_at`

**staff**

`id`, `store_id`, `username`（门店内唯一）, `password_hash`, `name`, `role`（`OWNER`/`STAFF`）, `status`, `created_at`, `updated_at`

**members**

`id`, `phone`（唯一，可空，微信登录后补）, `openid`（唯一，可空，P1）, `nickname`, `avatar_url`, `created_at`, `last_login_at`

**verification_codes**

`id`, `phone`, `code_hash`, `expires_at`, `consumed_at`, `created_at`；按 `(phone, created_at)` 索引，5 分钟过期。

**categories**

`id`, `store_id`, `name`, `sort`, `status`, `created_at`, `updated_at`

**products**

`id`, `store_id`, `category_id`, `name`, `description`, `image_url`, `base_price_cents int`, `tags jsonb`, `status`（`ON_SALE`/`SOLD_OUT`/`OFF_SHELF`）, `sort`, `created_at`, `updated_at`

**spec_groups**

`id`, `store_id`, `name`, `required bool`, `multi_select bool`, `min_select int`, `max_select int`, `sort`, `created_at`, `updated_at`

**spec_options**

`id`, `group_id`, `name`, `price_delta_cents int`, `is_default bool`, `is_available bool`, `sort`, `created_at`, `updated_at`

**product_spec_groups**

`product_id`, `group_id`, `sort`；联合主键

**orders**

`id uuid`, `order_no varchar(32) unique`, `store_id`, `member_id`, `status`, `pickup_type`（P0 固定 `SELF_PICKUP`）, `pickup_time_type`（`ASAP`/`SCHEDULED`）, `scheduled_at`, `release_at`, `released_at`, `pickup_code varchar(8)`, `business_date date`（取餐营业日）, `items_amount_cents`, `discount_cents`, `payable_cents`, `paid_cents`, `coupon_id`, `remark`, `contact_name`, `contact_phone`, `estimated_ready_at`, `expires_at`, `idempotency_key`, `cancel_reason`, `paid_at`, `accepted_at`, `ready_at`, `completed_at`, `no_show_at`, `canceled_at`, `created_at`, `updated_at`

**order_items**

`id`, `order_id`, `product_id`, `product_name`, `product_image`, `spec_snapshot jsonb`, `spec_text`, `unit_price_cents`, `quantity`, `total_cents`, `remark`

**order_events**

`id`, `order_id`, `from_status`, `to_status`, `actor_type`（`CUSTOMER`/`STAFF`/`SYSTEM`）, `actor_id`, `note`, `created_at`

**payments**

`id`, `order_id`, `provider`（`MOCK`/`WECHAT`）, `transaction_id`, `amount_cents`, `status`（`PENDING`/`SUCCESS`/`FAILED`/`REFUNDED`）, `raw_payload jsonb`, `created_at`, `paid_at`

**refunds**

`id`, `order_id`, `payment_id`, `amount_cents`, `reason`, `status`（`PENDING`/`SUCCESS`/`FAILED`）, `provider_refund_id`, `created_at`, `completed_at`

**pickup_counters**

`store_id`, `business_date`, `last_seq int`；联合主键

### 9.3 约束与索引

- `orders.order_no` 唯一；`orders(member_id, idempotency_key)` 唯一（key 可空）。
- `orders(store_id, status, created_at)`、`orders(store_id, business_date)` 索引。
- `orders(store_id, pickup_time_type, released_at)`、`orders(store_id, scheduled_at)` 索引，供预约队列查询。
- `orders(store_id, business_date, pickup_code)` 部分唯一索引。
- `order_items(order_id)`、`order_events(order_id, created_at)` 索引。
- `products(store_id, category_id, status, sort)` 索引。
- `payments(provider, transaction_id)` 唯一（非空时）。
- `members.phone` 唯一；`members.openid` 唯一。
- 金额字段 `CHECK (>= 0)`；`status` 用枚举/受控字符串。

### 9.4 金额与时间

- 金额：`int` 分；API 出入参也用分（`itemsAmountCents`），前端统一格式化。
- 时间：数据库 `timestamptz`，API ISO 8601 带时区；营业日/取餐码按 `Asia/Shanghai` 计算。
- 删除：商品/分类不做物理删除，用 `OFF_SHELF`/`status` 归档；订单永不删除。

## 10. API 设计

### 10.1 约定

- Base path `/api`；REST + JSON；成功直接返回数据，列表返回 `{ items, total, page, pageSize }`。
- 错误：HTTP 4xx/5xx + `{ code, message, details? }`，`code` 用稳定字符串。
- 鉴权：`Authorization: Bearer <JWT>`；顾客与员工 token 分离（不同 audience/secret）。
- 分页：`page`（默认 1）、`pageSize`（默认 20，最大 100）。
- 时间：ISO 8601；金额：分。
- 所有写接口做 DTO 校验；所有订单金额服务端重算。

### 10.2 公开接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/store` | 单店信息、营业状态、取餐提示 |
| GET | `/api/menu` | 分类 + 在售商品（含售罄标记） |
| GET | `/api/products/:id` | 商品详情 + 适用规格组/选项 |
| GET | `/api/health` | 健康检查（DB 连通） |

### 10.3 顾客接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/code` | 发送验证码；开发模式返回 `devCode` |
| POST | `/api/auth/login` | 手机号 + 验证码 → JWT + 会员信息 |
| GET | `/api/auth/me` | 当前会员 |
| PATCH | `/api/me` | 修改昵称等基础资料 |
| POST | `/api/orders/quote` | 服务端算价，返回明细/总额/可售校验 |
| POST | `/api/orders` | 创建订单（`Idempotency-Key` 头，`expectedTotalCents`） |
| POST | `/api/orders/:id/pay` | 发起支付；mock 直接成功，微信返回 JSAPI 参数（P1） |
| POST | `/api/orders/:id/cancel` | 仅 `PENDING_PAYMENT` 可取消 |
| GET | `/api/orders` | 我的订单，`status` 筛选/分页 |
| GET | `/api/orders/:id` | 订单详情 + 事件时间线 |

### 10.4 管理端接口

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/admin/auth/login` | 账号密码登录 |
| POST | `/api/admin/auth/change-password` | 修改密码 |
| GET | `/api/admin/dashboard` | 今日营业额/订单数/待接单/待取餐/最近订单；可选 `date`，口径见 10.7 |
| GET | `/api/admin/orders` | 订单列表，按状态/日期/类型（即时/预约）/关键字 |
| GET | `/api/admin/orders/:id` | 订单详情 + 事件 |
| POST | `/api/admin/orders/:id/accept` | `PAID → ACCEPTED`；未释放的预约单拒绝接单（409 `ORDER_NOT_RELEASED`） |
| POST | `/api/admin/orders/:id/ready` | `ACCEPTED → READY` |
| POST | `/api/admin/orders/:id/complete` | `READY → COMPLETED` |
| POST | `/api/admin/orders/:id/reject` | `PAID/ACCEPTED/READY/NO_SHOW → REFUNDING → REFUNDED`，需 reason |
| GET/POST | `/api/admin/categories` | 分类列表/新建 |
| PATCH/DELETE | `/api/admin/categories/:id` | 编辑/归档 |
| GET/POST | `/api/admin/products` | 商品列表/新建 |
| GET/PATCH/DELETE | `/api/admin/products/:id` | 详情/编辑/归档 |
| PATCH | `/api/admin/products/:id/status` | 上下架/沽清 |
| GET/POST | `/api/admin/spec-groups` | 规格组列表/新建 |
| PATCH/DELETE | `/api/admin/spec-groups/:id` | 编辑/删除（被引用则拒绝） |
| POST | `/api/admin/spec-groups/:id/options` | 新建选项 |
| PATCH/DELETE | `/api/admin/spec-options/:id` | 编辑/删除/置为不可用 |
| GET/PATCH | `/api/admin/store` | 门店设置 |
| POST | `/api/admin/uploads` | 图片上传（multipart，≤2MB） |
| GET | `/api/admin/staff` | P1 |
| GET | `/api/admin/reports/summary` | P1 |

### 10.5 支付回调（P1）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/payments/wechat/callback` | 验签、解密、按 transaction_id 幂等标记支付成功 |

### 10.6 错误码

`VALIDATION_ERROR`、`UNAUTHORIZED`、`FORBIDDEN`、`NOT_FOUND`、`RATE_LIMITED`、`STORE_CLOSED`、`PRODUCT_UNAVAILABLE`、`SPEC_REQUIRED`、`PRICE_CHANGED`、`ORDER_INVALID_STATUS`、`ORDER_NOT_RELEASED`、`ORDER_NOT_PAYABLE`、`ORDER_EXPIRED`、`PAYMENT_FAILED`、`UPLOAD_INVALID`、`INTERNAL_ERROR`。

### 10.7 工作台统计口径

- **统计日**：「今日」= `Asia/Shanghai` 自然日 `00:00:00–23:59:59`；单店营业时间不跨天，等价于营业日。管理端可传 `date=YYYY-MM-DD` 查历史日，默认今天。
- **营业额**：当日 `paid_at` 落在统计日、且状态不为 `PENDING_PAYMENT`/`CANCELED` 的订单 `paid_cents` 之和，减去当日 `refunds.completed_at` 落在统计日、状态为 `SUCCESS` 的退款金额（按退款发生日冲减，现金口径）。
- **订单数**：当日支付成功的订单数（含 `NO_SHOW`，不含未支付/已取消）。
- **客单价**：营业额 ÷ 订单数，四舍五入到分；订单数为 0 时显示 `—`。
- **待接单**：`PAID` 且（`ASAP` 或 `released_at IS NOT NULL`）的当前单量，不受统计日限制。
- **待取餐**：`READY` 当前单量，不受统计日限制。
- **最近订单**：按 `created_at` 倒序取 10 条。
- 工作台不把 `NO_SHOW` 计入待取餐，但计入营业额/订单数；退款后按退款日冲减。

## 11. 前端设计

### 11.1 顾客端（uni-app）

**结构**

```
apps/passenger/src/
  pages/index|menu|order/list|order/detail|mine|login|checkout|pay-result
  components/StoreCard|ProductCard|SpecSheet|CartSheet|OrderStatus|EmptyState
  stores/cart.ts|user.ts|store.ts|order.ts
  api/client.ts|auth.ts|catalog.ts|orders.ts
  styles/tokens.css|layout.css
  utils/money.ts|time.ts
```

**关键行为**

- 启动：读本地 token → `GET /auth/me`；失效则静默清除并去登录。
- 购物车按门店隔离，持久化到 `uni.storage`；加购合并同商品同规格。
- 规格弹层：默认项预选；必选组未选时按钮禁用并提示；价格随选项/数量实时变。
- 结算：进入时调 quote；金额变化提示；提交时带 `Idempotency-Key`（UUID），防重复。
- 支付：mock 模式按钮文案「模拟支付（开发）」；成功后 `redirectTo` 支付结果页，避免返回重复提交。
- 预约单：支付成功后支付结果页仍展示取餐码，同时显示「已预约 · 14:30 取餐」；释放前详情页状态为「已预约」，不显示「制作中」。
- 订单详情：状态为 `PAID/ACCEPTED/READY` 时每 5 秒轮询；`onHide` 暂停、`onShow` 恢复；终态停止。
- 图片：商品图用 `mode="aspectFill"`，加载失败显示本地占位图。
- 空态/异常：休息中、售罄、无订单、网络失败均有独立文案与重试按钮。
- 适配：`env(safe-area-inset-bottom)`；底部 Tab + 购物车浮条不重叠；375px 起。

**页面细节**

- 首页：门店卡（名称/地址/距离/营业状态）→ 取餐提示条 → 活动 Banner（占位）→ 热销横滑 → 最近订单卡。
- 菜单：顶部粘性「门店 + 自提」；左侧分类高亮联动；右侧商品卡展示图/名/描述/价格/加购按钮；售罄盖灰标。
- 购物车弹层：商品行（图/名/规格/单价/数量 stepper）、清空、合计、去结算。
- 结算：取餐时间（立即/预约 15 分钟粒度）、备注（≤50 字）、联系人手机号（默认登录手机号）、金额明细。
- 支付结果：取餐码 48px 大字、预计时间、状态条、门店地址、「查看订单」。
- 订单详情：状态时间线（下单/支付/接单/出杯/完成）、取餐码、商品明细、金额、门店信息。

### 11.2 管理端（Vue3 + Element Plus）

**结构**

```
apps/admin/src/
  layout/AppLayout.vue
  views/login|dashboard|orders|products|product-edit|specs|store|account
  components/OrderCard|OrderDrawer|StatusTag|ImageUpload|SpecGroupEditor
  api/client.ts|auth.ts|orders.ts|catalog.ts|store.ts
  stores/auth.ts|orders.ts
  router/index.ts
  styles/element-overrides.css|tokens.css
```

**关键行为**

- 登录后 token 存 localStorage；路由守卫无 token 跳登录；401 清 token 并跳登录。
- 订单看板分三个 Tab：「进行中」（`PAID` 已释放 + `ACCEPTED` + `READY`）、「预约」（未释放的未来单，按 `scheduled_at` 排序）、「全部」；默认「进行中」。
- 「进行中」5 秒轮询；新单检测到已释放订单数/最大 `createdAt` 变化时播放提示音 + 标题闪烁；未释放的预约单不响铃。
- 预约单到 `release_at` 后自动从「预约」移到「进行中」；看板 5 秒轮询能感知，不需要手动刷新。
- 提示音需用户手势解锁：顶部「开启提示音」按钮，状态存 localStorage。
- 订单操作按钮按状态显示；未释放的预约单不显示「接单」；点击后禁用至请求返回；失败 toast + 刷新当前单。
- 拒单弹窗必填原因；确认后调 reject；mock 环境立即退款。
- 商品表单：价格用「元」输入、提交转分；图片上传后回显 URL；规格组多选；排序数字；状态单选。
- 规格页：左侧组列表，右侧选项表格；修改加价/默认值/可用状态即时保存。
- 门店设置：7 天营业时间编辑器（开关 + 时间选择器）；接单开关；保存后 C 端下次请求生效。
- 工作台：4 个统计卡 + 最近 10 单表格；10 秒轮询；统计卡 hover 显示口径说明（见 10.7）。

### 11.3 设计系统

| Token | 值 | 用途 |
|---|---|---|
| `--color-espresso` | `#2B1D16` | 主文字、侧栏、取餐码 |
| `--color-cream` | `#F7F1E8` | C 端页面底色 |
| `--color-caramel` | `#C07A45` | 主按钮、强调 |
| `--color-caramel-dark` | `#A5622F` | 按压态 |
| `--color-success` | `#3F8F5B` | 待取餐/成功 |
| `--color-warning` | `#D98B2B` | 待接单/制作中 |
| `--color-danger` | `#C7483C` | 退款/错误 |
| `--color-text-secondary` | `#7A6A5F` | 次要文字 |
| `--color-border` | `#E8DED2` | 分割线/描边 |
| `--radius-lg` | `16px` | 卡片 |
| `--radius-md` | `12px` | 按钮/输入 |
| `--radius-sm` | `8px` | 标签 |

- C 端：奶油底 + 白卡 + 焦糖 CTA；商品图大、层级少、字号大；数字用 tabular-nums。
- B 端：浅灰底 + 白卡 + 深咖啡侧栏；Element Plus 主色覆盖为焦糖；状态标签统一配色。
- 文案语气：温暖、直接，不用网络梗；例如「一杯好咖啡，刚好现在。」
- 可访问性：正文对比度 ≥ 4.5:1；可点区域 ≥ 44×44；不只用颜色表达状态（配文字）。

### 11.4 状态与空态

| 场景 | 文案/表现 |
|---|---|
| 门店休息 | 「门店休息中 · 营业时间 08:00–20:00」，点单按钮禁用 |
| 商品售罄 | 图片盖灰 + 「今日售罄」，不可加购 |
| 购物车为空 | 「还没有选咖啡，去看看菜单吧」+ 去点单 |
| 无订单 | 「还没有订单，去点一杯吧」+ 去点单 |
| 网络失败 | 「网络开小差了」+ 重试 |
| 支付超时 | 「订单已超时关闭」+ 重新下单 |
| 预约等待中 | 「已预约 · 14:30 取餐」+ 门店地址 |
| 超时未取 | 「已关闭 · 超时未取」+ 联系门店 |

## 12. 后端设计

### 12.1 模块

```
apps/api/src/
  main.ts / app.module.ts
  common/ (filters, interceptors, guards, decorators, errors, money, time)
  prisma/ (PrismaService)
  auth/ (customer + staff)
  members/
  stores/ (store info, business hours)
  catalog/ (categories, products, spec groups/options)
  orders/ (quote, create, list, detail, state machine)
  payments/ (PaymentProvider, MockPaymentProvider)
  admin/ (dashboard, order actions, catalog/store management)
  uploads/
  health/
  jobs/ (timeout cancel, code cleanup)
```

模块化单体；模块间通过 service 调用，不跨模块直接查表（PrismaService 可用，但业务查询收敛在所属模块）。

### 12.2 关键服务

- `PricingService`：输入 items + 规格选择，输出逐项价格/总额；quote 与下单共用。
- `OrderStateService`：转换表 + 条件更新 + 写 `order_events`。
- `PickupCodeService`：计数器事务 + 补零 + 唯一冲突重试。
- `BusinessHoursService`：营业中判断、预约时段校验、营业日计算。
- `PaymentService`：provider 选择、发起支付、标记成功、退款；幂等。
- `OrderExpiryJob`：每分钟扫描 `PENDING_PAYMENT AND expires_at < now()` → `CANCELED`。
- `ScheduledOrderReleaseJob`：每分钟把到 `release_at` 的预约单置 `released_at`，写事件。
- `NoShowJob`：每日 23:59（`Asia/Shanghai`）把当日 `READY` 改 `NO_SHOW`，写事件。
- `UploadsService`：multer 本地存储，限制类型/大小，返回可访问 URL。

### 12.3 事务与并发

- 创建订单：校验门店/商品/规格 → 算价 → 创建 order + items + event（一个事务）。
- 支付成功：锁订单（`FOR UPDATE`）→ 校验状态/过期 → 创建 payment → 改 `PAID` → 生成取餐码/ETA → event（一个事务）。
- 拒单退款：锁订单 → 改 `REFUNDING` → 创建 refund → mock 成功 → 改 `REFUNDED` → event（一个事务；P1 微信退款分两步）。
- 状态推进：`UPDATE ... WHERE status = expected`；0 行时读当前状态返回 409/幂等结果。
- 幂等键：`orders(member_id, idempotency_key)` 唯一；重复创建捕获唯一冲突后查回原订单。

### 12.4 鉴权与安全

- 顾客 JWT：7 天；员工 JWT：12 小时；不同 secret/audience。
- 密码：bcrypt（cost 10+）；登录失败限流（同 IP/账号 5 次/分钟）。
- 管理端 RBAC：`OWNER` 全量；`STAFF` 仅订单/沽清（P1 细化）。
- 输入：class-validator + whitelist；禁止未知字段。
- 上传：仅 jpg/png/webp，≤2MB，随机文件名，禁止路径穿越。
- 日志：request id；手机号脱敏；不记录密码/token/支付密钥。
- 生产：helmet、CORS 白名单、Swagger 关闭、错误不返回堆栈。

### 12.5 配置

`.env`：

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://tocoffee:tocoffee@localhost:5433/tocoffee?schema=public
JWT_CUSTOMER_SECRET=...
JWT_STAFF_SECRET=...
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
AUTH_DEV_MODE=true
PAYMENT_MODE=mock
UPLOAD_DIR=./uploads
PUBLIC_BASE_URL=http://localhost:3000
SEED_ADMIN_USERNAME=owner
SEED_ADMIN_PASSWORD=admin123
```

`AUTH_DEV_MODE=true` 时 `/auth/code` 返回 `devCode`，仅限本地/演示；生产必须 false。
`PAYMENT_MODE=mock` 时支付立即成功；生产切 `wechat` 并补微信配置。

## 13. 开发与部署

### 13.1 仓库结构

```
ToMe/
  apps/
    api/            NestJS
    admin/          Vue3 + Vite + Element Plus
    passenger/      uni-app + Vue3
  docs/
    architecture/project-structure.md   目录职责/依赖方向/命名规范
    dev-log/                            每日开发日志与进度总表
    superpowers/specs/2026-11-04-tocoffee-design.md
    superpowers/plans/2026-11-04-tocoffee-p0-plan.md
  docker-compose.yml
  .env.example
  README.md
```

不引入 workspace/monorepo 工具，三个 app 独立 `npm install`，与 OneSoon 习惯一致。

**目录强约束**：每个文件的归属、模块分层、依赖方向、命名和禁止清单以 `docs/architecture/project-structure.md` 为准；实现时不得把 controller/service/dto 或页面/组件/请求堆在 `src` 根目录。

### 13.2 本地启动

```bash
# 0. 环境变量（首次；Windows 用 Copy-Item .env.example .env）
cp .env.example .env

# 1. Postgres
docker compose up -d

# 2. API
cd apps/api
npm install
npx prisma migrate dev
npm run seed
npm run start:dev        # http://localhost:3000/api

# 3. 管理端
cd apps/admin
npm install
npm run dev              # http://localhost:5173

# 4. 顾客端 H5
cd apps/passenger
npm install
npm run dev:h5           # http://localhost:5174
```

小程序：`npm run dev:mp-weixin` → 微信开发者工具导入 `dist/dev/mp-weixin`；AppID 可先用测试号/占位。

### 13.3 Docker

- `docker-compose.yml`：`postgres:16`，项目名 `tocoffee`，容器名 `tocoffee-postgres`，库/用户/密码均为 `tocoffee`，卷 `tocoffee_pgdata`，网络 `tocoffee_default`，健康检查 `pg_isready`；主机端口 **5433**（映射容器 5432）。
- **与 OneSoon 物理隔离**：不同目录/ compose 项目/容器/卷/网络/数据库/端口。禁止复用 `onesoon` 的库、卷或容器；两者可同时运行。
- API 启动时校验 `current_database()` 必须等于 `tocoffee`，否则拒绝启动，防止 `.env` 误连到 `onesoon`。
- P1 可加 `api`/`admin` 的 prod compose + nginx；P0 不强制。
- 上传目录挂 volume，避免容器重建丢图。

### 13.4 Seed

- 1 家门店：ToCoffee 示例店，08:00–20:00，制作 8 分钟。
- 5 个分类、12 个商品、5 个规格组（杯型/温度/糖度/奶基/加料）。
- 1 个店主账号（用户名/密码来自 env，默认 `owner`/`admin123`，启动日志提示修改）。
- 商品图用本地占位图；店主可后台上传替换。
- seed 可重复执行（upsert），不重复插入。

## 14. 测试与验收

### 14.1 自动化测试

- 单元：`PricingService`（加价/数量/必选校验）、`OrderStateService`（合法/非法转换、未释放预约单不能接单）、`BusinessHoursService`（营业中/休息/预约边界）、`PickupCodeService`（日切/并发/补零/跨日预约取餐码）、`OrderReleaseService`（预约释放时间）、`DashboardService`（统计口径/退款冲减）。
- e2e（Supertest + 测试库）：登录 → 菜单 → quote → 下单 → mock 支付 → 管理端接单 → 出杯 → 取餐；重复支付；超时取消；价格变更 409；非法状态 409；预约单支付后不响铃/不接单，提前 10 分钟（或制作时长+2）释放；打烊后 `READY → NO_SHOW`；跨日预约取餐码落在取餐日。
- 前端：`vue-tsc --noEmit`；管理端关键表单手动回归；C 端 H5 + 微信开发者工具各走一遍主流程。
- seed 与迁移在空库可一键跑通。

### 14.2 P0 验收清单

- [ ] 顾客能登录、看到门店营业状态、浏览菜单、选规格、加购、结算、模拟支付、拿到取餐码。
- [ ] 规格/数量变化时价格正确；售罄商品不可下单；必选规格未选不能加购。
- [ ] 管理端能看到新订单（5 秒内）、接单、出杯、确认取餐；能拒单退款并填原因。
- [ ] 预约单支付后显示「已预约」，不进待接单、不响铃；提前 10 分钟（或制作时长+2）自动释放并响铃；未释放时接单返回 409。
- [ ] 打烊后当日 `READY` 自动转 `NO_SHOW`；不计入待取餐；可手动退款。
- [ ] 工作台营业额/订单数符合 10.7 口径；退款按退款日冲减。
- [ ] 管理端能 CRUD 分类/商品/规格、上传图片、改营业时间、开关接单、沽清。
- [ ] 订单金额全部服务端计算；`expectedTotalCents` 不一致返回 409。
- [ ] 重复提交订单/重复支付/重复接单不会产生重复数据。
- [ ] 15 分钟未支付自动取消；取餐码每日唯一、跨日重置；跨日预约使用取餐日号段。
- [ ] 空库 → migrate → seed → 启动 → 演示闭环，按 README 可复现。
- [ ] 手机 375px 宽无横向滚动；管理端 1280px 布局正常。
- [ ] `npm run build`（api/admin）与 `vue-tsc`（passenger）通过。

## 15. 里程碑

| 阶段 | 内容 | 预计 |
|---|---|---|
| M0 | 设计文档确认 | 第 0 天 |
| M1 | 仓库脚手架、Docker/Prisma/seed、登录、门店/菜单 API、C 端首页/菜单/规格/购物车 | 第 1 周 |
| M2 | 下单/quote/模拟支付/取餐码、预约释放、订单列表/详情、管理端登录/订单看板 | 第 2 周 |
| M3 | 管理端商品/规格/门店/上传、工作台口径、打烊 `NO_SHOW` 任务、测试、小程序开发者工具走查、演示脚本 | 第 3 周 |
| P1 | 微信支付/退款、优惠券、积分/储值、打印、报表、店员权限 | +3–4 周 |

P0 按 3 周排，含 2 天缓冲；一个人全栈执行。

## 16. 风险

| 风险 | 影响 | 应对 |
|---|---|---|
| 没有微信支付商户号/企业主体（P1） | P1 无法真实收款 | P0 mock 先跑通；并行启动资质申请，P1 接真实支付 |
| 小程序类目/食品经营许可证审核（P1 上线） | P1 无法上线 | 上线前准备营业执照/食品经营许可证；类目选「餐饮服务」 |
| 微信开发者工具无 AppID | 部分小程序能力受限 | P0 用测试号/占位 AppID；mock 支付不依赖微信支付 |
| uni-app 在真机小程序上的兼容问题 | 页面错位/API 不可用 | 第 1 周就在微信开发者工具走主流程；具备 HTTPS 后补真机走查 |
| 时区/营业日算错 | 取餐码/营业状态错误 | 统一 `Asia/Shanghai` 工具 + 单测覆盖跨日 |
| 并发点击导致状态错乱 | 重复接单/重复退款 | 条件更新 + 状态机 + e2e |
| 改价导致顾客看到的价格与支付不一致 | 投诉/对账问题 | 下单重算 + `PRICE_CHANGED` 409 + 前端提示 |
| 提示音被浏览器自动播放策略拦截 | 漏单 | 手动「开启提示音」+ 新单红点/标题闪烁兜底 |
| 范围蔓延（外卖/会员/多店） | P0 延期 | 非目标清单写死，新增需求进 P1 |
| 本地图片存储丢失 | 商品图裂 | Docker volume + 生产换 COS/OSS |

## 17. 已确认决策（2026-11-04）

> 以下为用户确认的 P0 边界，已写入正文；实施阶段不再重复询问。

1. **验收环境**：只做「本地 Docker + H5 + 微信开发者工具」演示；不做云服务器、备案域名、HTTPS、真机真实支付。
2. **支付**：P0 用 mock 支付（点击即成功）；微信支付 v3 留到 P1。
3. **品牌与菜单**：先用示例品牌 ToCoffee + 示例菜单（见附录 A）；图片用本地占位图，后台上传替换。
4. **管理端账号**：只做店主一个 `OWNER` 账号；`STAFF` 角色与权限留到 P1。
5. **顾客端框架**：Vue3 + uni-app，一套代码编译微信小程序，同时保留 H5 预览。

---

## 附录 A：示例品牌与菜单（seed 数据）

**门店**：ToCoffee 示例店 · 广州市天河区示例路 88 号 · 08:00–20:00 · 制作 8 分钟 · 每单间隔 2 分钟 · 取餐提示「到店后报取餐码，在吧台取咖啡」。

**分类（5）**：招牌咖啡、经典咖啡、非咖啡、茶饮、小食。

**商品（12）**

| # | 分类 | 商品 | 基础价（元） | 适用规格组 | 标签 |
|---|---|---|---|---|---|
| 1 | 招牌咖啡 | 生椰拿铁 | 22 | 杯型、温度、糖度、奶基、加料 | 招牌、热销 |
| 2 | 招牌咖啡 | 焦糖玛奇朵 | 25 | 杯型、温度、糖度、奶基、加料 | 招牌 |
| 3 | 招牌咖啡 | 燕麦拿铁 | 24 | 杯型、温度、糖度、奶基、加料 | 热销 |
| 4 | 经典咖啡 | 美式 | 15 | 杯型、温度、加料 | — |
| 5 | 经典咖啡 | 拿铁 | 18 | 杯型、温度、糖度、奶基、加料 | 热销 |
| 6 | 经典咖啡 | 卡布奇诺 | 18 | 杯型、温度、糖度、奶基、加料 | — |
| 7 | 经典咖啡 | 摩卡 | 22 | 杯型、温度、糖度、奶基、加料 | — |
| 8 | 非咖啡 | 抹茶拿铁 | 22 | 杯型、温度、糖度、奶基、加料 | — |
| 9 | 非咖啡 | 热巧克力 | 20 | 杯型、温度、加料 | — |
| 10 | 茶饮 | 柠檬茶 | 16 | 杯型、温度、糖度 | 新品 |
| 11 | 茶饮 | 白桃乌龙 | 18 | 杯型、温度、糖度 | 新品 |
| 12 | 小食 | 可颂 | 12 | 无 | — |

**规格组（5）**

| 规格组 | 类型 | 选项（加价，元） | 默认 |
|---|---|---|---|
| 杯型 | 单选、必选 | 中杯 +0 / 大杯 +3 | 中杯 |
| 温度 | 单选、必选 | 热 +0 / 冰 +0 / 少冰 +0 / 去冰 +0 | 热（茶饮默认冰） |
| 糖度 | 单选、必选 | 标准 +0 / 少糖 +0 / 无糖 +0 | 标准 |
| 奶基 | 单选、必选 | 牛奶 +0 / 燕麦奶 +3 / 椰奶 +0 | 牛奶（生椰拿铁默认椰奶） |
| 加料 | 多选、可选，最多 3 | 浓缩 +4 / 奶油 +3 / 糖浆 +2 | 无 |

**示例账号**：`owner` / `admin123`（env 可改，启动日志提示修改）。

**占位图**：`apps/passenger/src/static/placeholder-product.png`、`placeholder-logo.png`；后台可上传替换。

---

## 附：默认调用（builder 可直接执行，用户可改）

- 顾客端用 uni-app + Vue3 + TS + Pinia，不用原生小程序/Taro。
- ORM 用 Prisma；迁移与 seed 纳入仓库。
- 支付先 mock，provider 接口预留微信支付 v3。
- 购物车放客户端，不建服务端购物车表。
- 订单状态用 `PENDING_PAYMENT/PAID/ACCEPTED/READY/COMPLETED/NO_SHOW/CANCELED/REFUNDING/REFUNDED`，不单独设 `MAKING`（`ACCEPTED` 即顾客端「制作中」）。
- 预约单支付后仍为 `PAID`，`release_at = 预约时间 - max(10 分钟, 制作时长 + 2 分钟)`；释放前不响铃、不能接单，释放后进制作队列，目标预约时间前 2 分钟出杯。
- 取餐码支付成功时生成，按「取餐营业日」每日每店重置；跨日预约占用取餐日号段。
- 打烊后当日 `READY` 自动转 `NO_SHOW`，不自动退款。
- 工作台按 `Asia/Shanghai` 自然日、支付口径统计，退款按退款日冲减。
- P0 管理端单账号 `OWNER`，员工权限 P1。
- P0 只做自提，不做堂食桌码/外卖。
- 商品图先本地占位，后台上传替换；生产再接对象存储。
