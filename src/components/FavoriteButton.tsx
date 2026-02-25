import { Heart } from 'lucide-react';
import { useFavorites } from '@/hooks/useFavorites';

interface Props {
  id: string;
  className?: string;
}

const FavoriteButton = ({ id, className = '' }: Props) => {
  const { toggle, isFavorite } = useFavorites();
  const active = isFavorite(id);

  return (
    <button
      onClick={e => { e.stopPropagation(); toggle(id); }}
      aria-label={active ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
      className={`p-1.5 rounded-xl border border-border/60 bg-background/90 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-500 dark:hover:bg-rose-900/20 dark:hover:border-rose-700 transition-colors duration-150 ${className}`}
    >
      <Heart
        className="h-3.5 w-3.5"
        fill={active ? 'hsl(var(--accent))' : 'none'}
        style={active ? { color: 'hsl(var(--accent))' } : {}}
      />
    </button>
  );
};

export default FavoriteButton;
