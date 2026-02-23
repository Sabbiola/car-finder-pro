import { Moon, Sun, Heart, User, LogOut, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useFavorites } from '@/hooks/useFavorites';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from './AuthModal';
import AISearchDialog from './AISearchDialog';

const Header = () => {
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const { count } = useFavorites();
  const { user, signOut } = useAuth();

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
    <>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-xl h-9 px-3 text-xs text-muted-foreground hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
              title="Cerca con AI"
            >
              <Sparkles className="h-3.5 w-3.5 text-violet-500" />
              <span>Cerca con AI</span>
            </Button>

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

            {user ? (
              <div className="flex items-center gap-1.5">
                <span className="hidden sm:block text-xs text-muted-foreground max-w-[120px] truncate">
                  {user.email}
                </span>
                <Button
                  variant="ghost" size="icon"
                  onClick={signOut}
                  className="rounded-xl h-9 w-9 hover:bg-muted"
                  title="Esci"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost" size="icon"
                onClick={() => setAuthOpen(true)}
                className="rounded-xl h-9 w-9 hover:bg-muted"
                title="Accedi"
              >
                <User className="h-4 w-4" />
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-xl h-9 w-9 hover:bg-muted">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

        </div>
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <AISearchDialog open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
};

export default Header;
