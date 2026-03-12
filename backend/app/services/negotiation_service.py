from __future__ import annotations

from app.models.analysis import DealSummary, NegotiationSummary, TrustSummary
from app.models.vehicle import VehicleListing


class NegotiationService:
    def build_summary(
        self,
        listing: VehicleListing,
        *,
        deal_summary: DealSummary | None,
        trust_summary: TrustSummary | None,
    ) -> NegotiationSummary:
        benchmark_price = deal_summary.benchmark_price if deal_summary and deal_summary.benchmark_price else listing.price_amount
        trust_score = trust_summary.trust_score if trust_summary else 50.0
        days_on_market = deal_summary.days_on_market if deal_summary else None

        risk_penalty = 0.0
        if trust_score < 45:
            risk_penalty = 0.10
        elif trust_score < 65:
            risk_penalty = 0.05

        target_price = int(round(benchmark_price * (1 - risk_penalty)))
        if days_on_market is not None and days_on_market >= 30 and trust_score >= 45:
            opening_factor = 0.90
            confidence = "medium"
        elif days_on_market is not None and days_on_market >= 14:
            opening_factor = 0.93
            confidence = "medium"
        else:
            opening_factor = 0.96
            confidence = "low"

        opening_offer = int(round(target_price * opening_factor))
        walk_away_price = min(listing.price_amount, target_price)
        headroom_pct = round(max(0.0, ((listing.price_amount - target_price) / max(listing.price_amount, 1)) * 100), 2)

        arguments: list[str] = []
        if deal_summary and deal_summary.price_delta_pct is not None and deal_summary.price_delta_pct > 0:
            arguments.append(f"prezzo sopra benchmark di {deal_summary.price_delta_pct:.1f}%")
        if deal_summary and deal_summary.days_on_market is not None and deal_summary.days_on_market >= 21:
            arguments.append(f"annuncio online da {deal_summary.days_on_market} giorni")
        if trust_summary and trust_summary.flags:
            arguments.append(trust_summary.flags[0])
        if not arguments:
            arguments.append("margine moderato rispetto ai comparabili")

        questions = [
            "Ci sono fatture di manutenzione o tagliandi recenti?",
            "Il prezzo e trattabile dopo visione e prova?",
            "Ci sono lavori da fare nel breve periodo?",
        ]
        if listing.seller_type == "private":
            questions.append("Da quanto tempo possiedi l'auto e perche la vendi?")

        checklist = [
            "controllare storico manutenzione",
            "verificare usura pneumatici e freni",
            "controllare eventuali spie in accensione",
            "provare avviamento a freddo e cambio",
        ]

        message_template = (
            f"Ciao, sono interessato a {listing.title}. "
            f"Sto confrontando annunci simili e valuterei un'offerta intorno a EUR {opening_offer:,} "
            f"dopo visione e verifica condizioni. Possiamo sentirci?".replace(",", ".")
        )

        return NegotiationSummary(
            target_price=target_price,
            opening_offer=opening_offer,
            walk_away_price=walk_away_price,
            negotiation_headroom_pct=headroom_pct,
            arguments=arguments,
            questions_for_seller=questions,
            inspection_checklist=checklist,
            message_template=message_template,
            confidence=confidence,  # type: ignore[arg-type]
        )
