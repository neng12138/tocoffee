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
- AppID：当前未配置（OneSoon 的 `mp-weixin.appid` 也是空）；D1 先用测试号/游客模式，P0 mock 支付不依赖真实 AppID。
- 版本坑：npm 上 `prisma` 的 `latest` 当前是 `8.0.0-rc.30`，已锁定 `prisma@6.19.3` + `@prisma/client@6.19.3`。
