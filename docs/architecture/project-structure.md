# ToCoffee 项目结构规范

> 状态：已确认（2026-11-04）
> 适用范围：`apps/api`、`apps/admin`、`apps/passenger` 及根目录
> 原则：**按业务域分文件夹，不按文件类型堆在 `src` 根目录**；每个文件有唯一归属；依赖方向单向，禁止反向引用。

## 1. 根目录

```
ToMe/
├─ apps/
│  ├─ api/                    NestJS 后端
│  ├─ admin/                  管理端 Vue3 + Element Plus
│  └─ passenger/              顾客端 uni-app + Vue3
├─ docs/
│  ├─ architecture/
│  │  └─ project-structure.md 本文件
│  ├─ dev-log/
│  │  ├─ README.md            每日收尾流程与索引
│  │  ├─ TEMPLATE.md          日志模板
│  │  ├─ PROGRESS.md          D1–D15 进度总表
│  │  └─ YYYY-MM-DD.md        每天一篇开发日志
│  ├─ superpowers/
│  │  ├─ specs/               设计文档
│  │  └─ plans/               实施计划
│  └─ notes.md                实现中的决策/踩坑记录
├─ scripts/
│  ├─ dev/                    本地开发脚本（重置库、演示数据）
│  └─ README.md               脚本说明
├─ docker-compose.yml         只跑 PostgreSQL
├─ .env.example               Compose 环境变量模板
├─ .gitignore
├─ .editorconfig
└─ README.md
```

规则：

- 根目录**不放业务代码**，不放 `node_modules`、`dist`、`uploads`、数据库数据。
- 不引入 npm workspace；三个 app 各自 `package.json`、各自 `npm install`。
- 根目录不建 `package.json`，避免误以为可以一条命令装完三端。
- 根目录 `.env.example` 只给 Compose 用；各 app 的环境变量模板放在各自目录。
- 每天收尾必须写 `docs/dev-log/YYYY-MM-DD.md`，并更新 `docs/dev-log/PROGRESS.md`；日志与代码同一次提交。

## 2. 后端 `apps/api`

### 2.1 目录树

```
apps/api/
├─ prisma/
│  ├─ schema.prisma            数据模型唯一来源
│  ├─ migrations/             必须提交，别人靠它建表
│  └─ seed.ts                 示例门店/菜单/账号
├─ assets/
│  └─ seed/                   随仓库提交的示例图片（seed 复制到 uploads）
├─ src/
│  ├─ main.ts                 启动、全局前缀、管道、过滤器、Swagger
│  ├─ app.module.ts           只做模块装配
│  ├─ config/
│  │  ├─ configuration.ts     读取环境变量并分组
│  │  └─ env.validation.ts    启动时校验必填变量
│  ├─ database/
│  │  ├─ prisma.module.ts
│  │  └─ prisma.service.ts    连接、断开、current_database() 校验
│  ├─ common/                 跨模块的基础设施，禁止依赖 modules
│  │  ├─ auth/                JWT guard、当前用户装饰器、payload 类型
│  │  ├─ constants/           全局常量（订单状态、错误码除外）
│  │  ├─ dto/                 仅分页等通用 DTO
│  │  ├─ errors/              AppError、error-codes.ts
│  │  ├─ filters/             全局异常过滤器
│  │  ├─ interceptors/        响应包装、request id
│  │  ├─ pipes/               通用校验管道
│  │  ├─ types/               Request 扩展等全局类型
│  │  └─ utils/               money.ts、time.ts、order-no.ts 等纯函数
│  └─ modules/                业务域，一个域一个文件夹
│     ├─ health/
│     ├─ auth/
│     ├─ stores/
│     ├─ catalog/
│     ├─ pricing/
│     ├─ orders/
│     ├─ payments/
│     ├─ dashboard/
│     ├─ uploads/
│     └─ jobs/
├─ test/
│  ├─ e2e/                    Supertest 端到端
│  ├─ fixtures/               测试数据工厂
│  └─ setup/                  测试库初始化/清理
├─ uploads/                   运行时上传目录，git 忽略
├─ .env.example
├─ nest-cli.json
├─ package.json
├─ tsconfig.json
└─ tsconfig.build.json
```

### 2.2 业务模块内部

以 `orders` 为例，所有模块统一用这套骨架：

```
modules/orders/
├─ orders.module.ts
├─ controllers/
│  ├─ customer-orders.controller.ts
│  └─ admin-orders.controller.ts
├─ services/
│  ├─ orders.service.ts
│  ├─ order-state.service.ts
│  ├─ pickup-code.service.ts
│  └─ order-release.service.ts
├─ dto/
│  ├─ create-order.dto.ts
│  ├─ quote.dto.ts
│  └─ query-orders.dto.ts
├─ types/
│  └─ order-with-items.ts
└─ mappers/
   └─ order.mapper.ts
```

