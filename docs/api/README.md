# API Draft (MVP)

## Base Path
`/api/v1`

## Endpoints

### 1) 上报 SOS
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

### 2) 上报位置点
- `POST /tracking/points`
- Body:
```json
{
  "userId": "u_123",
  "deviceId": "d_456",
  "points": [
    {
      "lat": 31.2304,
      "lng": 121.4737,
      "accuracy": 15,
      "speed": 0,
      "heading": 180,
      "timestamp": "2026-03-22T14:00:00Z"
    }
  ]
}
```

### 3) 查询轨迹
- `GET /tracking/timeline?userId=u_123&from=2026-03-22T13:00:00Z&to=2026-03-22T14:00:00Z`

### 4) 紧急联系人列表
- `GET /contacts?userId=u_123`
- `POST /contacts`
