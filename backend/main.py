import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

APP_VERSION = "0.2.1"
DEFAULT_TEMPLATE = "[SOS] 用户{userId}触发报警，位置({lat},{lng}) 地图:{mapUrl} 时间:{time}"
SAFETY_USER_ID_HEADER = "X-Safety-User-Id"
SAFETY_DEVICE_ID_HEADER = "X-Safety-Device-Id"
SAFETY_CLIENT_MODE_HEADER = "X-Safety-Client-Mode"
SAFETY_ALLOWED_ORIGINS_ENV = "SAFETY_ALLOWED_ORIGINS"
DB_PATH = Path(
    os.getenv(
        "SAFETY_DB_PATH",
        Path(__file__).resolve().parent / "data" / "safety.db",
    )
)

app = FastAPI(title="Solo Youth Safety API", version=APP_VERSION)


# 当前仅建立“最小请求头身份基线”，并非完整账号体系：
# - 受保护接口会校验请求头中的 userId / deviceId 与 query/body 是否一致，并阻断跨用户资源访问；
# - 仍未引入登录态、token、session、角色体系、设备注册审批、细粒度授权与审计追踪；
# - 因此这里只能视为 MVP 远端接口的最小授权边界，而非正式安全后端。
# 相关待办与对外口径见 README / docs/mvp/PROJECT_STATUS_AND_ROADMAP.md / docs/mvp/TASKS.md。
def get_allowed_origins() -> list[str]:
    raw_value = os.getenv(SAFETY_ALLOWED_ORIGINS_ENV, "")
    origins = [item.strip() for item in raw_value.split(",") if item.strip()]
    return origins


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type", SAFETY_USER_ID_HEADER, SAFETY_DEVICE_ID_HEADER, SAFETY_CLIENT_MODE_HEADER],
)


class Location(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0)


class SosEvent(BaseModel):
    userId: str = Field(min_length=1)
    deviceId: str = Field(min_length=1)
    location: Location
    triggerType: Literal["manual", "auto"]
    timestamp: datetime


class TrackingPoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: float = Field(ge=0)
    speed: float = Field(ge=0)
    heading: float = Field(ge=0, le=360)
    timestamp: datetime


class TrackingPayload(BaseModel):
    userId: str = Field(min_length=1)
    deviceId: str = Field(min_length=1)
    points: list[TrackingPoint] = Field(min_length=1)


class ContactInput(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=3)


class Contact(ContactInput):
    id: str = Field(min_length=1)


class ContactPayload(BaseModel):
    userId: str = Field(min_length=1)
    contact: ContactInput


class EmergencyConfig(BaseModel):
    userId: str = Field(min_length=1)
    callNumber: str | None = Field(default=None, max_length=32)
    smsNumber: str | None = Field(default=None, max_length=32)
    smsTemplate: str = Field(default=DEFAULT_TEMPLATE)

    @field_validator("callNumber", "smsNumber", mode="before")
    @classmethod
    def empty_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if isinstance(value, str) and value.strip() == "":
            return None
        return value


class HealthResponse(BaseModel):
    status: str
    time: datetime


class ActionResponse(BaseModel):
    message: str
    count: int


class TimelineResponse(BaseModel):
    userId: str
    count: int
    points: list[TrackingPoint]


class ContactsResponse(BaseModel):
    userId: str
    contacts: list[Contact]


NotificationChannel = Literal["call", "sms"]
NotificationStatus = Literal[
    "sent",
    "skipped",
    "failed",
    "dispatched",
    "triggered",
    "attempted",
    "permission-denied",
    "partial-success",
]


class NotificationLog(BaseModel):
    channel: NotificationChannel
    destination: str | None
    status: NotificationStatus
    detail: str


class SosHistoryItem(SosEvent):
    id: str = Field(min_length=1)
    notifications: list[NotificationLog] = Field(default_factory=list)


class SosHistoryResponse(BaseModel):
    userId: str
    count: int
    items: list[SosHistoryItem]


class SosResponse(BaseModel):
    message: str
    count: int
    eventId: str
    notifications: list[NotificationLog]


SMS_TEMPLATE_FIELDS = ("userId", "deviceId", "lat", "lng", "time", "mapUrl")


def build_supported_placeholders_text() -> str:
    return " ".join(f"{{{field_name}}}" for field_name in SMS_TEMPLATE_FIELDS)


