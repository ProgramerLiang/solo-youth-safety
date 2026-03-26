# Backend (FastAPI)

## 文档入口
- 路线图入口：`../docs/mvp/PROJECT_STATUS_AND_ROADMAP.md`
- 审查总表入口：`../docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`
- 整改清单入口：`../docs/mvp/整改清单与审查入口.md`
- 归档跳转页：`../docs/mvp/FINAL_AUDIT_REPORT_CN.md`、`../docs/mvp/FORMAL_GAP_AUDIT_REPORT.md`、`../docs/mvp/PROJECT_IMPROVEMENTS_REVIEW.md`

## 环境变量
可选环境变量：

```bash
SAFETY_DB_PATH=/absolute/path/to/safety.db
SAFETY_ALLOWED_ORIGINS=http://localhost:5173,https://your-web.example.com
```

说明：
- `SAFETY_DB_PATH` 可用于覆盖 SQLite 数据库文件位置
- `SAFETY_ALLOWED_ORIGINS` 用于配置远端 Web 访问的 CORS 白名单，使用英文逗号分隔多个来源

## 运行
```bash
cd backend
python3 -m pip install --user -r requirements.txt
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 测试
```bash
cd backend
python3 -m pip install --user -r requirements-dev.txt
python3 -m unittest discover -s tests -v
```

当前已覆盖的基础接口测试包括：
- `GET /api/v1/health`
- `GET/POST /api/v1/emergency/config`
- `POST /api/v1/sos/events`（含 notifications 细粒度状态持久化断言）
- `GET /api/v1/tracking/timeline` 时间范围校验
- `/api/v1/contacts` 联系人 CRUD
- 最小身份 / 归属校验：缺失请求头、非法 `X-Safety-Client-Mode`、头体不一致、跨用户资源拒绝、合法请求通过
- CORS 白名单配置读取

## SOS notifications 状态契约
- 远端 `/api/v1/sos/events` 的 `notifications[*].status` 已放宽为细粒度状态集合，用于和前端 / 原生侧统一摘要保持一致。
- 当前后端模拟结果约定为：
  - `call -> triggered`
  - `sms -> dispatched`
  - 未配置号码时仍返回 `skipped`
- 历史查询 `GET /api/v1/sos/events` 返回的 `notifications` 与创建接口使用相同状态枚举，不应在持久化后退化回旧的 `sent/skipped` 二元态。
- 兼容保留值：`sent`；扩展值：`failed`、`dispatched`、`triggered`、`attempted`、`permission-denied`、`partial-success`。

## 当前存储
- 远端后端已使用 SQLite 持久化
- 默认数据库路径：`backend/data/safety.db`
- 可通过环境变量覆盖：`SAFETY_DB_PATH=/path/to/custom.db`
- 当前后端 OpenAPI / 文档版本以 `backend/main.py` 为准，当前默认值为 `0.2.1`
- 后端当前只读取 `SAFETY_DB_PATH`；`SAFETY_APP_VERSION` 仍不是现状能力
- 若需了解与前端产物版本的现状差异，见 `../docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`

## 当前持久化内容
- 紧急通知配置
- 联系人
- SOS 历史
- 轨迹点
- SOS 通知日志

接口文档：
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`


## 当前安全口径
- 远端后端现已具备 **MVP 级最小请求头身份基线**：受保护接口要求 `X-Safety-User-Id`，部分设备写接口还要求 `X-Safety-Device-Id`。
- 若请求头中的身份与 query / body 中的 `userId`、`deviceId` 不一致，后端会返回 4xx 拒绝。
- `X-Safety-Client-Mode` 若提供且不为 `remote`，后端会拒绝该请求。
- CORS 已从默认全开放改为按 `SAFETY_ALLOWED_ORIGINS` 配置白名单。
- **重要**：这仍不是正式账号体系；当前没有登录、token、session、API key、刷新令牌或多用户授权流，只能视为远端联调 / MVP 的最小授权边界。

## 远端模式最小授权边界（MVP）
- 当前远端接口要求客户端携带 `X-Safety-User-Id`、`X-Safety-Device-Id`、`X-Safety-Client-Mode: remote`。
- 后端已基于请求头身份声明 + query/body 身份字段一致性，执行最小归属校验。
- 这表示远端模式已具备 **MVP 级最小授权边界** 与 **CORS 白名单收口**。
- 当前仍未引入正式账号体系、token、session、OAuth/JWT、API key、多租户组织模型或共享授权流。
- 受保护接口默认按“远端模式”处理；`GET /api/v1/health` 仍保持匿名可访问，用于健康检查与部署探活。
- P0-2 所需的 SOS 失败恢复与用户可见状态机已在前端摘要层落地；后续仍聚焦更完整的认证、设备管理、审计与部署安全，以及 P0-3 的 Android 后台限制边界澄清。

## 上线前仍不可跳过的安全基线
- 生产环境必须通过 HTTPS 暴露远端接口；当前代码与测试仅覆盖 CORS 白名单和最小身份边界，不代表可在明文传输环境上线。
- SQLite 中已持久化联系人、轨迹、SOS 历史与通知日志；上线前仍需补齐敏感字段存储策略、备份策略与最小化暴露原则。
- 在正式账号体系、部署安全模板与审计留痕落地前，外部口径只能表述为“已具备 MVP 级最小授权边界”，不能表述为“正式安全后端”。
