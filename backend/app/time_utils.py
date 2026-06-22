from datetime import datetime, timezone


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
