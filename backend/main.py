from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Solo Youth Safety API", version="0.1.0")

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


class Contact(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=3)


class ContactPayload(BaseModel):
    userId: str = Field(min_length=1)
    contact: Contact


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


sos_events: list[SosEvent] = []
stored_points: list[StoredPoint] = []
contacts_by_user: dict[str, list[Contact]] = {}


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", time=datetime.now(timezone.utc))


@app.post("/api/v1/sos/events", response_model=ActionResponse)
def create_sos_event(payload: SosEvent) -> ActionResponse:
    sos_events.append(payload)
    return ActionResponse(message="sos received", count=len(sos_events))


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
    existing.append(payload.contact)
    contacts_by_user[payload.userId] = existing
    return ActionResponse(message="contact added", count=len(existing))
