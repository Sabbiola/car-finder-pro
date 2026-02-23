import { Plus, Check } from 'lucide-react';
import { useCompare } from '@/hooks/useCompare';

interface Props {
  id: string;
}

const CompareButton = ({ id }: Props) => {
  const { addToCompare, removeFromCompare, isInCompare, canAdd } = useCompare();
  const active = isInCompare(id);

  if (!active && !canAdd) return null;

  return (
    <button
      onClick={e => {
        e.stopPropagation();
        if (active) removeFromCompare(id);
        else addToCompare(id);
      }}
      title={active ? 'Rimuovi dal confronto' : 'Aggiungi al confronto'}
      className={`text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-1 border-2 transition-colors duration-150 flex items-center gap-1 ${
        active
          ? 'bg-foreground text-background border-foreground'
          : 'bg-background/90 text-foreground border-foreground hover:bg-foreground hover:text-background'
      }`}
    >
      {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      {active ? 'NEL CONFRONTO' : 'CONFRONTA'}
    </button>
  );
};

export default CompareButton;
