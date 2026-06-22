from fastapi import Header, HTTPException

from .config import AUTH_TOKEN


def validate_user_access(request_user_id: str, header_user_id: str | None) -> str:
    normalized_header = header_user_id.strip() if isinstance(header_user_id, str) else ""
    if not normalized_header:
        raise HTTPException(status_code=401, detail="x-user-id header is required")
    if normalized_header != request_user_id:
        raise HTTPException(status_code=403, detail="user scope mismatch")
    return normalized_header


def require_request_user_header(x_user_id: str | None = Header(default=None)) -> str:
    normalized = x_user_id.strip() if isinstance(x_user_id, str) else ""
    if not normalized:
        raise HTTPException(status_code=401, detail="x-user-id header is required")
    return normalized


def require_auth_token(x_api_token: str | None = Header(default=None)) -> str:
    if not AUTH_TOKEN:
        return ""
    normalized = x_api_token.strip() if isinstance(x_api_token, str) else ""
    if normalized != AUTH_TOKEN:
        raise HTTPException(status_code=401, detail="invalid api token")
    return normalized
