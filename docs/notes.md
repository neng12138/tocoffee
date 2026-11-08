# 实现笔记

> 只记“实现与设计的偏差、踩坑、待确认”，不写流水账。
> 每日详细记录放 `docs/dev-log/`；设计变更先改 `docs/superpowers/specs/`，再改计划。

## 待确认

- 暂无。

## 偏差与踩坑

- 暂无。

## 2026-11-04 开工前检查

- Git：`D:\weineng_work\ToMe` 当前分支 `nengxiong`，跟踪 `origin/nengxiong`；`main` 保留但不动。
- 工具链：Node v24.16.0、npm 11.13.0、Git 2.56.0、Docker 29.9.2、Docker Compose v5.6.1。
- Docker：Desktop 启动后 engine 正常；本地已有 `postgres:16` 镜像；`onesoon-postgres` 占用 5432，ToCoffee 固定 5433；3000/5173/5174/5433 均空闲。
- 网络：npm 镜像 `registry.npmmirror.com` 可用；GitHub HTTPS 可访问，`dcloudio/uni-preset-vue#vite-ts` 分支存在。
- 微信开发者工具：已安装 `2.02.2609240`（`D:\微信开发者工具\微信web开发者工具`），已登录；CLI 服务端口已开启，IDE 监听 `127.0.0.1:16928`，`cli islogin` 返回 `{"login":true}`。调用 CLI 时不要带 `--port 9420`（IDE 已固定在 16928，带 9420 会要求重启）。
- AppID：`apps/passenger/src/manifest.json` 的 `mp-weixin.appid` 仍为空；微信开发者工具导入时手动选 `wx7c9cd90fc226004b`，项目名 `tocoffee-passenger`。该 AppID 不写入仓库，避免把个人 AppID 固化进模板。
- 版本坑：npm 上 `prisma` 的 `latest` 当前是 `8.0.0-rc.30`，已锁定 `prisma@6.19.3` + `@prisma/client@6.19.3`。

## 2026-11-04 D1 实施

- 管理端脚手架实际版本：Vue 3.5.44 / Vite 8.3.5 / TS 6.0.3（`create-vite` 当前模板）；顾客端官方模板：Vue 3.4.21 / Vite 5.2.8 / TS 4.9.4。两端版本不一致是有意的：顾客端跟随 uni-app 编译器，未强行升级。
- H5 dev 初始只监听 `::1`，`http://127.0.0.1:5174` 会拒绝连接；已在 `apps/passenger/vite.config.ts` 与 `apps/admin/vite.config.ts` 固定 `host: '127.0.0.1'`。
- 微信开发者工具 2.02.2609240 的 CLI `open --project` 不接受 `touristappid`，报 `不存在此 AppID (code 10)`；构建产物本身正常。已改为手动导入 `apps/passenger/dist/dev/mp-weixin`，AppID 选 `wx7c9cd90fc226004b`，模拟器首页正常、控制台 0 错误；误选 `...\dist` 会报 `app.json 未找到`，正确目录是 `...\dist\dev\mp-weixin`，后续打开最近项目即可。
- 已加 `scripts/dev/check.ps1`，串起容器健康、API 构建/测试、管理端构建、顾客端类型检查、`git diff --check`。

## 2026-11-04 D2 数据层

- 15 张 P0 表落在 `apps/api/prisma/schema.prisma`；表/字段统一 snake_case，时间用 `timestamptz(3)`，营业日 `business_date` 用 `date`，金额全部整数分。
- Prisma schema 无法表达 CHECK 和部分唯一索引，因此迁移 SQL 手工追加了 16 个 CHECK 与 `orders_store_id_business_date_pickup_code_key ... WHERE pickup_code IS NOT NULL`。后续用 `prisma migrate dev` 生成新迁移时要检查是否会漂移/误删，必要时继续手工补。
- 密码哈希用 `bcryptjs@3.0.3` 替代原生 `bcrypt`，避免 Windows 原生编译；cost 10。
- `package.json#prisma.seed` 在 6.19.3 可用，但 Prisma 7 会移除并提示弃用；升级 Prisma 时改成 `prisma.config.ts`。
- seed 用固定 UUID + upsert，可重复执行；当前稳定计数：stores=1、staff=1、categories=5、products=12、specGroups=5、specOptions=15、productSpecGroups=47。
- 茶饮默认冰、生椰拿铁默认椰奶属于「按商品覆盖默认规格」，当前未入库；D4 前端选择规格，D7 结算/规格层再按商品处理，避免在通用规格组里塞商品特例。
- seed 图片源文件在 `apps/api/assets/seed/`，启动时复制到 `apps/api/uploads/seed/`；`uploads/` 被 gitignore，图片 URL 为 `${PUBLIC_BASE_URL}/uploads/seed/...`，静态托管尚未接入（D3/D5 补）。
- seed 密码：`owner / admin123`；仅演示用，P1 上线前必须改。

