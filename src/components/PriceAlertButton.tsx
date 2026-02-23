import { useState, useCallback } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const KEY = 'car-finder-price-alerts';

interface PriceAlert {
  listingId: string;
  title: string;
  currentPrice: number;
  targetPrice: number;
  createdAt: string;
}

function readAlerts(): PriceAlert[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  localStorage.setItem(KEY, JSON.stringify(alerts));
}

interface Props {
  listingId: string;
  currentPrice: number;
  title: string;
}

const PriceAlertButton = ({ listingId, currentPrice, title }: Props) => {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<PriceAlert[]>(readAlerts);
  const isActive = alerts.some(a => a.listingId === listingId);

  const toggle = useCallback(() => {
    const current = readAlerts();
    if (current.some(a => a.listingId === listingId)) {
      const updated = current.filter(a => a.listingId !== listingId);
      saveAlerts(updated);
      setAlerts(updated);
      toast({ title: 'Alert rimosso', description: `Non riceverai più notifiche per ${title}` });
    } else {
      const targetStr = window.prompt(
        `Imposta prezzo obiettivo per:\n"${title}"\n\nPrezzo attuale: €${currentPrice.toLocaleString('it-IT')}\nInserisci il prezzo massimo al quale vuoi essere avvisato:`,
        String(Math.round(currentPrice * 0.9))
      );
      if (!targetStr) return;
      const targetPrice = parseInt(targetStr.replace(/\D/g, ''));
      if (!targetPrice || targetPrice <= 0) {
        toast({ title: 'Prezzo non valido', variant: 'destructive' });
        return;
      }
      const newAlert: PriceAlert = {
        listingId, title, currentPrice, targetPrice,
        createdAt: new Date().toISOString(),
      };
      const updated = [...current, newAlert];
      saveAlerts(updated);
      setAlerts(updated);
      toast({
        title: 'Alert attivato',
        description: `Ti avviseremo quando il prezzo scende sotto €${targetPrice.toLocaleString('it-IT')}`,
      });
    }
  }, [listingId, currentPrice, title, toast]);

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggle}
      className={`rounded-xl h-12 w-12 flex-shrink-0 transition-colors ${isActive ? 'border-violet-500 text-violet-600 bg-violet-50 dark:bg-violet-900/20' : ''}`}
      aria-label={isActive ? 'Rimuovi alert prezzo' : 'Imposta alert prezzo'}
      title={isActive ? 'Alert attivo — clicca per rimuovere' : 'Imposta alert prezzo'}
    >
      {isActive ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
    </Button>
  );
};

export default PriceAlertButton;

// Utility hook to access all active alerts (used by Header badge)
export function usePriceAlerts() {
  const [alerts, setAlerts] = useState<PriceAlert[]>(readAlerts);

  const refresh = useCallback(() => setAlerts(readAlerts()), []);

  return { alerts, refresh, count: alerts.length };
}