def normalize_sms_template(template: str | None) -> str:
    if isinstance(template, str) and template.strip():
        return template
    return DEFAULT_TEMPLATE


def get_sms_template_validation_error(template: str | None) -> str:
    normalized = normalize_sms_template(template)
    index = 0
    while index < len(normalized):
        char = normalized[index]
        if char == "}":
            return "短信模板存在未匹配的 }"
        if char != "{":
            index += 1
            continue
        end = normalized.find("}", index + 1)
        if end == -1:
            return "短信模板存在未闭合的 {"
        field_name = normalized[index + 1 : end].strip()
        if field_name not in SMS_TEMPLATE_FIELDS:
            return (
                f"短信模板包含不支持的占位符：{{{field_name or '?'}}}，"
                f"仅支持 {build_supported_placeholders_text()}"
            )
        index = end + 1
    return ""


def validate_sms_template(template: str | None) -> str:
    normalized = normalize_sms_template(template)
    error = get_sms_template_validation_error(normalized)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return normalized


class IdentityHeaders(BaseModel):
    user_id: str = Field(min_length=1)
    device_id: str | None = None
    client_mode: str | None = None


def require_identity(
    x_safety_user_id: str | None = Header(default=None, alias=SAFETY_USER_ID_HEADER),
    x_safety_device_id: str | None = Header(default=None, alias=SAFETY_DEVICE_ID_HEADER),
    x_safety_client_mode: str | None = Header(default=None, alias=SAFETY_CLIENT_MODE_HEADER),
) -> IdentityHeaders:
    if not x_safety_user_id or not x_safety_user_id.strip():
        raise HTTPException(status_code=401, detail=f"missing required header: {SAFETY_USER_ID_HEADER}")
    if x_safety_client_mode is not None and x_safety_client_mode.strip().lower() != "remote":
        raise HTTPException(status_code=403, detail="invalid client mode")
    return IdentityHeaders(
        user_id=x_safety_user_id.strip(),
        device_id=x_safety_device_id.strip() if isinstance(x_safety_device_id, str) and x_safety_device_id.strip() else None,
        client_mode=x_safety_client_mode.strip().lower() if isinstance(x_safety_client_mode, str) and x_safety_client_mode.strip() else None,
    )


def ensure_user_matches(identity: IdentityHeaders, target_user_id: str) -> None:
    if identity.user_id != target_user_id:
        raise HTTPException(status_code=403, detail="user identity does not match requested resource")


def ensure_device_matches(identity: IdentityHeaders, target_device_id: str) -> None:
    if not identity.device_id:
        raise HTTPException(status_code=401, detail=f"missing required header: {SAFETY_DEVICE_ID_HEADER}")
    if identity.device_id != target_device_id:
        raise HTTPException(status_code=403, detail="device identity does not match request payload")



def ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)



def serialize_datetime(value: datetime) -> str:
    return ensure_utc(value).isoformat()



def to_epoch_seconds(value: datetime) -> float:
    return ensure_utc(value).timestamp()



def parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value)



def create_connection() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


@contextmanager
def db_connection():
    connection = create_connection()
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()



def init_db() -> None:
    with db_connection() as connection:
        connection.executescript(
            """
            -- 高风险缺口证据索引（数据模型层）
            -- 正向证据：当前库只初始化 5 张核心表，分别覆盖通知配置、联系人、轨迹点、SOS 事件、通知日志，能够支撑 Android MVP 的基础闭环。
            -- 反向证据：此处未见 geofences / alert_rules / remote_commands / media_evidence / risk_zones / safety_guides / camera_scan_results 等表，
            -- 因而不能把当前 SQLite 结构解读为已经支持围栏、规则引擎、远程控制、取证媒体、风险区域导航、偷拍检测、安全指导等能力。
            -- 若后续 worker 要补实现，可直接从本 executescript 追加表结构，并同步补迁移、Pydantic 模型、增删查接口与鉴权校验。
            CREATE TABLE IF NOT EXISTS emergency_configs (
                user_id TEXT PRIMARY KEY,
                call_number TEXT,
                sms_number TEXT,
                sms_template TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contacts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tracking_points (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                accuracy REAL NOT NULL,
                speed REAL NOT NULL,
                heading REAL NOT NULL,
                timestamp_text TEXT NOT NULL,
                timestamp_epoch REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sos_events (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                device_id TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                accuracy REAL NOT NULL,
                trigger_type TEXT NOT NULL,
                timestamp_text TEXT NOT NULL,
                timestamp_epoch REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sos_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL,
                channel TEXT NOT NULL,
                destination TEXT,
                status TEXT NOT NULL,
                detail TEXT NOT NULL,
                FOREIGN KEY(event_id) REFERENCES sos_events(id) ON DELETE CASCADE
            );
            """
        )



