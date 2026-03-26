# API Draft (MVP v0.2)

## Base Path
`/api/v1`

补充说明：
- 远端 FastAPI 当前已使用 SQLite 持久化
- 默认数据库文件：`backend/data/safety.db`
- 当前后端 OpenAPI 版本仍以 `backend/main.py` 中的 `APP_VERSION = "0.2.1"` 为准
- 当前 CORS 代码现状仍是开发态通配配置（`allow_origins=["*"]`），本文件后文涉及的白名单 / 身份约束均应解读为待落地的 MVP 联调约定

## 当前契约约束（2026-03-25）
- 本地后端应尽量视为远端 API 的镜像实现
- 同名接口在本地 / 远端模式下应保持主要响应字段一致
- 若本地模式需要额外调试信息，应尽量放在调试工具路径或显式调试接口，不应默认混入业务响应
- 本轮会优先收敛响应结构、错误结构与契约测试基线

相关规划 / 审查文档：
- `docs/mvp/ALIGNMENT_PLAN_FROM_ANDROID_MVP_TO_ORIGINAL_VISION.md`
- `docs/mvp/ORIGINAL_PROMISE_VS_CURRENT_STATUS.md`
- `docs/mvp/DOCUMENTATION_CODE_MISMATCHES.md`

## 远端身份 / 鉴权 / 归属校验 MVP 占位方案

> 本节描述的是 **MVP 级约束与联调约定**。其中部分能力当前仅完成文档定义，尚未在所有接口上完整落地为强制校验。

### 1. 身份模型
- `userId`：业务主身份，表示当前被守护用户；MVP 阶段仍由客户端生成并持久化。
- `deviceId`：设备身份，表示发起请求的安装实例 / 设备；用于区分同一用户的不同设备。
- 当前 **不引入正式账号体系**、密码登录、OAuth、JWT 或刷新令牌。
- 当前 **不引入多租户组织模型**、家庭组共享授权流或服务端会话。

### 2. 请求头约定（MVP 占位）
远端模式下，客户端应在所有写接口、以及涉及敏感读取的接口中尽量携带以下请求头：
- `X-Safety-User-Id: <userId>`
- `X-Safety-Device-Id: <deviceId>`
- `X-Safety-Client-Mode: remote`

说明：
- 这组请求头当前用于 **明确调用方身份语义**，便于后续把“文档约定”平滑升级为“后端强制校验”。
- 现阶段部分接口仍主要依赖 query / body 中的 `userId`、`deviceId` 字段，不能把这些请求头视为正式安全凭证。
- 若请求头与 body / query 中的身份字段不一致，**目标行为** 应为返回 `4xx`；但在当前版本里，该能力仍属于待补齐的后端实现项。

### 3. 参数约定
- 查询类接口：继续通过 query 传递 `userId`，例如 `GET /contacts?userId=u_123`。
- 写入类接口：继续在 body 中传递 `userId`，涉及设备写入时同时传递 `deviceId`。
- 在进入正式鉴权前，**请求头承载“身份声明”**，**query / body 承载“业务目标对象”**；两者应该保持一致。

### 4. 归属校验边界（MVP）
MVP 的最小归属校验目标如下：
- 联系人配置、紧急通知配置、轨迹、SOS 历史等数据，均应只能被其 `userId` 对应的请求访问。
- 若接口同时出现 `userId` 与 `deviceId`，则 `deviceId` 只能代表该 `userId` 名下已登记或已接受的设备身份。
- 后端后续应至少校验：
  1. 请求头中的 `X-Safety-User-Id` 与 query / body 中的 `userId` 一致；
  2. 请求头中的 `X-Safety-Device-Id` 与 body 中的 `deviceId` 一致；
  3. 目标资源（联系人、配置、轨迹、SOS 事件）确属该 `userId`；
  4. 不允许仅凭修改 `userId` 参数读取或覆写其他用户数据。

### 5. CORS 白名单约束
- 远端后端的浏览器跨域访问 **不应继续使用 `*`**。
- MVP 目标是改为“按环境变量配置显式白名单”，仅允许受信任 Web 来源访问。
- 未在白名单中的浏览器来源，应该被视为默认拒绝。
- Android App（Capacitor WebView + 原生壳）与服务端直连场景，不应依赖放宽浏览器 CORS 作为能力前提。

### 6. 当前未正式实现 / 仅为占位的能力
以下能力已形成文档约束，但截至 v0.2 仍属于占位或部分落地状态：
- 统一的服务端鉴权机制（例如 token、签名、会话）
- 全接口强制校验 `X-Safety-User-Id` / `X-Safety-Device-Id`
- 严格的资源归属校验与越权访问拒绝
- 按环境变量驱动的 CORS 白名单收口
- 针对上述约束的自动化回归测试

在这些能力真正落地前，应将远端模式视为：**已具备联调约定，但尚未达到正式安全后端标准。**

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
      "status": "sent",
      "detail": "simulated sms: ..."
    }
  ]
}
```

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
