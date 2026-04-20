import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Award } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

import { FALLBACK_IMAGE } from "@/lib/constants";
import { sourceColors, sourceLabels } from "@/lib/mock-data";

interface ListingGalleryProps {
  images: string[];
  title: string;
  source: string;
  priceRating: string;
}

export function ListingGallery({ images, title, source, priceRating }: ListingGalleryProps) {
  const [imgIndex, setImgIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const prevImage = useCallback(() => {
    setImgIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const nextImage = useCallback(() => {
    setImgIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") { prevImage(); }
      if (event.key === "ArrowRight") { nextImage(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nextImage, prevImage]);

  const currentSrc = images[imgIndex] ?? FALLBACK_IMAGE;

  return (
    <>
      <div className="relative aspect-[4/3] lg:aspect-auto lg:flex-1 overflow-hidden">
        <img
          src={currentSrc}
          alt={`${title} - foto ${imgIndex + 1}`}
          className="w-full h-full object-cover transition-opacity duration-200 cursor-pointer"
          loading="lazy"
          referrerPolicy="no-referrer"
          onClick={() => setLightboxOpen(true)}
          onError={(event) => {
            (event.target as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              aria-label="Immagine precedente"
              className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-black/70 rounded-full p-2 shadow-md hover:scale-110 transition-transform"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={nextImage}
              aria-label="Immagine successiva"
              className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-black/70 rounded-full p-2 shadow-md hover:scale-110 transition-transform"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
        <div className="absolute bottom-3 right-3 bg-black/50 text-white text-[10px] font-semibold px-2.5 py-1 rounded-full">
          {imgIndex + 1} / {images.length}
        </div>
        <div
          className={`absolute top-3 left-3 ${sourceColors[source] ?? "bg-gray-600"} text-white text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm`}
        >
          {sourceLabels[source] ?? source}
        </div>
        {priceRating === "best" && (
          <div className="absolute top-3 right-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <Award className="h-3 w-3" /> TOP DEAL
          </div>
        )}
      </div>

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={imgIndex}
        slides={images.map((src) => ({ src }))}
      />

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin animate-brutal-up" style={{ animationDelay: "50ms" }}>
          {images.map((url, index) => (
            <button
              key={index}
              onClick={() => setImgIndex(index)}
              aria-label={`Foto ${index + 1}`}
              className={`flex-shrink-0 w-16 h-12 rounded-xl overflow-hidden transition-all ${
                index === imgIndex
                  ? "ring-2 ring-violet-500 scale-105 shadow-md"
                  : "opacity-60 hover:opacity-100 border border-border"
              }`}
            >
              <img src={url} alt={`Thumb ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}
