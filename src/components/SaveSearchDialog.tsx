import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Bookmark } from 'lucide-react';

interface Props {
  open: boolean;
  defaultName: string;
  onSave: (name: string) => void;
  onClose: () => void;
}

const SaveSearchDialog = ({ open, defaultName, onSave, onClose }: Props) => {
  const [name, setName] = useState(defaultName);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-violet-500" />
            Salva ricerca
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label htmlFor="search-name" className="text-sm text-muted-foreground">
            Nome per questa ricerca
          </Label>
          <Input
            id="search-name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            autoFocus
            className="rounded-xl"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Annulla</Button>
          <Button
            onClick={handleSave}
            disabled={!name.trim()}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-500 text-white border-0"
          >
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveSearchDialog;
