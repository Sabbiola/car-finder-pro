import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import SearchResults from "./pages/SearchResults";
import CarDetail from "./pages/CarDetail";
import Preferiti from "./pages/Preferiti";
import Confronta from "./pages/Confronta";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import { CompareProvider } from "./hooks/useCompare";
import { AuthProvider } from "./contexts/AuthContext";
import CompareBar from "./components/CompareBar";
import ErrorBoundary from "./components/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    },
    mutations: {
      retry: 0,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CompareProvider>
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/risultati" element={<SearchResults />} />
                  <Route path="/auto/:id" element={<CarDetail />} />
                  <Route path="/preferiti" element={<Preferiti />} />
                  <Route path="/confronta" element={<Confronta />} />
                  <Route path="/profilo" element={<Profile />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </ErrorBoundary>
              <CompareBar />
            </CompareProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