def row_to_config(row: sqlite3.Row | None, user_id: str) -> EmergencyConfig:
    if row is None:
        return EmergencyConfig(userId=user_id)
    return EmergencyConfig(
        userId=row["user_id"],
        callNumber=row["call_number"],
        smsNumber=row["sms_number"],
        smsTemplate=row["sms_template"],
    )



def row_to_contact(row: sqlite3.Row) -> Contact:
    return Contact(id=row["id"], name=row["name"], phone=row["phone"])



def row_to_tracking_point(row: sqlite3.Row) -> TrackingPoint:
    return TrackingPoint(
        lat=row["lat"],
        lng=row["lng"],
        accuracy=row["accuracy"],
        speed=row["speed"],
        heading=row["heading"],
        timestamp=parse_datetime(row["timestamp_text"]),
    )



def get_config(connection: sqlite3.Connection, user_id: str) -> EmergencyConfig:
    row = connection.execute(
        """
        SELECT user_id, call_number, sms_number, sms_template
        FROM emergency_configs
        WHERE user_id = ?
        """,
        (user_id,),
    ).fetchone()
    return row_to_config(row, user_id)



def build_map_url(lat: float, lng: float) -> str:
    return f"https://uri.amap.com/marker?position={lng},{lat}"



def build_sms_content(event: SosEvent, cfg: EmergencyConfig) -> str:
    return cfg.smsTemplate.format(
        userId=event.userId,
        deviceId=event.deviceId,
        lat=event.location.lat,
        lng=event.location.lng,
        time=serialize_datetime(event.timestamp),
        mapUrl=build_map_url(event.location.lat, event.location.lng),
    )



def simulate_notify(connection: sqlite3.Connection, event: SosEvent) -> list[NotificationLog]:
    cfg = get_config(connection, event.userId)
    logs: list[NotificationLog] = []

    if cfg.callNumber:
        logs.append(
            NotificationLog(
                channel="call",
                destination=cfg.callNumber,
                status="triggered",
                detail="simulated call trigger",
            )
        )
    else:
        logs.append(
            NotificationLog(
                channel="call",
                destination=None,
                status="skipped",
                detail="callNumber is empty",
            )
        )

    if cfg.smsNumber:
        logs.append(
            NotificationLog(
                channel="sms",
                destination=cfg.smsNumber,
                status="dispatched",
                detail=f"simulated sms dispatch: {build_sms_content(event, cfg)}",
            )
        )
    else:
        logs.append(
            NotificationLog(
                channel="sms",
                destination=None,
                status="skipped",
                detail="smsNumber is empty",
            )
        )

    return logs



def get_notifications(connection: sqlite3.Connection, event_id: str) -> list[NotificationLog]:
    rows = connection.execute(
        """
        SELECT channel, destination, status, detail
        FROM sos_notifications
        WHERE event_id = ?
        ORDER BY id ASC
        """,
        (event_id,),
    ).fetchall()
    return [NotificationLog(**dict(row)) for row in rows]



def row_to_sos_item(connection: sqlite3.Connection, row: sqlite3.Row) -> SosHistoryItem:
    return SosHistoryItem(
        id=row["id"],
        userId=row["user_id"],
        deviceId=row["device_id"],
        triggerType=row["trigger_type"],
        timestamp=parse_datetime(row["timestamp_text"]),
        location=Location(lat=row["lat"], lng=row["lng"], accuracy=row["accuracy"]),
        notifications=get_notifications(connection, row["id"]),
    )



def get_count(connection: sqlite3.Connection, table_name: str) -> int:
    row = connection.execute(f"SELECT COUNT(*) AS count FROM {table_name}").fetchone()
    return int(row["count"] if row else 0)


init_db()


