import { Plus, Check } from "lucide-react";
import { useCompare } from "@/hooks/useCompare";

interface Props {
  id: string;
}

const CompareButton = ({ id }: Props) => {
  const { addToCompare, removeFromCompare, isInCompare, canAdd } = useCompare();
  const active = isInCompare(id);

  if (!active && !canAdd) return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (active) removeFromCompare(id);
        else addToCompare(id);
      }}
      title={active ? "Rimuovi dal confronto" : "Aggiungi al confronto"}
      className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg border transition-colors duration-150 flex items-center gap-1 ${
        active
          ? "bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700"
          : "bg-background/90 text-muted-foreground border-border/60 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-300 dark:hover:bg-violet-900/20"
      }`}
    >
      {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      {active ? "Aggiunto" : "Confronta"}
    </button>
  );
};

export default CompareButton;
