# Backend (FastAPI)

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
- `GET /health`
- `GET/POST /emergency/config`
- `POST /sos/events`
- `GET /tracking/timeline` 时间范围校验
- 联系人 CRUD

## 当前存储
- 远端后端已使用 SQLite 持久化
- 默认数据库路径：`backend/data/safety.db`
- 可通过环境变量覆盖：`SAFETY_DB_PATH=/path/to/custom.db`

## 当前持久化内容
- 紧急通知配置
- 联系人
- SOS 历史
- 轨迹点
- SOS 通知日志

接口文档：
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
