from __future__ import annotations

from app.models.analysis import SellerProfile, TrustSummary
from app.models.vehicle import VehicleListing
from app.ranking.reason_codes import DUPLICATE_CLUSTER_MERGED
from app.services.supabase_market_repository import SupabaseMarketRepository


class TrustService:
    def __init__(self, repository: SupabaseMarketRepository) -> None:
        self.repository = repository

    async def build_summary(
        self,
        listing: VehicleListing,
        *,
        image_reuse_count_hint: int | None = None,
        seller_stats_hint: dict | None = None,
    ) -> TrustSummary:
        flags: list[str] = []
        trust_score = 60.0
        completeness_parts = [
            listing.year is not None,
            listing.mileage_value is not None,
            bool(listing.images),
            bool(listing.description),
            bool(listing.fuel_type),
            bool(listing.transmission),
        ]
        data_completeness_score = round((sum(1 for item in completeness_parts if item) / len(completeness_parts)) * 100, 2)

        if data_completeness_score < 50:
            flags.append("dati essenziali incompleti")
            trust_score -= 18
        elif data_completeness_score < 75:
            flags.append("dati parziali")
            trust_score -= 8

        if len(listing.images) <= 2:
            flags.append("poche foto")
            trust_score -= 10

        if not listing.description or len(listing.description.strip()) < 40:
            flags.append("descrizione generica")
            trust_score -= 8

        if listing.year is not None and listing.price_amount > 0 and listing.year < 2005 and listing.price_amount > 25_000:
            flags.append("prezzo alto per anno del veicolo")
            trust_score -= 12

        if listing.mileage_value is not None and listing.mileage_value > 250_000 and listing.price_amount > 20_000:
            flags.append("km elevati rispetto al prezzo")
            trust_score -= 12

        duplicate_cluster_size = 2 if DUPLICATE_CLUSTER_MERGED in listing.reason_codes else 1
        if duplicate_cluster_size > 1:
            flags.append("annuncio rilevato su piu sorgenti")
            trust_score -= 4

        image_reuse_count = 0
        if image_reuse_count_hint is not None:
            image_reuse_count = image_reuse_count_hint
        elif self.repository.is_configured() and listing.listing_hash:
            image_reuse_count = await self.repository.fetch_image_reuse_count(listing.listing_hash)
        if image_reuse_count > 0:
            flags.append("immagini riutilizzate")
            trust_score -= min(15, image_reuse_count * 4)

        seller_profile = SellerProfile(
            seller_type_inferred=listing.seller_type,
            seller_name=listing.seller_name,
            seller_url=listing.seller_url,
            confidence="low" if listing.seller_type else "insufficient",
            notes=[],
        )

        if seller_stats_hint is not None:
            stats = seller_stats_hint
        elif self.repository.is_configured() and any(
            [listing.seller_external_id, listing.seller_phone_hash, listing.seller_url]
        ):
            stats = await self.repository.fetch_seller_fingerprint_stats(
                seller_external_id=listing.seller_external_id,
                seller_phone_hash=listing.seller_phone_hash,
                seller_url=listing.seller_url,
            )
        else:
            stats = {"listing_count": 0, "private_count": 0, "dealer_count": 0}

        if listing.seller_type == "private" and stats.get("dealer_count", 0) >= 2:
            flags.append("profilo privato con segnali da rivenditore")
            seller_profile.notes.append("storico seller coerente con dealer")
            seller_profile.confidence = "medium"
            trust_score -= 15

        risk_level = "low"
        if trust_score < 45:
            risk_level = "high"
        elif trust_score < 65:
            risk_level = "medium"

        summary = "Segnali affidabili nel complesso." if risk_level == "low" else (
            "Annuncio da verificare prima di trattare." if risk_level == "medium" else "Annuncio con diversi segnali di rischio."
        )
        return TrustSummary(
            trust_score=round(max(0.0, min(100.0, trust_score)), 2),
            risk_level=risk_level,  # type: ignore[arg-type]
            flags=flags,
            seller_profile=seller_profile,
            data_completeness_score=data_completeness_score,
            duplicate_cluster_size=duplicate_cluster_size,
            image_reuse_count=image_reuse_count,
            summary=summary,
        )
