from app.core.provider_configuration import resolve_provider_configuration_status
from app.core.settings import Settings


def test_provider_configuration_status_reports_missing_envs() -> None:
    settings = Settings(
        test_stub_mode=False,
        scrapingbee_api_key="",
        ebay_client_id="",
        ebay_client_secret="",
    )

    autoscout = resolve_provider_configuration_status("autoscout24", settings)
    assert autoscout.requirements == ["SCRAPINGBEE_API_KEY"]
    assert autoscout.missing == ["SCRAPINGBEE_API_KEY"]
    assert "Missing required env" in autoscout.message

    ebay = resolve_provider_configuration_status("ebay", settings)
    assert ebay.requirements == ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"]
    assert ebay.missing == ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"]
    assert "Missing required env" in ebay.message


def test_provider_configuration_status_is_satisfied_in_test_stub_mode() -> None:
    settings = Settings(test_stub_mode=True)

    autoscout = resolve_provider_configuration_status("autoscout24", settings)
    assert autoscout.requirements == ["SCRAPINGBEE_API_KEY"]
    assert autoscout.missing == []
    assert autoscout.message == "Configured via TEST_STUB_MODE=true"

