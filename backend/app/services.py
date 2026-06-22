import sqlite3
from uuid import uuid4

from fastapi import HTTPException

from .schemas import (
    Contact,
    EmergencyConfig,
    Location,
    NotificationLog,
    SosEvent,
    SosHistoryItem,
    TrackingPoint,
)
from .template_utils import validate_sms_template
from .time_utils import parse_datetime, serialize_datetime, to_epoch_seconds


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


def upsert_config(connection: sqlite3.Connection, payload: EmergencyConfig) -> EmergencyConfig:
    normalized_payload = payload.model_copy(
        update={"smsTemplate": validate_sms_template(payload.smsTemplate)}
    )
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


def create_sos_event(connection: sqlite3.Connection, payload: SosEvent) -> tuple[str, list[NotificationLog], int]:
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
        [(event_id, item.channel, item.destination, item.status, item.detail) for item in notifications],
    )
    return event_id, notifications, get_count(connection, "sos_events")


def list_sos_history(connection: sqlite3.Connection, user_id: str, limit: int) -> tuple[int, list[SosHistoryItem]]:
    total_row = connection.execute(
        "SELECT COUNT(*) AS count FROM sos_events WHERE user_id = ?",
        (user_id,),
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
        (user_id, limit),
    ).fetchall()
    return int(total_row["count"]), [row_to_sos_item(connection, row) for row in rows]


def create_tracking_points(connection: sqlite3.Connection, user_id: str, device_id: str, points: list[TrackingPoint]) -> int:
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
                user_id,
                device_id,
                point.lat,
                point.lng,
                point.accuracy,
                point.speed,
                point.heading,
                serialize_datetime(point.timestamp),
                to_epoch_seconds(point.timestamp),
            )
            for point in points
        ],
    )
    return len(points)


def get_timeline_points(connection: sqlite3.Connection, user_id: str, from_time, to_time) -> list[TrackingPoint]:
    if from_time > to_time:
        raise HTTPException(status_code=400, detail="from must be earlier than to")
    rows = connection.execute(
        """
        SELECT lat, lng, accuracy, speed, heading, timestamp_text
        FROM tracking_points
        WHERE user_id = ? AND timestamp_epoch BETWEEN ? AND ?
        ORDER BY timestamp_epoch ASC
        """,
        (user_id, to_epoch_seconds(from_time), to_epoch_seconds(to_time)),
    ).fetchall()
    return [row_to_tracking_point(row) for row in rows]


def list_contacts(connection: sqlite3.Connection, user_id: str) -> list[Contact]:
    rows = connection.execute(
        """
        SELECT id, name, phone
        FROM contacts
        WHERE user_id = ?
        ORDER BY rowid ASC
        """,
        (user_id,),
    ).fetchall()
    return [row_to_contact(row) for row in rows]


def create_contact(connection: sqlite3.Connection, user_id: str, contact) -> int:
    connection.execute(
        "INSERT INTO contacts (id, user_id, name, phone) VALUES (?, ?, ?, ?)",
        (uuid4().hex, user_id, contact.name, contact.phone),
    )
    row = connection.execute(
        "SELECT COUNT(*) AS count FROM contacts WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return int(row["count"])


def update_contact(connection: sqlite3.Connection, contact_id: str, user_id: str, contact) -> int:
    cursor = connection.execute(
        """
        UPDATE contacts
        SET name = ?, phone = ?
        WHERE id = ? AND user_id = ?
        """,
        (contact.name, contact.phone, contact_id, user_id),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="contact not found")
    row = connection.execute(
        "SELECT COUNT(*) AS count FROM contacts WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return int(row["count"])


def delete_contact(connection: sqlite3.Connection, contact_id: str, user_id: str) -> int:
    cursor = connection.execute(
        "DELETE FROM contacts WHERE id = ? AND user_id = ?",
        (contact_id, user_id),
    )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="contact not found")
    row = connection.execute(
        "SELECT COUNT(*) AS count FROM contacts WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    return int(row["count"])
