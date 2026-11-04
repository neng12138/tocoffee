# ToCoffee

单店自提咖啡点单小程序：顾客端（微信小程序 / H5）+ 门店管理端 + NestJS API。

## 当前状态

P0 设计已批准，实施计划已排期，**尚未开始写产品代码**。下一步从 Day 1（仓库 / Docker Compose / 三端脚手架）开始。

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

D1 完成后补充启动命令。设计阶段只需要阅读 `docs/`。
