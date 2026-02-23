import { useEffect, useState } from 'react';
import { X, GitCompare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useCompare } from '@/hooks/useCompare';
import { fetchListingsByIds } from '@/lib/api/fetchByIds';
import type { CarListing } from '@/lib/api/listings';

const CompareBar = () => {
  const { compareIds, removeFromCompare, clearCompare } = useCompare();
  const navigate = useNavigate();
  const [previews, setPreviews] = useState<CarListing[]>([]);

  useEffect(() => {
    if (!compareIds.length) { setPreviews([]); return; }
    fetchListingsByIds(compareIds).then(setPreviews).catch(console.error);
  }, [compareIds.join(',')]);

  return (
    <AnimatePresence>
      {compareIds.length > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-foreground bg-background"
        >
          <div className="container flex items-center justify-between h-16 gap-4">
            {/* Mini preview auto */}
            <div className="flex items-center gap-2 overflow-x-auto flex-1 min-w-0">
              {previews.map(car => (
                <div key={car.id} className="flex items-center gap-1.5 border-2 border-border px-2 py-1 flex-shrink-0">
                  {car.image_url && (
                    <img
                      src={car.image_url}
                      alt={car.title}
                      className="w-8 h-6 object-cover border border-border"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <div>
                    <div className="text-[8px] uppercase tracking-[0.1em] font-bold leading-none max-w-[80px] truncate">
                      {car.brand} {car.model}
                    </div>
                    <div className="text-[9px] font-bold">
                      €{car.price.toLocaleString('it-IT')}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCompare(car.id)}
                    className="ml-1 text-muted-foreground hover:text-accent transition-colors"
                    aria-label="Rimuovi"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Azioni */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={clearCompare}
                className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground transition-colors"
              >
                Azzera
              </button>
              <button
                disabled={compareIds.length < 2}
                onClick={() => navigate(`/confronta?ids=${compareIds.join(',')}`)}
                className="flex items-center gap-1.5 bg-foreground text-background border-2 border-foreground text-[10px] font-bold uppercase tracking-[0.1em] px-4 h-9 hover:bg-accent hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <GitCompare className="h-3.5 w-3.5" />
                CONFRONTA {compareIds.length} AUTO
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CompareBar;