# 高风险缺口证据索引（接口层）
# 正向证据：当前对外 API 仅覆盖 health、通知配置、SOS 事件、SOS 历史、轨迹点上报/时间线、联系人增删改查。
# 反向证据：本文件未暴露 geofence、rules、remote-commands、media-evidence、camera-detection、risk-zone、navigation、safety-guide、AI-assistant 等路由；
# 因此“检测偷拍 / 安全导航 / 安全路线 / 安全指导 / AI 辅助 / 远程指令 / 规则引擎”目前不能视为已有后端接口基线。
# 若后续 worker 需要实施对应能力，可直接从这里扩展 REST 路由，并同步补数据模型、鉴权、审计与联调契约。
@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", time=datetime.now(timezone.utc))


@app.post("/api/v1/emergency/config", response_model=EmergencyConfig)
def upsert_emergency_config(
    payload: EmergencyConfig,
    identity: IdentityHeaders = Depends(require_identity),
) -> EmergencyConfig:
    ensure_user_matches(identity, payload.userId)
    normalized_payload = payload.model_copy(
        update={"smsTemplate": validate_sms_template(payload.smsTemplate)}
    )
    with db_connection() as connection:
        connection.execute(
            """
            INSERT INTO emergency_configs (user_id, call_number, sms_number, sms_template)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                call_number = excluded.call_number,
                sms_number = excluded.sms_number,
                sms_template = excluded.sms_template
            """,
            (
                normalized_payload.userId,
                normalized_payload.callNumber,
                normalized_payload.smsNumber,
                normalized_payload.smsTemplate,
            ),
        )
    return normalized_payload


@app.get("/api/v1/emergency/config", response_model=EmergencyConfig)
def get_emergency_config(
    userId: str = Query(min_length=1),
    identity: IdentityHeaders = Depends(require_identity),
) -> EmergencyConfig:
    ensure_user_matches(identity, userId)
    with db_connection() as connection:
        return get_config(connection, userId)


@app.post("/api/v1/sos/events", response_model=SosResponse)
def create_sos_event(
    payload: SosEvent,
    identity: IdentityHeaders = Depends(require_identity),
) -> SosResponse:
    ensure_user_matches(identity, payload.userId)
    ensure_device_matches(identity, payload.deviceId)
    with db_connection() as connection:
        notifications = simulate_notify(connection, payload)
        event_id = uuid4().hex
        connection.execute(
            """
            INSERT INTO sos_events (
                id, user_id, device_id, lat, lng, accuracy,
                trigger_type, timestamp_text, timestamp_epoch
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event_id,
                payload.userId,
                payload.deviceId,
                payload.location.lat,
                payload.location.lng,
                payload.location.accuracy,
                payload.triggerType,
                serialize_datetime(payload.timestamp),
                to_epoch_seconds(payload.timestamp),
            ),
        )
        connection.executemany(
            """
            INSERT INTO sos_notifications (event_id, channel, destination, status, detail)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (event_id, item.channel, item.destination, item.status, item.detail)
                for item in notifications
            ],
        )
        count = get_count(connection, "sos_events")
    return SosResponse(
        message="sos received",
        count=count,
        eventId=event_id,
        notifications=notifications,
    )


