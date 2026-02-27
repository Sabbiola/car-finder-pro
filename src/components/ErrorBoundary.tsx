import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to console in development; swap for Sentry/DataDog in production
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-6 animate-brutal-up">
            <div className="flex justify-center">
              <div className="p-4 rounded-2xl bg-destructive/10">
                <AlertTriangle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-extrabold uppercase tracking-wide">
                Qualcosa è andato storto
              </h1>
              <p className="text-sm text-muted-foreground">
                Si è verificato un errore imprevisto. Prova a ricaricare la pagina.
              </p>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Dettagli errore (dev only)
                  </summary>
                  <pre className="mt-2 p-3 bg-muted rounded-xl text-[10px] overflow-auto max-h-40">
                    {this.state.error.message}
                    {'\n'}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="gap-2 rounded-xl"
              >
                <RefreshCw className="h-4 w-4" />
                Riprova
              </Button>
              <Button
                onClick={() => { window.location.href = '/'; }}
                className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-500 text-white border-0"
              >
                Torna alla home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