## 2026-11-04 D3 鉴权与公开接口

- 鉴权不用 Passport：`CustomerJwtGuard`/`StaffJwtGuard` 直接 `JwtService.verifyAsync`，分别校验 audience `tocoffee-customer` / `tocoffee-staff` 与不同 secret；顾客 token 7d、员工 24h。
- 验证码 mock：`AUTH_DEV_MODE=true` 时 `/api/auth/code` 返回 `devCode`；生产必须关闭并替换短信服务。验证码落库只存 bcrypt hash，5 分钟过期，一次性消费。
- 限流为单进程内存 Map（5 次/分钟），只适合本地单实例；多实例或生产要换 Redis。超限返回 429，details 带 `retryAfterSeconds`。
- 员工改密是计划外补充：owner 需要能改 seed 默认密码；要求新密码 ≥8 位且同时包含字母和数字。
- 菜单公开规则：active 分类；商品保留 `ON_SALE`/`SOLD_OUT`、排除 `OFF_SHELF`；规格组/选项按 sort；`isAvailable=false` 的选项不下发。
- `business_hours.day` 严格要求数字 1–7（周一=1），不接受字符串数字；P0 不支持跨天营业。
- `@nestjs/jwt` 的 `expiresIn` 类型是 `ms.StringValue`，从环境变量读到普通 string 时需要显式收窄；当前运行值 `7d`/`24h`。
- `uploads/` 在 D3 时未静态托管，菜单图片 URL 会 404；D4 已用 `NestExpressApplication.useStaticAssets` 挂到 `/uploads/`，本地图片 200。
- e2e 依赖本地 Docker PostgreSQL 与 D2 seed；跑之前确认 `tocoffee-postgres` healthy。

## 2026-11-04 D4 顾客端点单

- API 静态图片：`main.ts` 改为 `NestFactory.create<NestExpressApplication>`，挂载 `process.cwd()/uploads` 到 `/uploads/`；菜单图片 URL 由 `PUBLIC_BASE_URL` 拼接，H5 走 Vite 代理，小程序开发期直连 `http://127.0.0.1:3000`。生产要换成同域 HTTPS 域名并把小程序合法域名加白。
- 顾客端 API base：H5 用相对 `/api`，小程序用 `http://127.0.0.1:3000/api`；`uni.request` 类型不支持 PATCH，客户端只允许 GET/POST/PUT/DELETE。
- 购物车只存本地：key `tocoffee.cart.v1`，按 `storeId` 隔离，同商品同规格用 `productId + sortedOptionIds` 合并，单规格数量上限 20。D6 下单前必须由服务端 quote 重算价格，不能信任本地 unitPrice。
- 规格弹层对必选组没有默认项时自动选第一个；多选组按 `maxSelect` 截断，减少“加购按钮不可用”的困惑。商品特例（茶饮默认冰、生椰拿铁默认椰奶）仍未入库，D7 结算/规格层按商品覆盖。
- 小程序商品图/logo 使用本地 `static`，商品图 URL 指向本机 API；微信开发者工具需保持 `urlCheck=false`（模板默认）。
- Chrome headless 有最小视口 512px，直接 `--window-size=390` 截图会被裁；用 CDP `Emulation.setDeviceMetricsOverride` 设 390×844 后页面正常，确认不是布局 bug。
- H5 验收：390×844 下首页、菜单、规格弹层、购物车渲染正常；点击加购后购物车出现，刷新后能从 storage 恢复；控制台 0 error。
- D4 的「去结算」是占位，D8 接订单/支付后才可用。

## 2026-11-04 D5 管理端

