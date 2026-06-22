from fastapi import HTTPException

from .config import DEFAULT_TEMPLATE

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
