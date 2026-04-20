"""Tests for listing_enricher module: merge logic, similar filtering, automobile VIP parser."""
from __future__ import annotations

import json

import pytest

from app.models.vehicle import VehicleListing
from app.services.listing_enricher import filter_similar_listings, merge_enriched_listing


def _make_listing(**kwargs) -> VehicleListing:
    defaults = dict(
        provider="autoscout24",
        title="Test Car",
        price_amount=20000,
        fuel_type="Diesel",
        year=2020,
        mileage_value=50000,
    )
    defaults.update(kwargs)
    return VehicleListing(**defaults)


# ---------------------------------------------------------------------------
# merge_enriched_listing
# ---------------------------------------------------------------------------

class TestMergeEnrichedListing:
    def test_fills_missing_scalar_fields(self):
        base = _make_listing(color=None, doors=None, transmission=None)
        enriched = _make_listing(color="Nero", doors=4, transmission="Manuale")
        merged = merge_enriched_listing(base, enriched)
        assert merged.color == "Nero"
        assert merged.doors == 4
        assert merged.transmission == "Manuale"

    def test_does_not_overwrite_existing_values(self):
        base = _make_listing(color="Bianco", doors=4)
        enriched = _make_listing(color="Nero", doors=5)
        merged = merge_enriched_listing(base, enriched)
        assert merged.color == "Bianco"
        assert merged.doors == 4

    def test_prefers_longer_description(self):
        base = _make_listing(description="Short desc.")
        enriched = _make_listing(description="This is a much longer and more detailed description of the car listing.")
        merged = merge_enriched_listing(base, enriched)
        assert merged.description == enriched.description

    def test_keeps_base_description_when_enriched_is_shorter(self):
        base = _make_listing(description="This is a longer base description with lots of detail.")
        enriched = _make_listing(description="Short.")
        merged = merge_enriched_listing(base, enriched)
        assert merged.description == base.description

    def test_fills_description_when_base_is_empty(self):
        base = _make_listing(description=None)
        enriched = _make_listing(description="Detailed description.")
        merged = merge_enriched_listing(base, enriched)
        assert merged.description == "Detailed description."

    def test_prefers_larger_image_set(self):
        base = _make_listing()
        base.images = ["img1.jpg"]
        enriched = _make_listing()
        enriched.images = ["img1.jpg", "img2.jpg", "img3.jpg"]
        merged = merge_enriched_listing(base, enriched)
        assert len(merged.images) == 3

    def test_does_not_replace_large_image_set_with_smaller(self):
        base = _make_listing()
        base.images = ["a.jpg", "b.jpg", "c.jpg"]
        enriched = _make_listing()
        enriched.images = ["x.jpg"]
        merged = merge_enriched_listing(base, enriched)
        assert len(merged.images) == 3

    def test_copies_raw_payload_when_base_empty(self):
        base = _make_listing()
        base.raw_payload = None
        enriched = _make_listing()
        enriched.raw_payload = {"autoscout": {"equipment": ["ABS", "ESP"]}}
        merged = merge_enriched_listing(base, enriched)
        assert merged.raw_payload == {"autoscout": {"equipment": ["ABS", "ESP"]}}

    def test_does_not_mutate_base(self):
        base = _make_listing(color=None)
        enriched = _make_listing(color="Rosso")
        _ = merge_enriched_listing(base, enriched)
        assert base.color is None


# ---------------------------------------------------------------------------
# filter_similar_listings
# ---------------------------------------------------------------------------

class TestFilterSimilarListings:
    def _make_candidates(self):
        return [
            _make_listing(id="a", price_amount=20000, year=2020, fuel_type="Diesel"),
            _make_listing(id="b", price_amount=22000, year=2021, fuel_type="Diesel"),
            _make_listing(id="c", price_amount=15000, year=2015, fuel_type="Benzina"),
            _make_listing(id="d", price_amount=60000, year=2020, fuel_type="Diesel"),
        ]

    def test_excludes_self(self):
        base = _make_listing(id="a", price_amount=20000, year=2020, fuel_type="Diesel")
        candidates = self._make_candidates()
        result = filter_similar_listings(base, candidates)
        assert all(item.id != "a" for item in result)

    def test_prioritizes_same_fuel_and_year(self):
        base = _make_listing(id="base", price_amount=20000, year=2020, fuel_type="Diesel")
        candidates = self._make_candidates()
        result = filter_similar_listings(base, candidates)
        ids = [item.id for item in result]
        # "b" is similar year+fuel+price — should appear before "d" (price far off) and "c" (different fuel+year)
        assert "b" in ids
        assert result.index(next(i for i in result if i.id == "b")) < result.index(next(i for i in result if i.id == "d"))

    def test_respects_max_results(self):
        base = _make_listing(id="base", price_amount=20000, year=2020)
        candidates = [_make_listing(id=str(i), price_amount=20000 + i * 100) for i in range(20)]
        result = filter_similar_listings(base, candidates, max_results=4)
        assert len(result) <= 4

    def test_empty_candidates(self):
        base = _make_listing(id="base")
        assert filter_similar_listings(base, []) == []