- 管理端 API 全部按 `staff.storeId` 隔离，不能只靠前端过滤；分类/商品/规格/上传都从 `CurrentStaff` 取门店。
- 分类删除是归档为 `DISABLED`，商品删除是归档为 `OFF_SHELF`，保留历史订单引用；顾客端菜单只返回启用分类与在售/售罄商品。
- 规格组删除保护：被任一商品引用时返回 409；选项删除/停用保护：组内最后一个可用选项不允许，避免商品没有可选规格。
- 默认选项切换在同一事务内清除同组其他默认，保证每组最多一个 `isDefault=true`。
- 管理端价格表单用元，提交前 `yuanToCents`；API 始终收整数分，避免前端浮点。
- 商品图上传返回绝对 URL（`PUBLIC_BASE_URL + /uploads/...`），与 seed 一致；本地是 `http://127.0.0.1:3000`，生产必须换成 HTTPS 域名。
- **`.gitignore` 坑**：原规则 `uploads/` 是宽匹配，会把 `apps/api/src/modules/uploads/` 源码一起忽略，`git status` 看不到；已改为 `apps/*/uploads/`。新增同名业务目录时要检查 `git check-ignore -v`。
- 管理端 Element Plus 表格 slot 的 `row` 被推断为 `DefaultRow`，模板里需 `asCategory(row)`/`asProduct(row)`/`asOption(row)` 收窄；动态状态映射用 `statusOf(row)`，不要直接 `statusMeta[row.status]`。
- `el-switch @change` 参数类型是 `string | number | boolean`，回调参数不能只写 boolean。
- 管理端主 chunk 869.65 kB 是 Element Plus 全量引入；P0 接受，D14 再评估按需引入。
- 上传只落本地磁盘 `apps/api/uploads/products/YYYY/MM/`，`uploads/` 不进 git；换机器/清目录会丢用户上传图，P1 换对象存储。

## 2026-11-08 D6 报价与定价

- 定价做成纯函数 `PricingService.quote(input)`，不碰数据库；`OrdersService` 只负责按门店查商品/规格、统计队列并映射。单测固定 `now`，不依赖 Nest 或 PostgreSQL。
- quote 必须带顾客 token；报价不锁库存、不创建订单、不生成取餐码，用户可以反复报价。
- `queueCount` = `status in [PAID, ACCEPTED]` 且（立即单或 `releasedAt` 非空）；未支付单不占队列。预约单释放前不计入，释放后才影响立即单 ETA。
- 预约单 quote 的 `estimatedReadyAt=scheduledAt`，但 `release_at`/`released_at` 不在这里写；D7 下单时按 `scheduled_at - max(10, prep+2)` 生成。
- 15 分钟粒度同时校验 UTC 秒/毫秒为 0 和上海本地分钟 %15=0；上海时区偏移是 15 分钟的整数倍，所以两者等价。
- 错误映射：`VALIDATION_ERROR`/`SPEC_REQUIRED` 400，`PRODUCT_UNAVAILABLE`/`STORE_CLOSED` 409。缺规格组/必选选项归 `SPEC_REQUIRED`，商品售罄/下架/不存在归 `PRODUCT_UNAVAILABLE`。
- e2e 为了不依赖当前营业时间，`beforeAll` 把 seed 门店改成 00:00–23:59，`afterAll` 恢复；跑 e2e 时不要同时用手工验收营业时间边界。
- 已知偏差：生椰拿铁默认椰奶、茶饮默认冰仍未按商品覆盖；D6 只保证金额/规格校验，D7 在结算/规格层处理，避免现在加表。
- D6 只做后端 quote；顾客端结算页、`POST /api/orders`、幂等和支付超时留到 D7。

## 2026-11-08 D7 创建订单

- `POST /api/orders` 必须带 `Idempotency-Key`（8–64 位字母/数字/下划线/连字符）；按 `(memberId, key)` 先查后建，重复请求返回同一个订单对象。并发下靠 P2002 回查兜底。
- 订单号 `T + yyMMddHHmmss + 4 位随机`，在事务外生成；P2002 若不是幂等键重复，就按订单号碰撞重试，最多 3 次。
- `expectedTotalCents` 与本次 `payableCents` 不一致返回 409 `PRICE_CHANGED`，`details.quote` 是新报价；前端应提示“价格有变化”并刷新结算页。
- **临时偏差**：立即单 `businessDate` 在创建时先取创建日（设计原本要求支付日）。D8 支付接口必须用 `paid_at` 重算；否则跨日 23:59 下单、00:01 支付会记错营业日。
- **临时偏差**：预约单 `releaseAt` 在创建时按 `now` 计算，D8 支付后必须用 `paid_at` 再计算 `max(paid_at, scheduledAt - max(10, prep+2))`。新建单未支付时 `releasedAt` 仍为 null。
- `expiresAt` 在 D7 只是落库字段；D8 支付必须校验“仅本人、仅 PENDING_PAYMENT、未过期”，D10 再补自动取消/释放任务。
- e2e 配置改为 `fileParallelism: false`：测试共用一个 PostgreSQL，多个 suite 同时改门店营业时间会互相踩；顺序执行后 28 个 e2e 稳定通过。
- D7 只做了 API，没有做顾客端结算页；「去结算」仍是占位。D8 做支付时一起接结算页，避免先做一半再改。
- 新增测试会员 `13900000041`；afterAll 只删该会员的订单，不删会员，重复跑不会主键冲突，但测试库会累积会员。
