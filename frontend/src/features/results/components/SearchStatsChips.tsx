interface SearchStats {
  minPrice: number;
  avgPrice: number;
  maxPrice: number;
  avgKm: number | null;
  topFuel: string | null;
}

interface SearchStatsChipsProps {
  stats: SearchStats | null;
  scraped: boolean;
}

const SearchStatsChips = ({ stats, scraped }: SearchStatsChipsProps) => {
  if (!stats || !scraped) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2 animate-brutal-in">
      {[
        { label: "Min", value: `EUR ${stats.minPrice.toLocaleString("it-IT")}` },
        { label: "Media", value: `EUR ${stats.avgPrice.toLocaleString("it-IT")}` },
        { label: "Max", value: `EUR ${stats.maxPrice.toLocaleString("it-IT")}` },
        ...(stats.avgKm ? [{ label: "Km medi", value: stats.avgKm.toLocaleString("it-IT") }] : []),
        ...(stats.topFuel ? [{ label: "Carburante", value: stats.topFuel }] : []),
      ].map(({ label, value }) => (
        <span
          key={label}
          className="text-xs bg-muted px-3 py-1.5 rounded-full text-muted-foreground"
        >
          {label} <strong className="text-foreground">{value}</strong>
        </span>
      ))}
    </div>
  );
};

export default SearchStatsChips;
