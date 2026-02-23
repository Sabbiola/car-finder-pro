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
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg animate-brutal-in">
      <div className="container flex items-center justify-between h-16">

        <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm group-hover:shadow-violet-300/50 group-hover:scale-105 transition-all duration-200">
            <span className="text-white text-sm font-bold">A</span>
          </div>
          <span className="text-base font-bold text-foreground">AutoDeal</span>
          <span className="text-base font-bold bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">Finder</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigate('/preferiti')}
            className="relative flex items-center justify-center h-9 w-9 rounded-xl hover:bg-muted transition-colors"
            aria-label="Preferiti"
          >
            <Heart className="h-4 w-4" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-[8px] font-bold min-w-[16px] h-[16px] flex items-center justify-center px-0.5 rounded-full">
                {count}
              </span>
            )}
          </button>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl h-9 w-9 hover:bg-muted">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

      </div>
    </header>
  );
};

export default Header;
