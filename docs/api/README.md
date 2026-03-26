# API Draft (MVP v0.2)

## Base Path
`/api/v1`

补充说明：
- 远端 FastAPI 当前已使用 SQLite 持久化
- 默认数据库文件：`backend/data/safety.db`
- 当前后端 OpenAPI 版本仍以 `backend/main.py` 中的 `APP_VERSION = "0.2.1"` 为准
- 当前远端后端已落地 MVP 级最小请求头身份基线与 CORS 白名单能力：通过 `SAFETY_ALLOWED_ORIGINS` 配置来源白名单，并在受保护接口校验 `X-Safety-User-Id` / `X-Safety-Device-Id` / `X-Safety-Client-Mode` 的最小一致性

## 当前契约约束（2026-03-26）
- 本地后端应尽量视为远端 API 的镜像实现
- 同名接口在本地 / 远端模式下应保持主要响应字段一致
- 若本地模式需要额外调试信息，应尽量放在调试工具路径或显式调试接口，不应默认混入业务响应
- 本轮会优先收敛响应结构、错误结构与契约测试基线

相关规划 / 审查文档：
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`（权威中文审查总表入口）
- `docs/mvp/整改清单与审查入口.md`（权威中文整改入口）
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
- `docs/mvp/FINAL_AUDIT_REPORT_CN.md`（历史归档 / 跳转页）
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`

## 远端身份 / 鉴权 / 归属校验 MVP 方案

> 本节描述的是 **当前已落地的 MVP 级最小授权边界 + 仍待补齐的非目标能力**。它用于联调与基础越权防护，但不等同于正式账号体系。

### 1. 身份模型
- `userId`：业务主身份，表示当前被守护用户；MVP 阶段仍由客户端生成并持久化。
- `deviceId`：设备身份，表示发起请求的安装实例 / 设备；用于区分同一用户的不同设备。
- 当前 **不引入正式账号体系**、密码登录、OAuth、JWT 或刷新令牌。
- 当前 **不引入多租户组织模型**、家庭组共享授权流或服务端会话。

### 2. 请求头约定（当前已落地）
远端模式下，health 之外的受保护接口当前应携带以下请求头：
- `X-Safety-User-Id: <userId>`
- `X-Safety-Device-Id: <deviceId>`
- `X-Safety-Client-Mode: remote`

说明：
- 这组请求头当前已用于 **后端最小身份强制校验**，不是纯文档占位。
- `X-Safety-User-Id` 缺失时，受保护接口会返回 `401`。
- 对需要设备归属校验的写接口，`X-Safety-Device-Id` 缺失时会返回 `401`。
- 若请求头与 body / query 中的身份字段不一致，后端当前会返回 `403`。
- `X-Safety-Client-Mode` 若提供且不为 `remote`，后端当前会返回 `403`。
- `GET /health` 保持匿名可访问；其余受保护接口进入该最小身份边界。
- 这些请求头仍然**不是正式安全凭证**；它们只是 MVP 阶段的最小身份声明与归属约束。

### 3. 参数约定
- 查询类接口：继续通过 query 传递 `userId`，例如 `GET /contacts?userId=u_123`。
- 写入类接口：继续在 body 中传递 `userId`，涉及设备写入时同时传递 `deviceId`。
- 在进入正式鉴权前，**请求头承载“身份声明”**，**query / body 承载“业务目标对象”**；两者应该保持一致。

### 4. 归属校验边界（MVP，当前基础版已落地）
MVP 的最小归属校验边界如下：
- 联系人配置、紧急通知配置、轨迹、SOS 历史等数据，均应只能被其 `userId` 对应的请求访问。
- 若接口同时出现 `userId` 与 `deviceId`，则 `deviceId` 只能代表该 `userId` 名下已登记或已接受的设备身份。
- 后端当前已对受保护接口执行以下最小校验：
  1. 请求头中的 `X-Safety-User-Id` 与 query / body 中的 `userId` 必须一致；
  2. 请求头中的 `X-Safety-Device-Id` 与 body 中的 `deviceId` 在需要设备归属的接口上必须一致；
  3. 目标资源（联系人、配置、轨迹、SOS 事件）按 `userId` 归属访问，不能仅通过改写参数跨用户读取或覆写；
  4. health 接口保持匿名可访问，其余受保护接口进入最小身份边界。

### 5. CORS 白名单约束
- 远端后端的浏览器跨域访问当前已不再默认使用 `*`。
- 当前通过环境变量 `SAFETY_ALLOWED_ORIGINS` 配置显式白名单，仅允许受信任 Web 来源访问。
- 未在白名单中的浏览器来源，应视为默认不放行。
- Android App（Capacitor WebView + 原生壳）与服务端直连场景，不应依赖放宽浏览器 CORS 作为能力前提。

