import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { DashboardSummary } from "@/components/dashboard/dashboard-summary";

afterEach(cleanup);

describe("Dashboard sales reconciliation", () => {
  it("explains order count separately from the unique buyers without altering either metric", async () => {
    render(<DashboardSummary
      totals={{ revenueCents: 123400, sales: 5, registrations: 10, convertedLeads: 3, conversionRate: 30 }}
      comparison={{ previousRevenueCents: 0, previousSales: 0, revenueChangePct: null }}
      salesBreakdown={{ ordersWithoutPeriodAccess: 1, repeatBuyerOrders: 1 }}
    />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    fireEvent.focus(screen.getByRole("button", { name: "Sobre as vendas" }));
    const explanation = await screen.findByRole("tooltip");
    expect(explanation).toHaveTextContent("5 pedidos do curso no período. O funil mostra 3 compradores");
    expect(explanation).toHaveTextContent("1 pedido sem acesso identificado no recorte");
    expect(explanation).toHaveTextContent("1 pedido adicional de comprador já contado no funil");
  });
});
