import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CompareProvider } from "./hooks/CompareProvider";
import { AuthProvider } from "./contexts/AuthContext";
import CompareBar from "./components/CompareBar";
import ErrorBoundary from "./components/ErrorBoundary";

const Index = lazy(() => import("./pages/Index"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const CarDetail = lazy(() => import("./pages/CarDetail"));
const Preferiti = lazy(() => import("./pages/Preferiti"));
const Confronta = lazy(() => import("./pages/Confronta"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Profile = lazy(() => import("./pages/Profile"));

const RouteFallback = () => (
  <div className="container py-16 text-center text-sm text-muted-foreground">Caricamento pagina...</div>
);

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
  <HelmetProvider>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <CompareProvider>
                <ErrorBoundary>
                  <Suspense fallback={<RouteFallback />}>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/risultati" element={<SearchResults />} />
                      <Route path="/auto/:id" element={<CarDetail />} />
                      <Route path="/preferiti" element={<Preferiti />} />
                      <Route path="/confronta" element={<Confronta />} />
                      <Route path="/profilo" element={<Profile />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
                <CompareBar />
              </CompareProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </HelmetProvider>
);

export default App;
