import { Moon, Sun, Heart, User, LogOut, Sparkles, CircleUser, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useFavorites } from "@/hooks/useFavorites";
import { useAuth } from "@/contexts/useAuth";
import {
  clearRuntimeOverrides,
  getRuntimeConfigDiagnostics,
  RUNTIME_CONFIG_CHANGED_EVENT,
} from "@/lib/runtimeConfig";
import AuthModal from "./AuthModal";
import AISearchDialog from "./AISearchDialog";

const Header = () => {
  const navigate = useNavigate();
  const [dark, setDark] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [runtimeOverrideText, setRuntimeOverrideText] = useState<string | null>(null);
  const { count } = useFavorites();
  const { user, signOut } = useAuth();

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "theme") {
        const isDark = e.newValue === "dark";
        setDark(isDark);
        document.documentElement.classList.toggle("dark", isDark);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    const refreshRuntimeOverrideState = () => {
      const diagnostics = getRuntimeConfigDiagnostics();
      if (!diagnostics.hasBrowserOverrides) {
        setRuntimeOverrideText(null);
        return;
      }
      const activeFields: string[] = [];
      if (diagnostics.localStorageKeysPresent.backendMode) {activeFields.push("backendMode");}
      if (diagnostics.localStorageKeysPresent.apiBaseUrl) {activeFields.push("apiBaseUrl");}
      setRuntimeOverrideText(`Override runtime browser attivo: ${activeFields.join(", ")}`);
    };

    refreshRuntimeOverrideState();
    window.addEventListener("storage", refreshRuntimeOverrideState);
    window.addEventListener(RUNTIME_CONFIG_CHANGED_EVENT, refreshRuntimeOverrideState);
    return () => {
      window.removeEventListener("storage", refreshRuntimeOverrideState);
      window.removeEventListener(RUNTIME_CONFIG_CHANGED_EVENT, refreshRuntimeOverrideState);
    };
  }, []);

  const toggleTheme = () => {
    setDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
      return next;
    });
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-lg animate-brutal-in">
        <div className="container flex items-center justify-between h-16">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-sm group-hover:shadow-violet-300/50 group-hover:scale-105 transition-all duration-200">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <span className="text-base font-bold text-foreground">CarFinder</span>
            <span className="text-base font-bold bg-gradient-to-r from-violet-600 to-indigo-500 bg-clip-text text-transparent">
              Pro
            </span>
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
              onClick={() => navigate("/preferiti")}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/profilo")}
                  className="rounded-xl h-9 px-3 gap-1.5 hover:bg-muted text-xs"
                  title={user.email || "Profilo"}
                >
                  <CircleUser className="h-4 w-4" />
                  <span className="hidden sm:inline">Profilo</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={signOut}
                  className="rounded-xl h-9 w-9 hover:bg-muted"
                  title="Esci"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAuthOpen(true)}
                className="rounded-xl h-9 w-9 hover:bg-muted"
                title="Accedi"
              >
                <User className="h-4 w-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-xl h-9 w-9 hover:bg-muted"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {runtimeOverrideText && (
        <div className="border-b border-amber-300/70 bg-amber-50/85 text-amber-900">
          <div className="container h-8 flex items-center justify-between gap-3">
            <p className="text-[11px] flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {runtimeOverrideText}
            </p>
            <button
              onClick={clearRuntimeOverrides}
              className="text-[11px] font-semibold hover:underline"
              type="button"
            >
              Rimuovi override
            </button>
          </div>
        </div>
      )}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <AISearchDialog open={aiOpen} onClose={() => setAiOpen(false)} />
    </>
  );
};

export default Header;
