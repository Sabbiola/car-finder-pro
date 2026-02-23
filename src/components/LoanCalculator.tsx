import { useState, useMemo } from 'react';
import { Calculator } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

interface Props {
  price: number;
}

const LoanCalculator = ({ price }: Props) => {
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [months, setMonths] = useState(48);
  const [annualRate, setAnnualRate] = useState(6.9);

  const { monthlyPayment, totalCost, totalInterest, financed } = useMemo(() => {
    const downPayment = Math.round(price * downPaymentPct / 100);
    const financed = price - downPayment;
    const monthlyRate = annualRate / 100 / 12;
    let monthlyPayment: number;
    if (monthlyRate === 0) {
      monthlyPayment = financed / months;
    } else {
      monthlyPayment = financed * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
    }
    const totalCost = monthlyPayment * months + downPayment;
    const totalInterest = totalCost - price;
    return {
      monthlyPayment: Math.round(monthlyPayment),
      totalCost: Math.round(totalCost),
      totalInterest: Math.round(totalInterest),
      financed,
    };
  }, [price, downPaymentPct, months, annualRate]);

  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden">
      <div className="border-b border-border/60 px-5 py-3 flex items-center gap-2 bg-muted/40">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Simulatore rata</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Anticipo */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground">Anticipo</Label>
            <span className="text-sm font-bold">
              {downPaymentPct}% — €{Math.round(price * downPaymentPct / 100).toLocaleString('it-IT')}
            </span>
          </div>
          <Slider
            min={0} max={50} step={5}
            value={[downPaymentPct]}
            onValueChange={([v]) => setDownPaymentPct(v)}
            className="w-full"
          />
        </div>

        {/* Durata */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground">Durata</Label>
            <span className="text-sm font-bold">{months} mesi</span>
          </div>
          <Slider
            min={12} max={84} step={12}
            value={[months]}
            onValueChange={([v]) => setMonths(v)}
            className="w-full"
          />
        </div>

        {/* Tasso */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground">Tasso annuo (TAN)</Label>
            <span className="text-sm font-bold">{annualRate.toFixed(1)}%</span>
          </div>
          <Slider
            min={1} max={15} step={0.1}
            value={[annualRate]}
            onValueChange={([v]) => setAnnualRate(v)}
            className="w-full"
          />
        </div>

        {/* Risultati */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 rounded-xl p-3 col-span-2">
            <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Rata mensile stimata</div>
            <div className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">
              €{monthlyPayment.toLocaleString('it-IT')}/mese
            </div>
          </div>
          <div className="bg-muted/60 rounded-xl p-3">
            <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Importo finanziato</div>
            <div className="text-sm font-bold">€{financed.toLocaleString('it-IT')}</div>
          </div>
          <div className="bg-muted/60 rounded-xl p-3">
            <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Interessi totali</div>
            <div className="text-sm font-bold text-amber-600 dark:text-amber-400">
              +€{totalInterest.toLocaleString('it-IT')}
            </div>
          </div>
          <div className="bg-muted/60 rounded-xl p-3 col-span-2">
            <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Costo totale (anticipo + rate)</div>
            <div className="text-sm font-bold">€{totalCost.toLocaleString('it-IT')}</div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Simulazione indicativa. Tassi e condizioni reali dipendono dal finanziatore.
        </p>
      </div>
    </div>
  );
};

export default LoanCalculator;
