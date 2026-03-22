# API Draft (MVP v0.2)

## Base Path
`/api/v1`

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
- `smsTemplate` 支持占位符：`{userId}` `{deviceId}` `{lat}` `{lng}` `{time}`

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
