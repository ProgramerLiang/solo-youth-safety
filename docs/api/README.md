# API Draft (MVP v0.2)

## Base Path
`/api/v1`

补充说明：
- 远端 FastAPI 当前已使用 SQLite 持久化
- 默认数据库文件：`backend/data/safety.db`

## 当前契约约束（2026-03-24）
- 本地后端应尽量视为远端 API 的镜像实现
- 同名接口在本地 / 远端模式下应保持主要响应字段一致
- 若本地模式需要额外调试信息，应尽量放在调试工具路径或显式调试接口，不应默认混入业务响应
- 本轮会优先收敛响应结构、错误结构与契约测试基线

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
  "smsTemplate": "[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}"
}
```
说明：
- `callNumber` 可为空字符串或 `null`（表示不拨号）
- `smsNumber` 可为空字符串或 `null`（表示不发短信）
- `smsTemplate` 仅支持占位符：`{userId}` `{deviceId}` `{lat}` `{lng}` `{time}`
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