# ---------------------------------------------------------------------------
# Automobile VIP parser (smoke test with minimal fixture)
# ---------------------------------------------------------------------------

class TestAutomobileVipParser:
    def _make_page_props(self) -> dict:
        # Format matches actual automobile.it API: values is always a list
        return {
            "result": {
                "title": "BMW 320d M Sport",
                "formattedPrice": "24.900",
                "description": "Ottima auto, garanzia 12 mesi.",
                "url": "/Roma-BMW-320d-M-Sport/123456789",
                "channel": "usato",
                "sellerType": "DEALER",
                "dealer": {"name": "AutoMondo Roma"},
                "location": "Roma",
                "vipPictures": [{"imgBig": "https://img.example.com/1.jpg"}],
            },
            "vehicleInformation": {
                "basicInfo": [
                    {"title": "Cambio", "values": ["Automatico"]},
                    {"title": "Carburante", "values": ["Diesel"]},
                    {"title": "Numero di porte", "values": ["4 porte"]},
                    {"title": "Potenza", "values": ["140 kW (190 CV)"]},
                    {"title": "Chilometri", "values": ["42.000"]},
                    {"title": "Immatricolazione", "values": ["Marzo 2021"]},
                    {"title": "Marca", "values": ["BMW"]},
                    {"title": "Modello", "values": ["320d"]},
                ],
                "aesthetic": [{"title": "Colore esterno", "values": ["Nero Zaffiro"]}],
                "accessories": [
                    {"title": "Sicurezza", "values": ["ABS", "ESP", "Cruise Control"]},
                ],
            },
        }

    def test_parses_listing_fields(self):
        from app.providers.automobile.provider import AutomobileProvider

        props = self._make_page_props()
        provider = AutomobileProvider()
        result = provider._parse_automobile_vip(
            props["result"],
            props.get("vehicleInformation"),
            "https://www.automobile.it/Roma-BMW-320d-M-Sport/123456789",
        )
        assert result is not None
        assert result.price_amount == 24900
        assert result.title == "BMW 320d M Sport"
        assert result.transmission == "Automatico"
        assert result.fuel_type == "Diesel"
        assert result.doors == 4
        assert result.year == 2021
        assert result.mileage_value == 42000
        assert result.color == "Nero Zaffiro"
        assert result.seller_type == "dealer"
        assert result.seller_name == "AutoMondo Roma"
        assert len(result.images) >= 1

    def test_returns_none_when_price_missing(self):
        from app.providers.automobile.provider import AutomobileProvider

        props = self._make_page_props()
        props["result"]["formattedPrice"] = ""
        provider = AutomobileProvider()
        result = provider._parse_automobile_vip(props["result"], props.get("vehicleInformation"), "https://x.it")
        assert result is None

    def test_returns_none_when_title_missing(self):
        from app.providers.automobile.provider import AutomobileProvider

        props = self._make_page_props()
        props["result"]["title"] = ""
        provider = AutomobileProvider()
        result = provider._parse_automobile_vip(props["result"], props.get("vehicleInformation"), "https://x.it")
        assert result is None

    def test_equipment_in_raw_payload(self):
        from app.providers.automobile.provider import AutomobileProvider

        props = self._make_page_props()
        provider = AutomobileProvider()
        result = provider._parse_automobile_vip(props["result"], props.get("vehicleInformation"), "https://x.it")
        assert result is not None
        assert result.raw_payload is not None
        equipment = result.raw_payload.get("equipment") or []
        assert "ABS" in equipment
