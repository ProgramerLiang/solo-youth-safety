from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .auth import require_auth_token, require_request_user_header, validate_user_access
from .config import APP_VERSION, get_allowed_origins
from .db import db_connection, init_db
from .schemas import (
    ActionResponse,
    ContactsResponse,
    EmergencyConfig,
    HealthResponse,
    SosEvent,
    SosHistoryResponse,
    SosResponse,
    TimelineResponse,
    TrackingPayload,
    ContactPayload,
)
from .services import (
    create_contact,
    create_sos_event,
    create_tracking_points,
    delete_contact,
    get_config,
    get_timeline_points,
    list_contacts,
    list_sos_history,
    update_contact,
    upsert_config,
)


def create_app() -> FastAPI:
    init_db()
    app = FastAPI(title="Solo Youth Safety API", version=APP_VERSION)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_allowed_origins(),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["Content-Type", "X-User-Id", "X-Api-Token"],
    )

    @app.get("/api/v1/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            time=datetime.now(timezone.utc),
            version=APP_VERSION,
        )

    @app.post(
        "/api/v1/emergency/config",
        response_model=EmergencyConfig,
        dependencies=[Depends(require_auth_token)],
    )
    def upsert_emergency_config(
        payload: EmergencyConfig,
        request_user_id: str = Depends(require_request_user_header),
    ) -> EmergencyConfig:
        validate_user_access(payload.userId, request_user_id)
        with db_connection() as connection:
            return upsert_config(connection, payload)

    @app.get(
        "/api/v1/emergency/config",
        response_model=EmergencyConfig,
        dependencies=[Depends(require_auth_token)],
    )
    def get_emergency_config(
        userId: str = Query(min_length=1),
        request_user_id: str = Depends(require_request_user_header),
    ) -> EmergencyConfig:
        validate_user_access(userId, request_user_id)
        with db_connection() as connection:
            return get_config(connection, userId)

    @app.post(
        "/api/v1/sos/events",
        response_model=SosResponse,
        dependencies=[Depends(require_auth_token)],
    )
    def create_sos(payload: SosEvent, request_user_id: str = Depends(require_request_user_header)) -> SosResponse:
        validate_user_access(payload.userId, request_user_id)
        with db_connection() as connection:
            event_id, notifications, count = create_sos_event(connection, payload)
        return SosResponse(
            message="sos received",
            count=count,
            eventId=event_id,
            notifications=notifications,
        )

    @app.get(
        "/api/v1/sos/events",
        response_model=SosHistoryResponse,
        dependencies=[Depends(require_auth_token)],
    )
    def list_sos_events(
        userId: str = Query(min_length=1),
        limit: int = Query(default=20, ge=1, le=100),
        request_user_id: str = Depends(require_request_user_header),
    ) -> SosHistoryResponse:
        validate_user_access(userId, request_user_id)
        with db_connection() as connection:
            count, items = list_sos_history(connection, userId, limit)
        return SosHistoryResponse(userId=userId, count=count, items=items)

    @app.post(
        "/api/v1/tracking/points",
        response_model=ActionResponse,
        dependencies=[Depends(require_auth_token)],
    )
    def create_tracking(
        payload: TrackingPayload,
        request_user_id: str = Depends(require_request_user_header),
    ) -> ActionResponse:
        validate_user_access(payload.userId, request_user_id)
        with db_connection() as connection:
            count = create_tracking_points(connection, payload.userId, payload.deviceId, payload.points)
        return ActionResponse(message="points stored", count=count)

    @app.get(
        "/api/v1/tracking/timeline",
        response_model=TimelineResponse,
        dependencies=[Depends(require_auth_token)],
    )
    def get_timeline(
        userId: str = Query(min_length=1),
        from_time: datetime = Query(alias="from"),
        to: datetime = Query(),
        request_user_id: str = Depends(require_request_user_header),
    ) -> TimelineResponse:
        validate_user_access(userId, request_user_id)
        with db_connection() as connection:
            points = get_timeline_points(connection, userId, from_time, to)
        return TimelineResponse(userId=userId, count=len(points), points=points)

    @app.get(
        "/api/v1/contacts",
        response_model=ContactsResponse,
        dependencies=[Depends(require_auth_token)],
    )
    def get_contacts(
        userId: str = Query(min_length=1),
        request_user_id: str = Depends(require_request_user_header),
    ) -> ContactsResponse:
        validate_user_access(userId, request_user_id)
        with db_connection() as connection:
            contacts = list_contacts(connection, userId)
        return ContactsResponse(userId=userId, contacts=contacts)

    @app.post(
        "/api/v1/contacts",
        response_model=ActionResponse,
        dependencies=[Depends(require_auth_token)],
    )
    def add_contact(
        payload: ContactPayload,
        request_user_id: str = Depends(require_request_user_header),
    ) -> ActionResponse:
        validate_user_access(payload.userId, request_user_id)
        with db_connection() as connection:
            count = create_contact(connection, payload.userId, payload.contact)
        return ActionResponse(message="contact added", count=count)

    @app.put(
        "/api/v1/contacts/{contact_id}",
        response_model=ActionResponse,
        dependencies=[Depends(require_auth_token)],
    )
    def edit_contact(
        contact_id: str,
        payload: ContactPayload,
        request_user_id: str = Depends(require_request_user_header),
    ) -> ActionResponse:
        validate_user_access(payload.userId, request_user_id)
        with db_connection() as connection:
            count = update_contact(connection, contact_id, payload.userId, payload.contact)
        return ActionResponse(message="contact updated", count=count)

    @app.delete(
        "/api/v1/contacts/{contact_id}",
        response_model=ActionResponse,
        dependencies=[Depends(require_auth_token)],
    )
    def remove_contact(
        contact_id: str,
        userId: str = Query(min_length=1),
        request_user_id: str = Depends(require_request_user_header),
    ) -> ActionResponse:
        validate_user_access(userId, request_user_id)
        with db_connection() as connection:
            count = delete_contact(connection, contact_id, userId)
        return ActionResponse(message="contact deleted", count=count)

    return app