@app.get("/api/v1/sos/events", response_model=SosHistoryResponse)
def list_sos_events(
    userId: str = Query(min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    identity: IdentityHeaders = Depends(require_identity),
) -> SosHistoryResponse:
    ensure_user_matches(identity, userId)
    with db_connection() as connection:
        total_row = connection.execute(
            "SELECT COUNT(*) AS count FROM sos_events WHERE user_id = ?",
            (userId,),
        ).fetchone()
        rows = connection.execute(
            """
            SELECT id, user_id, device_id, lat, lng, accuracy,
                   trigger_type, timestamp_text
            FROM sos_events
            WHERE user_id = ?
            ORDER BY timestamp_epoch DESC
            LIMIT ?
            """,
            (userId, limit),
        ).fetchall()
        items = [row_to_sos_item(connection, row) for row in rows]
    return SosHistoryResponse(userId=userId, count=int(total_row["count"]), items=items)


@app.post("/api/v1/tracking/points", response_model=ActionResponse)
def create_tracking_points(
    payload: TrackingPayload,
    identity: IdentityHeaders = Depends(require_identity),
) -> ActionResponse:
    ensure_user_matches(identity, payload.userId)
    ensure_device_matches(identity, payload.deviceId)
    with db_connection() as connection:
        connection.executemany(
            """
            INSERT INTO tracking_points (
                user_id, device_id, lat, lng, accuracy,
                speed, heading, timestamp_text, timestamp_epoch
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    payload.userId,
                    payload.deviceId,
                    point.lat,
                    point.lng,
                    point.accuracy,
                    point.speed,
                    point.heading,
                    serialize_datetime(point.timestamp),
                    to_epoch_seconds(point.timestamp),
                )
                for point in payload.points
            ],
        )
    return ActionResponse(message="points stored", count=len(payload.points))


@app.get("/api/v1/tracking/timeline", response_model=TimelineResponse)
def get_timeline(
    userId: str = Query(min_length=1),
    from_time: datetime = Query(alias="from"),
    to: datetime = Query(),
    identity: IdentityHeaders = Depends(require_identity),
) -> TimelineResponse:
    ensure_user_matches(identity, userId)
    if from_time > to:
        raise HTTPException(status_code=400, detail="from must be earlier than to")

    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT lat, lng, accuracy, speed, heading, timestamp_text
            FROM tracking_points
            WHERE user_id = ? AND timestamp_epoch BETWEEN ? AND ?
            ORDER BY timestamp_epoch ASC
            """,
            (userId, to_epoch_seconds(from_time), to_epoch_seconds(to)),
        ).fetchall()
        points = [row_to_tracking_point(row) for row in rows]
    return TimelineResponse(userId=userId, count=len(points), points=points)


@app.get("/api/v1/contacts", response_model=ContactsResponse)
def list_contacts(
    userId: str = Query(min_length=1),
    identity: IdentityHeaders = Depends(require_identity),
) -> ContactsResponse:
    ensure_user_matches(identity, userId)
    with db_connection() as connection:
        rows = connection.execute(
            """
            SELECT id, name, phone
            FROM contacts
            WHERE user_id = ?
            ORDER BY rowid ASC
            """,
            (userId,),
        ).fetchall()
        contacts = [row_to_contact(row) for row in rows]
    return ContactsResponse(userId=userId, contacts=contacts)


@app.post("/api/v1/contacts", response_model=ActionResponse)
def create_contact(
    payload: ContactPayload,
    identity: IdentityHeaders = Depends(require_identity),
) -> ActionResponse:
    ensure_user_matches(identity, payload.userId)
    contact_id = uuid4().hex
    with db_connection() as connection:
        connection.execute(
            "INSERT INTO contacts (id, user_id, name, phone) VALUES (?, ?, ?, ?)",
            (contact_id, payload.userId, payload.contact.name, payload.contact.phone),
        )
        row = connection.execute(
            "SELECT COUNT(*) AS count FROM contacts WHERE user_id = ?",
            (payload.userId,),
        ).fetchone()
    return ActionResponse(message="contact added", count=int(row["count"]))


@app.put("/api/v1/contacts/{contact_id}", response_model=ActionResponse)
def update_contact(
    contact_id: str,
    payload: ContactPayload,
    identity: IdentityHeaders = Depends(require_identity),
) -> ActionResponse:
    ensure_user_matches(identity, payload.userId)
    with db_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE contacts
            SET name = ?, phone = ?
            WHERE id = ? AND user_id = ?
            """,
            (payload.contact.name, payload.contact.phone, contact_id, payload.userId),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="contact not found")
        row = connection.execute(
            "SELECT COUNT(*) AS count FROM contacts WHERE user_id = ?",
            (payload.userId,),
        ).fetchone()
    return ActionResponse(message="contact updated", count=int(row["count"]))


@app.delete("/api/v1/contacts/{contact_id}", response_model=ActionResponse)
def delete_contact(
    contact_id: str,
    userId: str = Query(min_length=1),
    identity: IdentityHeaders = Depends(require_identity),
) -> ActionResponse:
    ensure_user_matches(identity, userId)
    with db_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM contacts WHERE id = ? AND user_id = ?",
            (contact_id, userId),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="contact not found")
        row = connection.execute(
            "SELECT COUNT(*) AS count FROM contacts WHERE user_id = ?",
            (userId,),
        ).fetchone()
    return ActionResponse(message="contact deleted", count=int(row["count"]))
