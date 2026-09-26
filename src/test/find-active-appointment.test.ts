import { describe, expect, it } from "vitest";
import { findActiveAppointmentForCustomer, phonesMatch } from "@/lib/findActiveAppointment";

describe("findActiveAppointmentForCustomer", () => {
  const customer = { id: "cust-1", phone: "11988887777" };

  it("prioriza o próximo agendamento ativo do cliente", () => {
    const now = Date.now();
    const appointments = [
      {
        id: "past",
        customer_id: "cust-1",
        client_phone: "11988887777",
        status: "confirmed",
        scheduled_at: new Date(now - 60_000).toISOString(),
      },
      {
        id: "next",
        customer_id: "cust-1",
        client_phone: "11988887777",
        status: "confirmed",
        scheduled_at: new Date(now + 60_000).toISOString(),
      },
      {
        id: "done",
        customer_id: "cust-1",
        client_phone: "11988887777",
        status: "completed",
        scheduled_at: new Date(now + 120_000).toISOString(),
      },
    ];

    const found = findActiveAppointmentForCustomer(appointments, customer);
    expect(found?.id).toBe("next");
  });

  it("casa cliente pelo telefone quando não há customer_id", () => {
    const appointments = [
      {
        id: "phone-match",
        customer_id: null,
        client_phone: "(11) 98888-7777",
        status: "pending",
        scheduled_at: new Date(Date.now() + 60_000).toISOString(),
      },
    ];

    const found = findActiveAppointmentForCustomer(appointments, customer);
    expect(found?.id).toBe("phone-match");
    expect(phonesMatch("(11) 98888-7777", "11988887777")).toBe(true);
  });
});