各层职责：

| 目录/文件 | 只做什么 | 禁止 |
|---|---|---|
| `*.controller.ts` | 路由、参数绑定、鉴权装饰器、调用 service、返回 DTO | 写 Prisma、写业务规则、算钱 |
| `*.service.ts` | 用例、事务、业务规则 | 直接读 `req/res`、拼 HTML |
| `*.repository.ts`（需要时） | 复杂查询/聚合，隔离 Prisma | 写业务状态机 |
| `dto/` | 请求/响应结构 + class-validator | 暴露 Prisma 实体 |
| `types/` | 模块内部类型 | 放运行时逻辑 |
| `mappers/` | Prisma 实体 → API DTO | 查数据库 |
| `*.module.ts` | 声明 controller/provider/imports/exports | 写业务代码 |

### 2.3 模块清单与边界

| 模块 | 负责 | 可以依赖 |
|---|---|---|
| `health` | 健康检查、DB 连通性 | database |
| `auth` | 验证码、顾客登录、员工登录、JWT 签发 | database、common/auth |
| `stores` | 门店信息、营业时间、接单开关 | database |
| `catalog` | 分类、商品、规格组/选项、菜单聚合 | database、stores（只读公开方法） |
| `pricing` | quote、价格计算、预计取餐时间 | catalog 的公开查询方法 |
| `orders` | 下单、支付后状态、取餐码、订单查询、状态机 | pricing、catalog、payments、database |
| `payments` | `PaymentProvider` 接口、Mock/微信实现、退款 | database |
| `dashboard` | 工作台统计 | database（只读） |
| `uploads` | 图片上传、静态文件 URL | common |
| `jobs` | 定时任务，只调用各域 service | orders、payments |

规则：

- `common/`、`config/`、`database/` **不得 import `modules/`**。
- 跨模块只能调用对方 `*.module.ts` 导出的 service；禁止直接 import 对方 `controllers/`、`dto/`、`mappers/`。
- `jobs/` 不写业务逻辑，只做“扫描 + 调用 service + 记日志”。
- Prisma 只允许出现在 `database/`、`*.service.ts`、`*.repository.ts`；controller、job、mapper 里禁止。
- 不允许循环依赖；出现时把共享逻辑下沉到 `common/` 或独立模块。

## 3. 管理端 `apps/admin`

