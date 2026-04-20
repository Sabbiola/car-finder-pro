import { AlertTriangle } from "lucide-react";

import { sourceLabels } from "@/lib/mock-data";

function formatSourceList(sourceIds: string[]): string {
  return sourceIds.map((sourceId) => sourceLabels[sourceId] ?? sourceId).join(", ");
}

interface SearchModeProviderNoticeProps {
  isFastApiMode: boolean;
  modeUnsupportedVisibleSources: string[];
}

interface SearchStreamDiagnosticsProps {
  streamProviderStatus: Record<string, string>;
  streamProviderCount: Record<string, number>;
  streamErrors: string[];
}

export const SearchModeProviderNotice = ({
  isFastApiMode,
  modeUnsupportedVisibleSources,
}: SearchModeProviderNoticeProps) => {
  if (!(isFastApiMode && modeUnsupportedVisibleSources.length > 0)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 px-3 py-2 text-amber-900">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" />
        Fonti non disponibili in fastapi mode
      </p>
      <p className="mt-1 text-xs">
        Queste fonti non sono ancora migrate e vengono escluse dalla ricerca:{" "}
        {formatSourceList(modeUnsupportedVisibleSources)}.
      </p>
    </div>
  );
};

export const SearchStreamDiagnostics = ({
  streamProviderStatus,
  streamProviderCount,
  streamErrors,
}: SearchStreamDiagnosticsProps) => {
  if (!(Object.keys(streamProviderStatus).length > 0 || streamErrors.length > 0)) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {Object.entries(streamProviderStatus).map(([provider, status]) => (
          <span key={provider} className="text-[11px] px-2 py-1 rounded-full bg-muted text-foreground">
            {provider}: {status}
            {typeof streamProviderCount[provider] === "number"
              ? ` (${streamProviderCount[provider]})`
              : ""}
          </span>
        ))}
      </div>
      {streamErrors.length > 0 && (
        <p className="text-xs text-destructive">
          Errori runtime provider: {streamErrors.join(" | ")}
        </p>
      )}
    </div>
  );
};

const SearchProviderDiagnostics = ({
  isFastApiMode,
  modeUnsupportedVisibleSources,
  streamProviderStatus,
  streamProviderCount,
  streamErrors,
}: SearchModeProviderNoticeProps & SearchStreamDiagnosticsProps) => {
  return (
    <>
      <SearchModeProviderNotice
        isFastApiMode={isFastApiMode}
        modeUnsupportedVisibleSources={modeUnsupportedVisibleSources}
      />
      <SearchStreamDiagnostics
        streamProviderStatus={streamProviderStatus}
        streamProviderCount={streamProviderCount}
        streamErrors={streamErrors}
      />
    </>
  );
};

export default SearchProviderDiagnostics;
