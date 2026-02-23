import { Moon, Sun, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useFavorites } from '@/hooks/useFavorites';

const Header = () => {
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const { count } = useFavorites();

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'theme') {
        const isDark = e.newValue === 'dark';
        setDark(isDark);
        document.documentElement.classList.toggle('dark', isDark);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const toggleTheme = () => {
    setDark(d => {
      const next = !d;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <header className="sticky top-0 z-50 border-b-2 border-foreground bg-background animate-brutal-in">
      <div className="container flex items-center justify-between h-14">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 group glitch-hover" data-text="AutoDeal Finder">
          <span className="text-sm font-bold uppercase tracking-[0.2em]">
            AutoDeal
          </span>
          <span className="text-xs text-accent uppercase tracking-[0.15em] font-bold">
            Finder
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/preferiti')}
            className="relative flex items-center justify-center h-8 w-8 border border-border hover:border-foreground transition-colors"
            aria-label="Preferiti"
          >
            <Heart className="h-3.5 w-3.5" />
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-accent text-accent-foreground text-[8px] font-bold min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                {count}
              </span>
            )}
          </button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-none border border-border h-8 w-8">
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