```
apps/admin/
├─ src/
│  ├─ main.ts
│  ├─ App.vue
│  ├─ router/
│  │  ├─ index.ts             路由表 + 懒加载
│  │  └─ guards.ts            登录守卫
│  ├─ layouts/
│  │  └─ AppLayout.vue        侧栏/顶栏/内容区
│  ├─ views/                  一个路由一个目录
│  │  ├─ login/LoginView.vue
│  │  ├─ dashboard/DashboardView.vue
│  │  ├─ orders/OrdersView.vue
│  │  ├─ products/
│  │  │  ├─ ProductsView.vue
│  │  │  ├─ ProductEditView.vue
│  │  │  └─ components/       仅本页使用的组件
│  │  ├─ specs/SpecsView.vue
│  │  └─ store/StoreView.vue
│  ├─ components/
│  │  ├─ common/              通用展示组件
│  │  │  ├─ PageHeader.vue
│  │  │  ├─ EmptyState.vue
│  │  │  ├─ StatusTag.vue
│  │  │  └─ ImageUpload.vue
│  │  └─ domain/              业务组件，按域再分
│  │     ├─ order/OrderCard.vue
│  │     ├─ order/OrderDrawer.vue
│  │     ├─ product/SpecGroupEditor.vue
│  │     └─ store/BusinessHoursEditor.vue
│  ├─ api/                    每个业务域一个文件
│  │  ├─ client.ts            axios 实例、token、错误处理
│  │  ├─ auth.ts
│  │  ├─ orders.ts
│  │  ├─ catalog.ts
│  │  ├─ store.ts
│  │  ├─ dashboard.ts
│  │  └─ uploads.ts
│  ├─ stores/
│  │  └─ auth.ts              只放全局状态；页面状态留在页面
│  ├─ composables/
│  │  ├─ usePolling.ts
│  │  ├─ useOrderSound.ts
│  │  └─ usePagination.ts
│  ├─ utils/
│  │  ├─ money.ts
│  │  ├─ time.ts
│  │  └─ storage.ts
│  ├─ constants/
│  │  └─ order.ts             状态文案/颜色映射
│  ├─ types/
│  │  ├─ api.ts
│  │  ├─ auth.ts
│  │  ├─ order.ts
│  │  ├─ catalog.ts
│  │  └─ store.ts
│  ├─ styles/
│  │  ├─ index.css
│  │  ├─ variables.css
│  │  └─ element-overrides.css
│  └─ assets/
├─ .env.example
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

规则：

- `views/` 只做页面组合和路由参数处理；不直接 `axios`，不写金额换算。
- `api/` 是唯一发请求的地方；统一从 `client.ts` 走，统一解包 `{ code, message }`。
- `components/common` 只放与业务无关的展示组件；业务组件放 `components/domain/<域>/`。
- 只在单页使用的组件放 `views/<页面>/components/`，不要污染全局 `components/`。
- `utils/` 必须是纯函数，不 import Vue、Pinia、api。
- `stores/` 只放跨页面状态；订单筛选、表单草稿等留在页面。
- 类型只放 `types/`，禁止在组件里散落大段 `interface`。
- 不建全局 `index.ts` barrel，避免循环依赖和打包拖慢。

## 4. 顾客端 `apps/passenger`

```
apps/passenger/
├─ src/
│  ├─ main.ts
│  ├─ App.vue
│  ├─ pages.json              路由/ TabBar 唯一注册处
│  ├─ manifest.json           小程序 AppID/配置
│  ├─ uni.scss
│  ├─ pages/                  一个路由一个文件/目录
│  │  ├─ index/index.vue
│  │  ├─ menu/menu.vue
│  │  ├─ checkout/checkout.vue
│  │  ├─ pay-result/pay-result.vue
│  │  ├─ order/list.vue
│  │  ├─ order/detail.vue
│  │  ├─ mine/mine.vue
│  │  └─ login/login.vue
│  ├─ components/
│  │  ├─ common/              通用展示
│  │  │  ├─ PriceText.vue
│  │  │  ├─ EmptyState.vue
│  │  │  └─ LoadingBlock.vue
│  │  ├─ product/             商品域
│  │  │  ├─ ProductCard.vue
│  │  │  ├─ SpecSheet.vue
│  │  │  ├─ CartSheet.vue
│  │  │  └─ QuantityStepper.vue
│  │  └─ order/               订单域
│  │     ├─ OrderStatus.vue
│  │     ├─ OrderItem.vue
│  │     └─ PickupCode.vue
│  ├─ api/
│  │  ├─ client.ts           唯一使用 uni.request 的文件
│  │  ├─ auth.ts
│  │  ├─ catalog.ts
│  │  ├─ orders.ts
│  │  └─ store.ts
│  ├─ stores/
│  │  ├─ user.ts              token、会员信息
│  │  ├─ cart.ts              购物车、持久化、合并
│  │  └─ store.ts             门店信息/营业状态
│  ├─ composables/
│  │  ├─ useCart.ts
│  │  ├─ useOrderPolling.ts
│  │  └─ useLoginGuard.ts
│  ├─ utils/
│  │  ├─ money.ts
│  │  ├─ time.ts
│  │  └─ storage.ts           uni.storage 封装
│  ├─ constants/
│  │  └─ order.ts
│  ├─ types/
│  │  ├─ api.ts
│  │  ├─ catalog.ts
│  │  ├─ order.ts
│  │  └─ store.ts
│  ├─ static/
│  │  ├─ images/
│  │  └─ icons/
│  └─ styles/
│     ├─ variables.scss
│     └─ mixins.scss
├─ .env.example
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

规则：

- `pages/` 只写页面级组合；业务逻辑放 `stores/`、`composables/`、`api/`。
- `api/client.ts` 是唯一网络入口；页面和组件禁止直接 `uni.request`。
- `components/` 不 import `pages/`；展示组件不直接发请求，通过 props/emit 或 composable。
- `stores/cart.ts` 独占购物车增删改、同规格合并、`uni.storage` 持久化；结算页只读。
- `utils/money.ts` 只做分转元/格式化；禁止页面里写 `price / 100`。
- 禁止 `window`、`document`、`localStorage`、DOM 库；统一 `uni.*`。
- 图片：本地占位图放 `static/`，商品图用 API 返回的 URL。
- 新增页面必须同时改 `pages.json`，否则小程序不认。

## 5. 文档与脚本

```
docs/
├─ architecture/
│  └─ project-structure.md
├─ dev-log/
│  ├─ README.md               每日收尾流程
│  ├─ TEMPLATE.md             日志模板
│  ├─ PROGRESS.md             D1–D15 进度总表
│  └─ YYYY-MM-DD.md           每天一篇
├─ superpowers/
│  ├─ specs/2026-11-04-tocoffee-design.md
│  └─ plans/2026-11-04-tocoffee-p0-plan.md
└─ notes.md
```

- `docs/notes.md` 只记“实现与设计的偏差、踩坑、待确认”，不写流水账。
- `docs/dev-log/` 记录每天的目标、完成项、验证命令与结果、决策、阻塞、明日计划；详见该目录 `README.md`。
- 设计变更先改 spec，再改 plan，最后改代码；不允许代码与文档长期不一致。
- `scripts/dev/` 放可重复执行的本地脚本；脚本里不写死个人路径。

