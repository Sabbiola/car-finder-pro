import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CarListing } from "@/lib/api/listings";

interface PriceHistoryChartProps {
  history: Array<{ price: number; recorded_at: string }>;
}

export function PriceHistoryChart({ history }: PriceHistoryChartProps) {
  if (history.length < 2) { return null; }

  return (
    <div className="space-y-4 animate-brutal-up" style={{ animationDelay: "195ms" }}>
      <div>
        <h2 className="text-lg font-bold">Storico prezzi</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Andamento del prezzo nel tempo</p>
      </div>
      <div className="rounded-2xl border border-border/60 p-4 bg-card shadow-sm">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={history} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="recorded_at"
              tickFormatter={(value) =>
                new Date(String(value)).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
              }
              tick={{ fontSize: 10, fontFamily: "Inter" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fontFamily: "Inter" }}
              tickFormatter={(value) => `EUR ${(value / 1000).toFixed(0)}k`}
              domain={["auto", "auto"]}
              width={52}
            />
            <Tooltip
              formatter={(value: number) => [`EUR ${value.toLocaleString("it-IT")}`, "Prezzo"]}
              labelFormatter={(value) =>
                new Date(String(value)).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
              }
            />
            <Line type="monotone" dataKey="price" stroke="hsl(262 83% 60%)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface PriceComparisonChartProps {
  prices: CarListing[];
  currentId: string;
  brand: string;
  model: string;
}

interface ChartDataPoint {
  name: string;
  price: number;
  isCurrent: boolean;
  rating: string;
}

export function PriceComparisonChart({ prices, currentId, brand, model }: PriceComparisonChartProps) {
  if (prices.length <= 1) { return null; }

  const chartData: ChartDataPoint[] = prices.map((item) => ({
    name: item.title.length > 20 ? `${item.title.slice(0, 20)}...` : item.title,
    price: item.price,
    isCurrent: item.id === currentId,
    rating: item.price_rating || "normal",
  }));

  const avgPrice = Math.round(prices.reduce((acc, item) => acc + item.price, 0) / prices.length);

  return (
    <div className="space-y-4 animate-brutal-up" style={{ animationDelay: "200ms" }}>
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold">Confronto prezzi</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {brand} {model} - Media: EUR {avgPrice.toLocaleString("it-IT")}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-border/60 p-4 bg-card shadow-sm">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fontFamily: "Inter" }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fontSize: 10, fontFamily: "Inter" }} tickFormatter={(v) => `EUR ${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: number) => [`EUR ${value.toLocaleString("it-IT")}`, "Prezzo"]} />
            <ReferenceLine
              y={avgPrice}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              label={{ value: "Media", position: "right", fontSize: 10, fontFamily: "Inter" }}
            />
            <Bar dataKey="price" radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.isCurrent
                      ? "hsl(262 83% 60%)"
                      : entry.rating === "best"
                        ? "hsl(142 76% 40%)"
                        : entry.rating === "good"
                          ? "hsl(217 91% 55%)"
                          : "hsl(var(--muted-foreground))"
                  }
                  opacity={entry.isCurrent ? 1 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
