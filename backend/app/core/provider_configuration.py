from dataclasses import dataclass

from app.core.settings import Settings


@dataclass(frozen=True)
class ProviderConfigurationStatus:
    requirements: list[str]
    missing: list[str]
    message: str


_REQUIREMENTS_BY_PROVIDER: dict[str, list[str]] = {
    "autoscout24": ["SCRAPINGBEE_API_KEY"],
    "subito": ["SCRAPINGBEE_API_KEY"],
    "automobile": ["SCRAPINGBEE_API_KEY"],
    "brumbrum": ["SCRAPINGBEE_API_KEY"],
    "ebay": ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"],
}

_ENV_TO_SETTINGS_ATTR: dict[str, str] = {
    "SCRAPINGBEE_API_KEY": "scrapingbee_api_key",
    "EBAY_CLIENT_ID": "ebay_client_id",
    "EBAY_CLIENT_SECRET": "ebay_client_secret",
}


def resolve_provider_configuration_status(provider_id: str, settings: Settings) -> ProviderConfigurationStatus:
    requirements = list(_REQUIREMENTS_BY_PROVIDER.get(provider_id, []))
    if not requirements:
        return ProviderConfigurationStatus(
            requirements=[],
            missing=[],
            message="No explicit provider secrets required",
        )

    if settings.test_stub_mode:
        return ProviderConfigurationStatus(
            requirements=requirements,
            missing=[],
            message="Configured via TEST_STUB_MODE=true",
        )

    missing: list[str] = []
    for env_name in requirements:
        attr = _ENV_TO_SETTINGS_ATTR.get(env_name)
        value = getattr(settings, attr, None) if attr else None
        if not value:
            missing.append(env_name)

    if missing:
        return ProviderConfigurationStatus(
            requirements=requirements,
            missing=missing,
            message=f"Missing required env: {', '.join(missing)}",
        )

    return ProviderConfigurationStatus(
        requirements=requirements,
        missing=[],
        message="Configured",
    )
