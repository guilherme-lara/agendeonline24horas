import { describe, it, expect } from "vitest";
import { startOfDay, isSameDay, subDays } from "date-fns";

/**
 * Simula a lógica de cálculo de KPIs do Dashboard.tsx
 * para garantir que serviços + produtos = total da order.
 */
describe("Dashboard KPI Calculations", () => {
  const mockOrders = [
    {
      id: "1",
      total: 150,
      created_at: new Date().toISOString(),
      items: [
        { name: "Corte", price: 50, qty: 1, type: "service" },
        { name: "Pomada", price: 100, qty: 1, type: "product" },
      ],
      payment_method: "cash",
    },
    {
      id: "2",
      total: 80,
      created_at: new Date().toISOString(),
      items: [
        { name: "Barba", price: 40, qty: 2, type: "service" },
      ],
      payment_method: "pix",
    },
  ];

  it("should sum services and products to match order totals", () => {
    const today = startOfDay(new Date());
    let todayRevServices = 0;
    let todayRevProducts = 0;

    mockOrders.forEach((order) => {
      const orderDay = startOfDay(new Date(order.created_at));
      if (isSameDay(orderDay, today)) {
        (order.items || []).forEach((item) => {
          const itemTotal = Number(item.price) * Number(item.qty);
          if (item.type === "product") todayRevProducts += itemTotal;
          else todayRevServices += itemTotal;
        });
      }
    });

    const todayRevTotal = todayRevServices + todayRevProducts;
    // Total from items: 50 + 100 + (40*2) = 230
    expect(todayRevTotal).toBe(230);
    expect(todayRevServices).toBe(130); // 50 + 80
    expect(todayRevProducts).toBe(100);
  });

  it("should calculate ticket medio correctly", () => {
    const closedCount = mockOrders.length;
    const totalRev = 230;
    const ticketMedio = closedCount > 0 ? totalRev / closedCount : 0;
    expect(ticketMedio).toBe(115);
  });
});