### 6. 当前仍未正式实现的能力
以下能力截至 v0.2.1 仍未完成，因此远端模式虽然已具备最小授权边界，但仍不属于正式安全后端：
- 统一的服务端鉴权机制（例如 token、签名、会话、API key、刷新令牌）
- 完整账号体系与账号找回、设备绑定生命周期管理
- 更细粒度的角色 / 共享授权 / 多租户模型
- 面向正式账号体系、部署安全与更细粒度授权模型的完整自动化回归测试
- HTTPS 部署约束、敏感字段存储策略等上线级安全治理闭环

当前应将远端模式视为：**已具备最小请求头身份基线与 CORS 白名单能力，但仍未达到正式安全后端标准。**

## 0) 健康检查
- `GET /health`

## 1) 紧急通知配置（支持号码留空 + 短信模板自定义）

### 写入配置
- `POST /emergency/config`
- Body:
```json
{
  "userId": "u_123",
  "callNumber": "",
  "smsNumber": "13800000000",
  "smsTemplate": "[SOS] 用户{userId}触发报警，位置({lat},{lng}) 地图:{mapUrl} 时间:{time}"
}
```
说明：
- `callNumber` 可为空字符串或 `null`（表示不拨号）
- `smsNumber` 可为空字符串或 `null`（表示不发短信）
- `smsTemplate` 仅支持占位符：`{userId}` `{deviceId}` `{lat}` `{lng}` `{time}` `{mapUrl}`
- 空模板或仅包含空白字符的模板，会回退为默认模板：`[SOS] 用户{userId}触发报警，位置({lat},{lng}) 地图:{mapUrl} 时间:{time}`
- 若 `smsTemplate` 含未知占位符或花括号不匹配，后端会返回 `400`

### 读取配置
- `GET /emergency/config?userId=u_123`

## 2) 上报 SOS
- `POST /sos/events`
- Body:
```json
{
  "userId": "u_123",
  "deviceId": "d_456",
  "location": { "lat": 31.2304, "lng": 121.4737, "accuracy": 15 },
  "triggerType": "manual",
  "timestamp": "2026-03-22T14:00:00Z"
}
```
- Response（示例）：
```json
{
  "message": "sos received",
  "count": 1,
  "eventId": "sos_xxx",
  "notifications": [
    {
      "channel": "call",
      "destination": null,
      "status": "skipped",
      "detail": "callNumber is empty"
    },
    {
      "channel": "sms",
      "destination": "13800000000",
      "status": "dispatched",
      "detail": "simulated sms dispatch: ..."
    }
  ]
}
```

- `notifications[*].status` 当前允许更细粒度状态，供统一 SOS 状态机与历史页直接消费：
  - `skipped`：未尝试，通常因为号码缺失或配置为空
  - `dispatched`：短信已交给本地/系统发送链路
  - `triggered`：拨号动作已触发
  - `failed`：明确失败
  - `sent`：兼容旧契约保留值
  - `attempted` / `permission-denied` / `partial-success`：为前端归一层与后续原生/远端扩展预留
- 当前后端模拟通知结果约定为：已配置 `callNumber` 时返回 `triggered`，已配置 `smsNumber` 时返回 `dispatched`，未配置号码时返回 `skipped`。
- `GET /sos/events` 返回的历史项 `notifications` 与 `POST /sos/events` 响应使用相同字段结构与状态枚举，不应在持久化后丢失细粒度结果。

### 查询 SOS 历史
- `GET /sos/events?userId=u_123&limit=20`

## 3) 上报位置点
- `POST /tracking/points`

## 4) 查询轨迹
- `GET /tracking/timeline?userId=u_123&from=2026-03-22T13:00:00Z&to=2026-03-22T14:00:00Z`

## 5) 紧急联系人
- `GET /contacts?userId=u_123`
- `POST /contacts`
- `PUT /contacts/{contactId}`
- `DELETE /contacts/{contactId}?userId=u_123`

### 新增联系人
```json
{
  "userId": "u_123",
  "contact": {
    "name": "妈妈",
    "phone": "13800000000"
  }
}
```

### 更新联系人
```json
{
  "userId": "u_123",
  "contact": {
    "name": "室友",
    "phone": "13900000000"
  }
}
```

## 测试与联调验证
- 后端测试：`cd backend && python3 -m unittest discover -s tests -v`
- 前端验证：`cd frontend && npm test && npm run build`
- 联调时请确认浏览器来源已包含在 `SAFETY_ALLOWED_ORIGINS` 中。
