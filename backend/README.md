# Backend (FastAPI)

## 环境变量
可选环境变量：

```bash
SAFETY_DB_PATH=/absolute/path/to/safety.db
```

说明：
- `SAFETY_DB_PATH` 可用于覆盖 SQLite 数据库文件位置

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
- `POST /api/v1/sos/events`
- `GET /api/v1/tracking/timeline` 时间范围校验
- `/api/v1/contacts` 联系人 CRUD

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
