import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadsSummaryAside } from "@/components/leads-map/leads-summary-aside";

const AGG = {
  pins: [],
  total: 1247,
  geoCount: 1180,
  ungeoCount: 67,
  topCountries: [
    { code: "BR", count: 800 },
    { code: "US", count: 200 }
  ],
  topCities: [
    { city: "São Paulo", count: 312 },
    { city: "Rio de Janeiro", count: 180 }
  ]
};

describe("LeadsSummaryAside", () => {
  it("renders total + geo + ungeo", () => {
    render(<LeadsSummaryAside agg={AGG} />);
    expect(screen.getByText("1.247")).toBeInTheDocument();
    expect(screen.getByText(/1\.180/)).toBeInTheDocument();
    expect(screen.getByText(/67/)).toBeInTheDocument();
  });
  it("renders top countries", () => {
    render(<LeadsSummaryAside agg={AGG} />);
    expect(screen.getByText("BR")).toBeInTheDocument();
    expect(screen.getByText("800")).toBeInTheDocument();
    expect(screen.getByText("US")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
  });
  it("renders top cities", () => {
    render(<LeadsSummaryAside agg={AGG} />);
    expect(screen.getByText("São Paulo")).toBeInTheDocument();
    expect(screen.getByText("312")).toBeInTheDocument();
    expect(screen.getByText("Rio de Janeiro")).toBeInTheDocument();
  });
  it("hides Top Países section when no countries", () => {
    render(<LeadsSummaryAside agg={{ ...AGG, topCountries: [], topCities: [] }} />);
    expect(screen.queryByText(/Top Países/i)).toBeNull();
    expect(screen.queryByText(/Top Cidades/i)).toBeNull();
  });
});
