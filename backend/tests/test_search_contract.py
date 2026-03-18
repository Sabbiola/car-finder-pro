import pytest
from pydantic import ValidationError

from app.models.search import SearchRequest


def test_search_request_private_only_alias_normalization() -> None:
    request = SearchRequest(brand="BMW", private_only=True)
    assert request.seller_type == "private"
    assert request.private_only is True
    assert request.normalized_seller_type == "private"


def test_search_request_private_seller_type_sets_private_only_for_additive_compatibility() -> None:
    request = SearchRequest(brand="BMW", seller_type="private")
    assert request.private_only is True
    assert request.normalized_seller_type == "private"


def test_search_request_rejects_conflicting_private_only_and_dealer() -> None:
    with pytest.raises(ValidationError):
        SearchRequest(brand="BMW", seller_type="dealer", private_only=True)

