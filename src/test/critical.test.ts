import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

// ─────────────────────────────────────────────────────────
// MOCK SUPABASE for integration-like tests (no real network)
// ─────────────────────────────────────────────────────────
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

// ═══════════════════════════════════════════════════════
// TEST 3 – SANITIZE PHONE (Search robustness)
// The function sanitizePhone in MyAppointments.tsx and
// the public booking flow all use: val.replace(/\D/g, "")
// ──────────────────────────────────────────────────────
describe("Phone Sanitization (Search Robustness)", () => {
  const sanitize = (val: string) => val.replace(/\D/g, "");

  it("removes parentheses, spaces, and hyphens", () => {
    expect(sanitize("(14) 9999-8888")).toBe("1499998888");
  });

  it("handles digits-only input", () => {
    expect(sanitize("1499998888")).toBe("1499998888");
  });

  it("handles leading/trailing spaces", () => {
    expect(sanitize(" 14 9999 8888 ")).toBe("1499998888");
  });

  it("returns same result for all three formats", () => {
    const a = sanitize("(14) 9999-8888");
    const b = sanitize("1499998888");
    const c = sanitize(" 14 9999 8888 ");
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it("handles empty string", () => {
    expect(sanitize("")).toBe("");
  });

  it("handles only special characters", () => {
    expect(sanitize("( ) - ")).toBe("");
  });

  it("is validated for < 10 digits", () => {
    expect(sanitize("12345").length).toBeLessThan(10);
    expect(sanitize("55149685").length).toBeLessThan(10);
    expect(sanitize("551496850047").length).toBeGreaterThanOrEqual(10);
  });
});

// ═══════════════════════════════════════════════════════
// TEST 1 (partial) – WEBHOOK AMOUNT TOLERANCE
// The tolerance logic from infinitepay-webhook is tested
// here as pure logic without network calls.
// ═══════════════════════════════════════════════════════
describe("Webhook Payment Validation Logic", () => {
  const TOLERANCE = 0.02;

  /**
   * Mirrors the InfinitePay webhook partial payment check:
   * - If has_signal && signal_value > 0:
   *     amountReceived >= signalValue - TOLERANCE → confirmed
   *     else → partial_insufficient
   */
  const checkSignalPayment = (
    amountReceived: number,
    signalValue: number,
    hasSignal: boolean,
  ): { ok: boolean; status: string } => {
    if (hasSignal && signalValue > 0) {
      if (amountReceived < signalValue - TOLERANCE) {
        return { ok: false, status: "partial_insufficient" };
      }
      return { ok: true, status: "confirmed" };
    }
    return { ok: true, status: "confirmed_no_validation" };
  };

  it("confirms when amount received matches signal exactly", () => {
    const result = checkSignalPayment(50, 50, true);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("confirmed");
  });

  it("confirms when amount received is 1 cent below signal (tolerance)", () => {
    const result = checkSignalPayment(49.99, 50, true);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("confirmed");
  });

  it("REJECTS when amount is 0.01 BELOW tolerance threshold", () => {
    // signalValue=50, TOLERANCE=0.02 → min=49.98
    // amountReceived=49.97 → 49.97 < 49.98 → REJECTED
    const result = checkSignalPayment(49.97, 50, true);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("partial_insufficient");
  });

  it("confirms when amount slightly exceeds signal", () => {
    const result = checkSignalPayment(51, 50, true);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("confirmed");
  });

  it("rejects when amount is significantly below signal", () => {
    const result = checkSignalPayment(10, 50, true);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("partial_insufficient");
  });

  it("rejects zero amount for signal payment", () => {
    const result = checkSignalPayment(0, 50, true);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("partial_insufficient");
  });

  it("skips validation if no signal is configured", () => {
    const result = checkSignalPayment(10, 0, false);
    expect(result.ok).toBe(true);
    expect(result.status).toBe("confirmed_no_validation");
  });

  // Full-price validation (no signal)
  const checkFullPayment = (
    amountReceived: number,
    totalPrice: number,
  ): { ok: boolean; status: string; reason?: string } => {
    const diff = Math.abs(amountReceived - totalPrice);
    if (diff <= TOLERANCE) {
      return { ok: true, status: "confirmed" };
    }
    return {
      ok: false,
      status: "amount_mismatch",
      reason: `Expected ~${totalPrice}, received ${amountReceived}`,
    };
  };

  it("rejects tiny underpayment for full-price check (no signal)", () => {
    const result = checkFullPayment(49.97, 50);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("amount_mismatch");
  });

  it("accepts exact full price", () => {
    const result = checkFullPayment(50, 50);
    expect(result.ok).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// TEST 2 – SLOT CONFLICT LOGIC (Pessimistic Validation)
// The overlap checker from PublicBooking.tsx:
//   slotStart < aEnd && slotEnd > aStart
// ──────────────────────────────────────────────────────
describe("Slot Conflict Logic (Double-Booking Prevention)", () => {
  const hasConflict = (
    slotStart: Date,
    slotDuration: number,
    existingAppts: Array<{ start: Date; duration: number }>,
  ): boolean => {
    const BUFFER = 10; // minutes
    const slotEnd = new Date(slotStart.getTime() + (slotDuration + BUFFER) * 60000);
    return existingAppts.some((appt) => {
      const aEnd = new Date(appt.start.getTime() + appt.duration * 60000);
      return slotEnd > appt.start && slotStart < aEnd;
    });
  };

  const base = new Date("2026-04-05T09:00:00-03:00");

  it("no conflict when slot is free", () => {
    const conflict = hasConflict(base, 30, []);
    expect(conflict).toBe(false);
  });

  it("detects conflict when existing appt overlaps", () => {
    // Existing: 09:00 - 09:30 + 10min buffer = 09:40
    const conflict = hasConflict(base, 30, [
      { start: base, duration: 30 },
    ]);
    expect(conflict).toBe(true);
  });

  it("detects partial overlap at slot start", () => {
    const existingStart = new Date(base.getTime() - 20 * 60000); // 08:40
    const conflict = hasConflict(base, 30, [
      { start: existingStart, duration: 30 }, // ends 09:10
    ]);
    expect(conflict).toBe(true);
  });

  it("detects partial overlap at slot end", () => {
    const existingStart = new Date(base.getTime() + 25 * 60000); // 09:25
    const conflict = hasConflict(base, 30, [
      { start: existingStart, duration: 30 },
    ]);
    expect(conflict).toBe(true);
  });

  it("allows slot after existing appt with buffer gap", () => {
    // Existing: 09:00-09:30, buffer=10min → free after 09:40
    // New slot: 09:40 → no overlap
    const freeSlot = new Date(base.getTime() + 40 * 60000);
    const conflict = hasConflict(freeSlot, 30, [
      { start: base, duration: 30 },
    ]);
    expect(conflict).toBe(false);
  });

  it("simultaneous booking fails (same exact time)", () => {
    const slot1 = hasConflict(base, 30, []);
    expect(slot1).toBe(false); // first succeeds
    const slot2 = hasConflict(base, 30, [
      { start: base, duration: 30 },
    ]);
    expect(slot2).toBe(true); // second is rejected
  });
});

// ═══════════════════════════════════════════════════════
// TEST 4 – ONBOARDING SEED HOURS
// Verifies the SEED_HOURS array produces 6 active days.
// ──────────────────────────────────────────────────────
describe("Onboarding Business Hours Seeding", () => {
  const SEED_HOURS = [
    { day_of_week: 0, open_time: "09:00", close_time: "09:00", is_closed: true },
    { day_of_week: 1, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 2, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 3, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 4, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 5, open_time: "09:00", close_time: "18:00", is_closed: false },
    { day_of_week: 6, open_time: "09:00", close_time: "14:00", is_closed: false },
  ];

  it("seeds exactly 7 days (full week)", () => {
    expect(SEED_HOURS.length).toBe(7);
  });

  it("has 6 active days (1 closed)", () => {
    const active = SEED_HOURS.filter((h) => !h.is_closed);
    expect(active.length).toBe(6);
  });

  it("closes on Sunday (day 0)", () => {
    const sunday = SEED_HOURS.find((h) => h.day_of_week === 0);
    expect(sunday).toBeDefined();
    expect(sunday?.is_closed).toBe(true);
  });

  it("active days Mon-Fri end at 18:00", () => {
    const weekdays = SEED_HOURS.filter(
      (h) => h.day_of_week >= 1 && h.day_of_week <= 5 && !h.is_closed,
    );
    expect(weekdays.length).toBe(5);
    weekdays.forEach((h) => expect(h.close_time).toBe("18:00"));
    weekdays.forEach((h) => expect(h.open_time).toBe("09:00"));
  });

  it("Saturday ends at 14:00", () => {
    const saturday = SEED_HOURS.find((h) => h.day_of_week === 6);
    expect(saturday).toBeDefined();
    expect(saturday?.close_time).toBe("14:00");
    expect(saturday?.is_closed).toBe(false);
  });

  it("all active days have open < close", () => {
    SEED_HOURS.filter((h) => !h.is_closed).forEach((h) => {
      expect(h.open_time < h.close_time).toBe(true);
    });
  });
});

// ══════════════════════════════════════════════════════
// BONUS: Message Template Tests
// ────────────────────────────────────────────────────
import {
  fillMessageTemplate,
  buildWhatsAppLink,
  DEFAULT_CONFIRMATION_TEMPLATE,
  AVAILABLE_VARIABLES,
} from "@/lib/messageTemplate";

describe("Message Template Engine", () => {
  const sampleCtx = {
    cliente: "João Silva",
    servico: "Corte Masculino",
    data: "15/04/2026",
    horario: "14:30",
    barbeiro: "Roberto",
    preco: 50,
    valor_falta: 30,
  };

  it("replaces all variables in default template", () => {
    const result = fillMessageTemplate(DEFAULT_CONFIRMATION_TEMPLATE, sampleCtx);
    expect(result).toContain("João Silva");
    expect(result).toContain("Corte Masculino");
    expect(result).toContain("15/04/2026");
    expect(result).toContain("14:30");
    expect(result).not.toContain("{{");
  });

  it("formats price in BRL format", () => {
    const result = fillMessageTemplate("Valor: {{preco}}", sampleCtx);
    expect(result).toBe("Valor: R$ 50,00");
  });

  it("formats valor_falta in BRL format", () => {
    const result = fillMessageTemplate("Falta: {{valor_falta}}", sampleCtx);
    expect(result).toBe("Falta: R$ 30,00");
  });

  it("defaults barbeiro to 'Geral' when not provided", () => {
    const ctx = { ...sampleCtx };
    delete (ctx as any).barbeiro;
    const result = fillMessageTemplate("Barbeiro: {{barbeiro}}", ctx);
    expect(result).toBe("Barbeiro: Geral");
  });

  it("builds valid WhatsApp link with encoded message", () => {
    const link = buildWhatsAppLink("Olá {{cliente}}", { ...sampleCtx, telefone: "551496850047" });
    expect(link.startsWith("https://wa.me/551496850047?text=")).toBe(true);
    const encoded = link.split("text=")[1];
    expect(decodeURIComponent(encoded)).toContain("João Silva");
  });

  it("handles ALL available variables", () => {
    const fullCtx = { ...sampleCtx, telefone: "551496850047" };
    const allKeys = AVAILABLE_VARIABLES.filter(
      (v) => v.key !== "{{telefone}}" && v.key !== "{{mensagem}}"
    ).map((v) => v.key);
    const template = allKeys.join(" ");
    const result = fillMessageTemplate(template, fullCtx);
    allKeys.forEach((key) => {
      expect(result).not.toContain(key);
    });
  });
});

// ═══════════════════════════════════════════════════════
// BONUS: Timezone Helper Tests
// ──────────────────────────────────────────────────────
import { toBRT, nowBRT, TIMEZONE, BRT_OFFSET } from "@/lib/timezone";

describe("Timezone Helper", () => {
  it("uses Brasilia timezone offset", () => {
    expect(BRT_OFFSET).toBe(-3);
    expect(TIMEZONE).toBe("America/Sao_Paulo");
  });

  it("toBRT shifts UTC date by 3 hours backward", () => {
    // UTC noon = 15:00 BRT (12 - 3)
    const result = toBRT("2026-04-05T15:00:00Z");
    expect(result.getUTCHours()).toBe(12);
  });

  it("nowBRT returns a valid Date object", () => {
    const result = nowBRT();
    expect(result instanceof Date).toBe(true);
  });
});