## 6. 新文件放哪里：判定顺序

1. 是路由页面？→ `pages/`（C 端）或 `views/`（B 端）。
2. 是可复用 UI？→ 通用放 `components/common/`，业务放 `components/<域>/`，单页私有放 `views/<页>/components/`。
3. 是 HTTP 请求？→ `api/<域>.ts`。
4. 是跨页面状态？→ `stores/`。
5. 是有状态的复用逻辑？→ `composables/`。
6. 是纯函数？→ `utils/`。
7. 是类型？→ `types/`。
8. 是常量/文案映射？→ `constants/`。
9. 是后端业务？→ `modules/<域>/`，再按 controller/service/dto 分。
10. 是跨模块基础设施？→ `common/`。
11. 是定时任务？→ `modules/jobs/`。
12. 是表结构？→ `prisma/schema.prisma` + migration。
13. 是文档？→ `docs/`。

## 7. 命名规范

| 类型 | 规范 | 示例 |
|---|---|---|
| Nest 文件 | kebab-case + 角色后缀 | `admin-orders.controller.ts`、`pickup-code.service.ts` |
| Vue 组件 | PascalCase | `OrderCard.vue`、`SpecSheet.vue` |
| 组合式函数 | `use` + PascalCase | `useOrderPolling.ts` |
| TS 类型/接口 | PascalCase | `OrderSummary`、`QuoteResult` |
| 变量/函数 | camelCase | `estimatedReadyAt`、`calculateQuote` |
| 常量 | UPPER_SNAKE_CASE | `ORDER_STATUS_LABELS` |
| 数据库表/字段 | snake_case | `order_items`、`pickup_code` |
| API 字段 | camelCase | `pickupCode`、`itemsAmountCents` |

## 8. 测试文件位置

- 后端单元测试：与被测文件同目录，`*.spec.ts`。
- 后端 e2e：`apps/api/test/e2e/*.e2e-spec.ts`。
- 测试数据工厂：`apps/api/test/fixtures/`。
- 测试库初始化/清理：`apps/api/test/setup/`。
- 前端 P0 不建单测目录；用 `vue-tsc --noEmit` + 手工验收。P1 再加 Vitest 时，测试放被测文件同目录 `__tests__/`。

## 9. 禁止清单

- ❌ `src/utils.ts`、`src/helpers.ts`、`src/common.ts` 这种大杂烩文件。
- ❌ 所有组件平铺在 `src/components/` 根目录。
- ❌ 页面/组件里直接 `axios` 或 `uni.request`。
- ❌ Controller 里写 Prisma 或业务规则。
- ❌ 跨模块直接 import 对方内部文件（controller/dto/mapper）。
- ❌ 把测试文件散落在 `src` 根目录。
- ❌ 提交 `.env`、`node_modules`、`dist`、`uploads`、`pgdata`。
- ❌ 在 C 端使用 Element Plus、DOM API、`localStorage`。
- ❌ 在页面里硬编码状态文案、颜色、金额换算。
- ❌ 无注释的 `any`、`@ts-ignore`。
- ❌ 新增顶级目录不更新本文件。

## 10. 示例：三个需求怎么落位

**需求 A：订单详情加“退款原因”**

- 后端：`modules/orders/`（状态/查询）+ `modules/payments/`（退款记录），DTO 放各自 `dto/`。
- 管理端：`views/orders/OrdersView.vue` + `components/domain/order/OrderDrawer.vue`。
- 顾客端：`pages/order/detail.vue` + `components/order/OrderStatus.vue`。
- 类型：两端 `types/order.ts`。

**需求 B：商品卡加“售罄”角标**

- 后端：`modules/catalog/` 返回 `status`，不改表。
- 管理端：`views/products/ProductsView.vue` 的状态列 + `PATCH status`。
- 顾客端：`components/product/ProductCard.vue` 根据 `status === 'SOLD_OUT'` 置灰。
- 文案/颜色：`constants/order.ts` 或 `constants/product.ts`。

**需求 C：新增“预约提前释放”任务**

- 后端：`modules/jobs/scheduled-release.job.ts`，只调用 `orders` 模块导出的 `OrderReleaseService`。
- 业务规则：`modules/orders/services/order-release.service.ts`。
- 测试：同目录 `order-release.service.spec.ts` + `test/e2e/scheduled-order.e2e-spec.ts`。
- 文档：先改 spec 8.6，再改 plan 5.6。

---

**执行要求**：Day 1 先按本文件建目录骨架，再写第一个文件；后续每个 PR/提交都按第 6 节判定归属。结构需要调整时，先改本文件并说明原因。
