import { useState, useCallback, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const LS_KEY = 'car-finder-price-alerts';

interface PriceAlert {
  listingId: string;
  title: string;
  currentPrice: number;
  targetPrice: number;
  createdAt: string;
}

function readAlerts(): PriceAlert[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAlerts(alerts: PriceAlert[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(alerts));
}

interface Props {
  listingId: string;
  currentPrice: number;
  title: string;
}

const PriceAlertButton = ({ listingId, currentPrice, title }: Props) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  // Load initial active state
  useEffect(() => {
    if (user) {
      supabase
        .from('price_alerts')
        .select('id')
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
        .eq('is_active', true)
        .maybeSingle()
        .then(({ data }) => setIsActive(!!data));
    } else {
      setIsActive(readAlerts().some(a => a.listingId === listingId));
    }
  }, [user, listingId]);

  const handleToggle = useCallback(() => {
    if (isActive) {
      if (user) {
        supabase.from('price_alerts')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId)
          .then(() => {
            setIsActive(false);
            toast({ title: 'Alert rimosso', description: `Non riceverai più notifiche per ${title}` });
          });
      } else {
        const updated = readAlerts().filter(a => a.listingId !== listingId);
        saveAlerts(updated);
        setIsActive(false);
        toast({ title: 'Alert rimosso', description: `Non riceverai più notifiche per ${title}` });
      }
    } else {
      setTargetInput(String(Math.round(currentPrice * 0.9)));
      setDialogOpen(true);
    }
  }, [isActive, user, listingId, currentPrice, title, toast]);

  const handleConfirm = useCallback(async () => {
    const targetPrice = parseInt(targetInput.replace(/\D/g, ''));
    if (!targetPrice || targetPrice <= 0) {
      toast({ title: 'Prezzo non valido', variant: 'destructive' });
      return;
    }
    setDialogOpen(false);

    if (user) {
      const { error } = await supabase.from('price_alerts').insert({
        user_id: user.id,
        listing_id: listingId,
        target_price: targetPrice,
        is_active: true,
      });
      if (!error) {
        setIsActive(true);
        toast({
          title: 'Alert attivato',
          description: `Ti avviseremo quando il prezzo scende sotto €${targetPrice.toLocaleString('it-IT')}`,
        });
      }
    } else {
      const current = readAlerts();
      const newAlert: PriceAlert = {
        listingId, title, currentPrice, targetPrice,
        createdAt: new Date().toISOString(),
      };
      saveAlerts([...current, newAlert]);
      setIsActive(true);
      toast({
        title: 'Alert attivato',
        description: `Ti avviseremo quando il prezzo scende sotto €${targetPrice.toLocaleString('it-IT')}`,
      });
    }
  }, [targetInput, user, listingId, title, currentPrice, toast]);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        onClick={handleToggle}
        className={`rounded-xl h-12 w-12 flex-shrink-0 transition-colors ${isActive ? 'border-violet-500 text-violet-600 bg-violet-50 dark:bg-violet-900/20' : ''}`}
        aria-label={isActive ? 'Rimuovi alert prezzo' : 'Imposta alert prezzo'}
        title={isActive ? 'Alert attivo — clicca per rimuovere' : 'Imposta alert prezzo'}
      >
        {isActive ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Imposta alert prezzo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground line-clamp-1">{title}</p>
            <p className="text-sm">
              Prezzo attuale:{' '}
              <span className="font-semibold">€{currentPrice.toLocaleString('it-IT')}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="alert-target-price">Prezzo obiettivo (€)</Label>
              <Input
                id="alert-target-price"
                type="number"
                min={1}
                value={targetInput}
                onChange={e => setTargetInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setDialogOpen(false)}>
              Annulla
            </Button>
            <Button className="rounded-xl" onClick={handleConfirm}>
              Attiva alert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PriceAlertButton;

// Utility hook to access all active alerts (used by other components)
export function usePriceAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  useEffect(() => {
    if (user) {
      supabase
        .from('price_alerts')
        .select('listing_id, target_price, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .then(({ data }) => {
          if (data) {
            setAlerts(data.map(r => ({
              listingId: r.listing_id,
              title: '',
              currentPrice: 0,
              targetPrice: r.target_price,
              createdAt: r.created_at,
            })));
          }
        });
    } else {
      setAlerts(readAlerts());
    }
  }, [user]);

  return { alerts, count: alerts.length };
}
