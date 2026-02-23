import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const AuthModal = ({ open, onClose }: Props) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const fn = mode === 'login' ? signInWithEmail : signUpWithEmail;
    const { error } = await fn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: mode === 'login' ? 'Accesso effettuato' : 'Account creato',
        description: mode === 'register' ? 'Controlla la tua email per confermare' : undefined,
      });
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'login' ? 'Accedi' : 'Registrati'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@esempio.it" required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required minLength={6}
            />
          </div>

          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Accedi' : 'Registrati'}
          </Button>
        </form>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase text-muted-foreground bg-background px-2 w-fit mx-auto">oppure</div>
        </div>

        <Button variant="outline" className="w-full gap-2" onClick={signInWithGoogle}>
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continua con Google
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {mode === 'login' ? "Non hai un account? " : "Hai già un account? "}
          <button
            type="button"
            onClick={() => setMode(m => m === 'login' ? 'register' : 'login')}
            className="text-violet-600 hover:underline font-medium"
          >
            {mode === 'login' ? 'Registrati' : 'Accedi'}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
