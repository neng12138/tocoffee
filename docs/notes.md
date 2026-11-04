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
- 茶饮默认冰、生椰拿铁默认椰奶属于「按商品覆盖默认规格」，当前未入库；D4 前端选择规格或 D6 定价层按商品处理，避免在通用规格组里塞商品特例。
- seed 图片源文件在 `apps/api/assets/seed/`，启动时复制到 `apps/api/uploads/seed/`；`uploads/` 被 gitignore，图片 URL 为 `${PUBLIC_BASE_URL}/uploads/seed/...`，静态托管尚未接入（D3/D5 补）。
- seed 密码：`owner / admin123`；仅演示用，P1 上线前必须改。
