import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WhyThisCarPanel from "@/features/results/components/WhyThisCarPanel";

describe("WhyThisCarPanel", () => {
  it("renders deal and risk insights", () => {
    render(
      <WhyThisCarPanel
        dealSummary={{
          headline: "Affare interessante",
          summary: "Sotto benchmark locale.",
          top_reasons: ["9% sotto benchmark", "online da 24 giorni"],
          benchmark_price: 27500,
          days_on_market: 24,
          price_change_count: 2,
          confidence: "medium",
        }}
        trustSummary={{
          risk_level: "medium",
          flags: ["poche foto"],
        }}
      />,
    );

    expect(screen.getByText("Affare interessante")).toBeInTheDocument();
    expect(screen.getByText("Top reasons")).toBeInTheDocument();
    expect(screen.getByText("online da 24 giorni")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("shows fallback state when no analysis is available", () => {
    render(<WhyThisCarPanel />);

    expect(screen.getByText("Analisi non disponibile")).toBeInTheDocument();
  });
});
