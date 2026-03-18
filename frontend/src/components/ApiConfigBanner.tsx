import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRuntimeConfig,
  setRuntimeApiBaseUrl,
  setRuntimeBackendMode,
  type BackendMode,
} from "@/lib/runtimeConfig";

const ApiConfigBanner = () => {
  const initial = getRuntimeConfig();
  const [mode, setMode] = useState<BackendMode>(initial.backendMode);
  const [baseUrl, setBaseUrl] = useState(initial.apiBaseUrl || "");
  const [saved, setSaved] = useState(false);

  if (!import.meta.env.DEV) {return null;}

  const save = () => {
    setRuntimeBackendMode(mode);
    setRuntimeApiBaseUrl(baseUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 flex flex-col md:flex-row gap-2 md:items-center">
      <div className="text-xs text-muted-foreground md:min-w-[150px]">Backend runtime config</div>
      <Select value={mode} onValueChange={(v) => setMode(v as BackendMode)}>
        <SelectTrigger className="w-full md:w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="supabase">Supabase</SelectItem>
          <SelectItem value="fastapi">FastAPI</SelectItem>
        </SelectContent>
      </Select>
      <Input
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder="http://localhost:8000"
        className="w-full md:flex-1"
      />
      <Button onClick={save} size="sm" className="md:w-auto">
        {saved ? "Salvato" : "Salva"}
      </Button>
    </div>
  );
};

export default ApiConfigBanner;

