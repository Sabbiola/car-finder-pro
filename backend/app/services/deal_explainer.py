from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.models.analysis import DealSummary
from app.models.vehicle import VehicleListing
from app.ranking.reason_codes import (
    LONG_TIME_ON_MARKET,
    LOW_COMPARABLE_CONFIDENCE,
    MULTIPLE_PRICE_DROPS,
    NEGOTIATION_HEADROOM_HIGH,
    NEGOTIATION_HEADROOM_LOW,
    RECENT_PRICE_DROP,
)


class DealExplainer:
    def build_summary(
        self,
        listing: VehicleListing,
        *,
        benchmark_price: int,
        comparable_count: int,
        confidence: str,
        price_history: list[dict[str, Any]],
        first_seen_at: datetime | None,
    ) -> DealSummary:
        delta_pct = 0.0
        if benchmark_price > 0:
            delta_pct = round(((listing.price_amount - benchmark_price) / benchmark_price) * 100, 2)

        price_change_count = max(0, len(price_history) - 1)
        days_on_market: int | None = None
        if first_seen_at is not None:
            first_seen_utc = first_seen_at.astimezone(timezone.utc)
            days_on_market = max(0, int((datetime.now(timezone.utc) - first_seen_utc).days))

        top_reasons: list[str] = []
        if delta_pct <= -8:
            top_reasons.append(f"{abs(delta_pct):.0f}% sotto il benchmark comparabile")
            if NEGOTIATION_HEADROOM_LOW not in listing.reason_codes:
                listing.reason_codes.append(NEGOTIATION_HEADROOM_LOW)
        elif delta_pct < 0:
            top_reasons.append(f"{abs(delta_pct):.0f}% sotto la media comparabile")
            if NEGOTIATION_HEADROOM_LOW not in listing.reason_codes:
                listing.reason_codes.append(NEGOTIATION_HEADROOM_LOW)
        elif delta_pct >= 8:
            top_reasons.append(f"{delta_pct:.0f}% sopra il benchmark comparabile")
            if NEGOTIATION_HEADROOM_HIGH not in listing.reason_codes:
                listing.reason_codes.append(NEGOTIATION_HEADROOM_HIGH)
        else:
            top_reasons.append("prezzo vicino alla media comparabile")

        if days_on_market is not None and days_on_market >= 21:
            top_reasons.append(f"online da {days_on_market} giorni")
            if LONG_TIME_ON_MARKET not in listing.reason_codes:
                listing.reason_codes.append(LONG_TIME_ON_MARKET)

        if price_change_count >= 2:
            top_reasons.append(f"{price_change_count} ribassi registrati")
            if MULTIPLE_PRICE_DROPS not in listing.reason_codes:
                listing.reason_codes.append(MULTIPLE_PRICE_DROPS)
        elif price_change_count == 1:
            top_reasons.append("ha gia subito un ribasso")
            if RECENT_PRICE_DROP not in listing.reason_codes:
                listing.reason_codes.append(RECENT_PRICE_DROP)

        if confidence in {"low", "insufficient"} and LOW_COMPARABLE_CONFIDENCE not in listing.reason_codes:
            listing.reason_codes.append(LOW_COMPARABLE_CONFIDENCE)

        headline = "Affare interessante" if delta_pct <= -5 else "Da negoziare" if delta_pct >= 5 else "Prezzo allineato"
        summary = (
            f"Benchmark a EUR {benchmark_price:,}. "
            f"Scarto {delta_pct:+.1f}% con {comparable_count} comparabili "
            f"({confidence})."
        ).replace(",", ".")

        return DealSummary(
            headline=headline,
            summary=summary,
            top_reasons=top_reasons[:3],
            benchmark_price=benchmark_price,
            price_delta_pct=delta_pct,
            days_on_market=days_on_market,
            price_change_count=price_change_count,
            comparable_count=comparable_count,
            confidence=confidence,  # type: ignore[arg-type]
        )
