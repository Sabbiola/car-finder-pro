from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.services.repositories.base import _parse_datetime


class AnalysisMixin:
    async def fetch_analysis_snapshot(self, snapshot_key: str) -> dict[str, Any] | None:
        payload = await self._request(  # type: ignore[attr-defined]
            "GET",
            "listing_analysis_snapshots",
            params={"snapshot_key": f"eq.{snapshot_key}", "select": "*", "limit": "1"},
        )
        if not payload:
            return None
        row = payload[0]
        expires_at = _parse_datetime(row.get("expires_at"))
        if expires_at is not None and expires_at < datetime.now(timezone.utc):
            return None
        return row

    async def upsert_analysis_snapshot(
        self,
        *,
        snapshot_key: str,
        listing_id: str | None,
        payload: dict[str, Any],
        expires_at: datetime,
    ) -> None:
        if not self._write_key():  # type: ignore[attr-defined]
            return
        row = {
            "snapshot_key": snapshot_key,
            "listing_id": listing_id,
            "source": "fastapi",
            "payload": payload,
            "expires_at": expires_at.astimezone(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await self._request(  # type: ignore[attr-defined]
            "POST",
            "listing_analysis_snapshots",
            params={"on_conflict": "snapshot_key"},
            json_payload=[row],
            write=True,
            extra_headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        )

    async def fetch_image_reuse_count(self, listing_hash: str) -> int:
        if not listing_hash:
            return 0
        payload = await self._request(  # type: ignore[attr-defined]
            "GET",
            "listing_image_fingerprints",
            params={"listing_hash": f"eq.{listing_hash}", "select": "fingerprint_hash"},
        )
        if not payload:
            return 0
        fingerprints = [row.get("fingerprint_hash") for row in payload if row.get("fingerprint_hash")]
        if not fingerprints:
            return 0

        total = 0
        for fingerprint in set(fingerprints):
            matches = await self._request(  # type: ignore[attr-defined]
                "GET",
                "listing_image_fingerprints",
                params={"fingerprint_hash": f"eq.{fingerprint}", "select": "id"},
            )
            total += max(0, len(matches or []) - 1)
        return total

    async def fetch_image_reuse_counts(self, listing_hashes: list[str]) -> dict[str, int]:
        cleaned = sorted({item for item in listing_hashes if item})
        if not cleaned:
            return {}

        hash_selector = ",".join(cleaned)
        fingerprints_rows = await self._request(  # type: ignore[attr-defined]
            "GET",
            "listing_image_fingerprints",
            params={
                "listing_hash": f"in.({hash_selector})",
                "select": "listing_hash,fingerprint_hash",
                "limit": "5000",
            },
        )
        rows = list(fingerprints_rows or [])
        if not rows:
            return {listing_hash: 0 for listing_hash in cleaned}

        fingerprints_by_listing: dict[str, set[str]] = {}
        all_fingerprints: set[str] = set()
        for row in rows:
            listing_hash = str(row.get("listing_hash") or "")
            fingerprint_hash = str(row.get("fingerprint_hash") or "")
            if not listing_hash or not fingerprint_hash:
                continue
            fingerprints_by_listing.setdefault(listing_hash, set()).add(fingerprint_hash)
            all_fingerprints.add(fingerprint_hash)

        if not all_fingerprints:
            return {listing_hash: 0 for listing_hash in cleaned}

        fingerprint_selector = ",".join(sorted(all_fingerprints))
        matches_rows = await self._request(  # type: ignore[attr-defined]
            "GET",
            "listing_image_fingerprints",
            params={
                "fingerprint_hash": f"in.({fingerprint_selector})",
                "select": "fingerprint_hash",
                "limit": "10000",
            },
        )
        counts_by_fingerprint: dict[str, int] = {}
        for row in list(matches_rows or []):
            fingerprint_hash = str(row.get("fingerprint_hash") or "")
            if not fingerprint_hash:
                continue
            counts_by_fingerprint[fingerprint_hash] = counts_by_fingerprint.get(fingerprint_hash, 0) + 1

        result: dict[str, int] = {}
        for listing_hash in cleaned:
            listing_fingerprints = fingerprints_by_listing.get(listing_hash, set())
            reuse_count = 0
            for fingerprint in listing_fingerprints:
                reuse_count += max(0, counts_by_fingerprint.get(fingerprint, 0) - 1)
            result[listing_hash] = reuse_count
        return result
