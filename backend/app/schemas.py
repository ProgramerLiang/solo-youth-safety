from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .config import DEFAULT_TEMPLATE


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
    mode: str = Field(default="remote")
    version: str


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
