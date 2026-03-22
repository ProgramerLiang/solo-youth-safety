from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

app = FastAPI(title="Solo Youth Safety API", version="0.2.0")

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
    smsTemplate: str = Field(default="[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}")

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


class StoredPoint(BaseModel):
    userId: str
    deviceId: str
    point: TrackingPoint


class NotificationLog(BaseModel):
    channel: Literal["call", "sms"]
    destination: str | None
    status: Literal["sent", "skipped"]
    detail: str


class SosResponse(BaseModel):
    message: str
    count: int
    notifications: list[NotificationLog]


sos_events: list[SosEvent] = []
stored_points: list[StoredPoint] = []
contacts_by_user: dict[str, list[Contact]] = {}
config_by_user: dict[str, EmergencyConfig] = {}


def build_sms_content(event: SosEvent, cfg: EmergencyConfig) -> str:
    return cfg.smsTemplate.format(
        userId=event.userId,
        deviceId=event.deviceId,
        lat=event.location.lat,
        lng=event.location.lng,
        time=event.timestamp.isoformat(),
    )


def simulate_notify(event: SosEvent) -> list[NotificationLog]:
    cfg = config_by_user.get(event.userId, EmergencyConfig(userId=event.userId))
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
        sms = build_sms_content(event, cfg)
        logs.append(
            NotificationLog(
                channel="sms",
                destination=cfg.smsNumber,
                status="sent",
                detail=f"simulated sms: {sms}",
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


def build_contact_record(payload: ContactPayload) -> Contact:
    return Contact(id=uuid4().hex, name=payload.contact.name, phone=payload.contact.phone)


def find_contact_index(user_id: str, contact_id: str) -> int:
    contacts = contacts_by_user.get(user_id, [])
    for index, contact in enumerate(contacts):
        if contact.id == contact_id:
            return index
    raise HTTPException(status_code=404, detail="contact not found")


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", time=datetime.now(timezone.utc))


@app.post("/api/v1/emergency/config", response_model=EmergencyConfig)
def upsert_emergency_config(payload: EmergencyConfig) -> EmergencyConfig:
    config_by_user[payload.userId] = payload
    return payload


@app.get("/api/v1/emergency/config", response_model=EmergencyConfig)
def get_emergency_config(userId: str = Query(min_length=1)) -> EmergencyConfig:
    return config_by_user.get(userId, EmergencyConfig(userId=userId))


@app.post("/api/v1/sos/events", response_model=SosResponse)
def create_sos_event(payload: SosEvent) -> SosResponse:
    sos_events.append(payload)
    notifications = simulate_notify(payload)
    return SosResponse(
        message="sos received",
        count=len(sos_events),
        notifications=notifications,
    )


@app.post("/api/v1/tracking/points", response_model=ActionResponse)
def create_tracking_points(payload: TrackingPayload) -> ActionResponse:
    for point in payload.points:
        stored_points.append(
            StoredPoint(userId=payload.userId, deviceId=payload.deviceId, point=point)
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

    points = [
        item.point
        for item in stored_points
        if item.userId == userId and from_time <= item.point.timestamp <= to
    ]
    return TimelineResponse(userId=userId, count=len(points), points=points)


@app.get("/api/v1/contacts", response_model=ContactsResponse)
def list_contacts(userId: str = Query(min_length=1)) -> ContactsResponse:
    return ContactsResponse(userId=userId, contacts=contacts_by_user.get(userId, []))


@app.post("/api/v1/contacts", response_model=ActionResponse)
def create_contact(payload: ContactPayload) -> ActionResponse:
    existing = contacts_by_user.get(payload.userId, [])
    existing.append(build_contact_record(payload))
    contacts_by_user[payload.userId] = existing
    return ActionResponse(message="contact added", count=len(existing))


@app.put("/api/v1/contacts/{contact_id}", response_model=ActionResponse)
def update_contact(contact_id: str, payload: ContactPayload) -> ActionResponse:
    index = find_contact_index(payload.userId, contact_id)
    contacts = contacts_by_user.get(payload.userId, [])
    contacts[index] = Contact(id=contact_id, name=payload.contact.name, phone=payload.contact.phone)
    contacts_by_user[payload.userId] = contacts
    return ActionResponse(message="contact updated", count=len(contacts))


@app.delete("/api/v1/contacts/{contact_id}", response_model=ActionResponse)
def delete_contact(contact_id: str, userId: str = Query(min_length=1)) -> ActionResponse:
    index = find_contact_index(userId, contact_id)
    contacts = contacts_by_user.get(userId, [])
    del contacts[index]
    contacts_by_user[userId] = contacts
    return ActionResponse(message="contact deleted", count=len(contacts))
