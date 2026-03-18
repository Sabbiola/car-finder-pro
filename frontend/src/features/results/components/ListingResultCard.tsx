import { lazy, Suspense, useState } from "react";

import CarCard from "@/components/CarCard";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { CarListing } from "@/lib/api/listings";
import { getRuntimeConfig } from "@/lib/runtimeConfig";
import { toCardListing } from "@/lib/toCardListing";

const ListingInsightsPanel = lazy(() => import("./ListingInsightsPanel"));

interface Props {
  listing: CarListing;
  index?: number;
}

const ListingResultCard = ({ listing, index }: Props) => {
  const [open, setOpen] = useState(false);
  const runtime = getRuntimeConfig();
  const cardListing = toCardListing(listing);
  const topReasons = listing.deal_summary?.top_reasons ?? [];
  const riskLevel = listing.trust_summary?.risk_level;
  const canShowInsights =
    runtime.backendMode === "fastapi" && (!!listing.deal_summary || !!listing.trust_summary);

  return (
    <>
      <div className="space-y-3">
        <CarCard listing={cardListing} index={index} showCompare />
        {canShowInsights && (
          <div className="rounded-2xl border border-border/60 bg-card p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {typeof listing.deal_score === "number" && (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Deal {listing.deal_score.toFixed(0)}
                  </span>
                )}
                {riskLevel && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                    Risk {riskLevel}
                  </span>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
                Why this car?
              </Button>
            </div>
            {topReasons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {topReasons.slice(0, 3).map((reason) => (
                  <span key={reason} className="rounded-full bg-muted px-3 py-1 text-[11px] text-foreground">
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>{listing.title}</DrawerTitle>
            <DrawerDescription>Analisi decisionale dell&apos;annuncio</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto">
            {open ? (
              <Suspense
                fallback={
                  <div className="rounded-xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
                    Caricamento insights...
                  </div>
                }
              >
                <ListingInsightsPanel listing={listing} />
              </Suspense>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default ListingResultCard;
