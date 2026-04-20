import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, Bookmark } from "lucide-react";

interface Props {
  open: boolean;
  defaultName: string;
  onSave: (name: string, alertEnabled: boolean) => void;
  onClose: () => void;
}

const SaveSearchDialog = ({ open, defaultName, onSave, onClose }: Props) => {
  const [name, setName] = useState(defaultName);
  const [alertEnabled, setAlertEnabled] = useState(false);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {return;}
    onSave(trimmed, alertEnabled);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5 text-violet-500" />
            Salva ricerca
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="search-name" className="text-sm text-muted-foreground">
              Nome per questa ricerca
            </Label>
            <Input
              id="search-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {handleSave();}
              }}
              autoFocus
              className="rounded-xl"
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3 bg-muted/40">
            <div className="flex items-center gap-2.5">
              <Bell className={`h-4 w-4 ${alertEnabled ? "text-violet-500" : "text-muted-foreground"}`} />
              <div>
                <p className="text-sm font-medium leading-none">Attiva alert prezzi</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Notifica quando escono nuovi annunci
                </p>
              </div>
            </div>
            <Switch
              checked={alertEnabled}
              onCheckedChange={setAlertEnabled}
              aria-label="Attiva alert prezzi"
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Annulla
          </Button>
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
