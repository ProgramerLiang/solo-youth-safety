import os
from pathlib import Path

APP_VERSION = os.getenv("SAFETY_APP_VERSION", "0.2.20")
DEFAULT_TEMPLATE = "[SOS] 用户{userId}触发报警，位置({lat},{lng}) 时间:{time}"
DB_PATH = Path(
    os.getenv(
        "SAFETY_DB_PATH",
        Path(__file__).resolve().parents[1] / "data" / "safety.db",
    )
)
AUTH_TOKEN = os.getenv("SAFETY_API_TOKEN", "").strip()


def get_allowed_origins() -> list[str]:
    raw = os.getenv("SAFETY_CORS_ALLOW_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173")
    origins = [item.strip() for item in raw.split(",") if item.strip()]
    return origins or ["http://127.0.0.1:5173"]
