import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

APP_VERSION = "0.2.1"
DEFAULT_TEMPLATE = "[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}"
DB_PATH = Path(
    os.getenv(
        "SAFETY_DB_PATH",
        Path(__file__).resolve().parent / "data" / "safety.db",
    )
)

app = FastAPI(title="Solo Youth Safety API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


class NotificationLog(BaseModel):
    channel: Literal["call", "sms"]
    destination: str | None
    status: Literal["sent", "skipped"]
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


SMS_TEMPLATE_FIELDS = ("userId", "deviceId", "lat", "lng", "time")


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



def build_sms_content(event: SosEvent, cfg: EmergencyConfig) -> str:
    return cfg.smsTemplate.format(
        userId=event.userId,
        deviceId=event.deviceId,
        lat=event.location.lat,
        lng=event.location.lng,
        time=serialize_datetime(event.timestamp),
    )



def simulate_notify(connection: sqlite3.Connection, event: SosEvent) -> list[NotificationLog]:
    cfg = get_config(connection, event.userId)
    logs: list[NotificationLog] = []

    if cfg.callNumber:
        logs.append(
            NotificationLog(
                channel="call",
                destination=cfg.callNumber,
                status="sent",
                detail="simulated call dispatch",
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
                status="sent",
                detail=f"simulated sms: {build_sms_content(event, cfg)}",
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


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", time=datetime.now(timezone.utc))


@app.post("/api/v1/emergency/config", response_model=EmergencyConfig)
def upsert_emergency_config(payload: EmergencyConfig) -> EmergencyConfig:
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
def get_emergency_config(userId: str = Query(min_length=1)) -> EmergencyConfig:
    with db_connection() as connection:
        return get_config(connection, userId)


@app.post("/api/v1/sos/events", response_model=SosResponse)
def create_sos_event(payload: SosEvent) -> SosResponse:
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
) -> SosHistoryResponse:
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
def create_tracking_points(payload: TrackingPayload) -> ActionResponse:
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
) -> TimelineResponse:
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
def list_contacts(userId: str = Query(min_length=1)) -> ContactsResponse:
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
def create_contact(payload: ContactPayload) -> ActionResponse:
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
def update_contact(contact_id: str, payload: ContactPayload) -> ActionResponse:
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
def delete_contact(contact_id: str, userId: str = Query(min_length=1)) -> ActionResponse:
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
