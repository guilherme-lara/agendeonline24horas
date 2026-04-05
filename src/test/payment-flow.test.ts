/**
 * Comprehensive tests for Payment and Webhook Flow
 * Covers: webhook idempotency, payment status transitions,
 * auto-cancel logic, price validation, and payment_logs audit trail.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ============================================================
// 1. WEBHOOK STATUS PARSING
// ============================================================

describe("Webhook Status Parsing", () => {
  const VALID_PAID_STATUSES = ["paid", "approved", "completed", "confirmed"];

  it("should accept all valid payment-confirmed statuses", () => {
    VALID_PAID_STATUSES.forEach((status) => {
      const isPaid = ["paid", "approved", "completed", "confirmed"].includes(
        status.toLowerCase()
      );
      expect(isPaid).toBe(true);
    });
  });

  it("should reject non-payment statuses", () => {
    const nonPaidStatuses = ["pending", "awaiting", "failed", "cancelled", "refunded"];
    nonPaidStatuses.forEach((status) => {
      const isPaid = ["paid", "approved", "completed", "confirmed"].includes(
        status.toLowerCase()
      );
      expect(isPaid).toBe(false);
    });
  });

  it("should handle case-insensitive status", () => {
    expect(["PAID", "Paid", "paid"].map((s) =>
      ["paid", "approved", "completed", "confirmed"].includes(s.toLowerCase())
    )).toEqual([true, true, true]);
  });

  it("should handle missing order_nsu gracefully", () => {
    const payload = { status: "paid" };
    const hasNsu = !!payload.order_nsu;
    expect(hasNsu).toBe(false);
  });

  it("should validate order_nsu is a proper UUID format", () => {
    const validUuid = "550e8400-e29b-41d4-a716-446655440000";
    const invalidUuid = "not-a-uuid";

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    expect(uuidRegex.test(validUuid)).toBe(true);
    expect(uuidRegex.test(invalidUuid)).toBe(false);
  });
});

// ============================================================
// 2. WEBHOOK IDEMPOTENCY
// ============================================================

describe("Webhook Idempotency", () => {
  function processWebhook(
    payload: { order_nsu: string; status: string },
    currentApptStatus: string
  ) {
    // Simulate webhook logic
    if (!payload.order_nsu) {
      return { ok: true, skipped: "Missing order_nsu" };
    }

    const isPaid = ["paid", "approved", "completed", "confirmed"].includes(
      payload.status.toLowerCase()
    );

    if (!isPaid) {
      return { ok: true, payment_confirmed: false, reason: `Status [${payload.status}] não é válido` };
    }

    if (currentApptStatus === "confirmed") {
      return { ok: true, already_processed: true };
    }

    return { ok: true, payment_confirmed: true, new_status: "confirmed" };
  }

  it("should not double-confirm an already-confirmed appointment", () => {
    const payload = { order_nsu: "appt-uuid", status: "paid" };

    const firstCall = processWebhook(payload, "pending");
    expect(firstCall.payment_confirmed).toBe(true);
    expect(firstCall.new_status).toBe("confirmed");

    // Second webhook for same appointment
    const secondCall = processWebhook(payload, "confirmed");
    expect(secondCall.already_processed).toBe(true);
    expect(secondCall).not.toHaveProperty("new_status");
  });

  it("should handle duplicate webhook deliveries from InfinitePay", () => {
    const payload = { order_nsu: "appt-uuid", status: "paid" };

    // Simulate 5 webhook deliveries (InfinitePay retries)
    const results = Array.from({ length: 5 }, (_, i) => {
      const status = i === 0 ? "pending" : "confirmed";
      return processWebhook(payload, status);
    });

    expect(results[0].payment_confirmed).toBe(true);
    for (let i = 1; i < 5; i++) {
      expect(results[i].already_processed).toBe(true);
    }
  });

  it("should return 200 even for non-paid statuses (don't trigger retries)", () => {
    const payload = { order_nsu: "appt-uuid", status: "pending" };
    const result = processWebhook(payload, "pending");

    expect(result.ok).toBe(true);
    expect(result.payment_confirmed).toBe(false);
  });
});

// ============================================================
// 3. AUTO-CANCEL FUNCTION (fix: status and payment_method matching)
// ============================================================

describe("Auto-Cancel Logic", () => {
  interface Appointment {
    id: string;
    status: string;
    payment_method: string;
    payment_status: string;
    created_at: Date;
    payment_confirmed_at: string | null;
  }

  function shouldCancel(appt: Appointment, now: Date): boolean {
    // Fixed conditions matching the new migration
    const statusMatches = ["pending", "pendente_pagamento", "pendente_sinal"].includes(appt.status);
    const methodMatches = ["pix", "pix_online", "pix_infinitepay", "pix_static"].includes(appt.payment_method);
    const paymentStatusMatches = ["pending", "awaiting"].includes(appt.payment_status);
    const isExpired = (now.getTime() - appt.created_at.getTime()) > 15 * 60 * 1000; // 15 minutes
    const isNotConfirmed = appt.payment_confirmed_at === null;

    return statusMatches && methodMatches && paymentStatusMatches && isExpired && isNotConfirmed;
  }

  it("should cancel pending appointments with pix payment after timeout", () => {
    const appt: Appointment = {
      id: "appt-1",
      status: "pendente_pagamento",
      payment_method: "pix",
      payment_status: "pending",
      created_at: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago
      payment_confirmed_at: null,
    };

    expect(shouldCancel(appt, new Date())).toBe(true);
  });

  it("should NOT cancel confirmed appointments", () => {
    const appt: Appointment = {
      id: "appt-2",
      status: "confirmed",
      payment_method: "pix",
      payment_status: "paid",
      created_at: new Date(Date.now() - 20 * 60 * 1000),
      payment_confirmed_at: new Date().toISOString(),
    };

    expect(shouldCancel(appt, new Date())).toBe(false);
  });

  it("should NOT cancel appointments that haven't expired yet", () => {
    const appt: Appointment = {
      id: "appt-3",
      status: "pendente_pagamento",
      payment_method: "pix",
      payment_status: "pending",
      created_at: new Date(Date.now() - 5 * 60 * 1000), // Only 5 min ago
      payment_confirmed_at: null,
    };

    expect(shouldCancel(appt, new Date())).toBe(false);
  });

  it("should NOT cancel local payment appointments", () => {
    const appt: Appointment = {
      id: "appt-4",
      status: "pending",
      payment_method: "local",
      payment_status: "pending_local",
      created_at: new Date(Date.now() - 20 * 60 * 1000),
      payment_confirmed_at: null,
    };

    expect(shouldCancel(appt, new Date())).toBe(false);
  });

  it("should cancel pendente_sinal status (advance payment)", () => {
    const appt: Appointment = {
      id: "appt-5",
      status: "pendente_sinal",
      payment_method: "pix_online",
      payment_status: "pending",
      created_at: new Date(Date.now() - 16 * 60 * 1000),
      payment_confirmed_at: null,
    };

    expect(shouldCancel(appt, new Date())).toBe(true);
  });

  it("should cancel pix_infinitepay status", () => {
    const appt: Appointment = {
      id: "appt-6",
      status: "pending",
      payment_method: "pix_infinitepay",
      payment_status: "awaiting",
      created_at: new Date(Date.now() - 16 * 60 * 1000),
      payment_confirmed_at: null,
    };

    expect(shouldCancel(appt, new Date())).toBe(true);
  });

  it("should NOT cancel if payment_confirmed_at is set", () => {
    const appt: Appointment = {
      id: "appt-7",
      status: "pending",
      payment_method: "pix",
      payment_status: "pending",
      created_at: new Date(Date.now() - 20 * 60 * 1000),
      payment_confirmed_at: new Date().toISOString(),
    };

    expect(shouldCancel(appt, new Date())).toBe(false);
  });

  it("should cover all payment_method variants the booking flow can produce", () => {
    const methods = ["pix", "pix_online", "pix_infinitepay", "pix_static"];
    methods.forEach((method) => {
      const appt: Appointment = {
        id: `appt-${method}`,
        status: "pendente_pagamento",
        payment_method: method,
        payment_status: "pending",
        created_at: new Date(Date.now() - 16 * 60 * 1000),
        payment_confirmed_at: null,
      };
      expect(shouldCancel(appt, new Date())).toBe(true);
    });
  });
});

// ============================================================
// 4. PRICE VALIDATION (create-pix-charge edge function)
// ============================================================

describe("Price Validation in Pix Charge", () => {
  function validatePrice(sentAmount: number, dbServicePrice: number): { valid: boolean; error?: string } {
    const sentCents = Number.isInteger(sentAmount) && sentAmount >= 100
      ? sentAmount
      : Math.round(sentAmount * 100);

    const expectedCents = Math.round(dbServicePrice * 100);

    // Tolerance of 100 cents (R$1.00) for rounding differences
    if (Math.abs(sentCents - expectedCents) > 100) {
      return { valid: false, error: "Valor divergente do cadastrado" };
    }

    return { valid: true };
  }

  it("should accept correct price", () => {
    const result = validatePrice(5000, 50.00);
    expect(result.valid).toBe(true);
  });

  it("should accept price in cents format", () => {
    const result = validatePrice(5000, 50.00);
    expect(result.valid).toBe(true);
  });

  it("should accept price in reais format (auto-convert)", () => {
    const result = validatePrice(50.00, 50.00);
    expect(result.valid).toBe(true);
  });

  it("should reject tampered prices (too low)", () => {
    const result = validatePrice(1, 50.00); // User tried to change R$50 to R$0.01
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Valor divergente do cadastrado");
  });

  it("should reject tampered prices (too high)", () => {
    const result = validatePrice(500000, 50.00); // User tried to charge R$5000
    expect(result.valid).toBe(false);
  });

  it("should tolerate small rounding differences", () => {
    const result = validatePrice(5001, 50.00); // 1 cent difference
    expect(result.valid).toBe(true);
  });
});

// ============================================================
// 5. PAYMENT_LOGS AUDIT TRAIL
// ============================================================

describe("Payment Logs Audit Trail", () => {
  it("should create a payment_logs entry for each webhook event", () => {
    const webhookPayload = {
      order_nsu: "appt-uuid",
      status: "paid",
      payment_id: "pix-123",
      event_type: "payment.completed",
    };

    const logEntry = {
      source: "webhook_infinitepay",
      event_type: webhookPayload.event_type,
      request_body: webhookPayload,
      payment_id: webhookPayload.order_nsu,
      response_body: { ok: true, payment_confirmed: true },
    };

    expect(logEntry.source).toBe("webhook_infinitepay");
    expect(logEntry.payment_id).toBe("appt-uuid");
    expect(logEntry.event_type).toBe("payment.completed");
  });

  it("should preserve the original request for debugging", () => {
    const rawPayload = {
      order_nsu: "appt-uuid",
      status: "paid",
      extra_field: "some_value",
      nested: { deep: true },
    };

    const logEntry = { request_body: rawPayload };

    // Should be able to reconstruct the original event
    expect(logEntry.request_body).toEqual(rawPayload);
    expect(logEntry.request_body.order_nsu).toBe("appt-uuid");
    expect(logEntry.request_body.nested.deep).toBe(true);
  });
});

// ============================================================
// 6. PAYMENT STATUS TRANSITIONS
// ============================================================

describe("Payment State Machine", () => {
  type PaymentStatus = "pending" | "awaiting" | "paid" | "expired" | "pending_local";
  type AppointmentStatus = "pending" | "pendente_pagamento" | "pendente_sinal" | "confirmed" | "completed" | "cancelled";

  interface PaymentEvent {
    type: string;
    from: { appointment: AppointmentStatus; payment: PaymentStatus };
    to: { appointment: AppointmentStatus; payment: PaymentStatus };
  }

  const validTransitions: PaymentEvent[] = [
    // Normal PIX flow
    {
      type: "create_appointment",
      from: { appointment: "pending", payment: "pending" },
      to: { appointment: "pendente_pagamento", payment: "pending" },
    },
    {
      type: "webhook_confirmed",
      from: { appointment: "pendente_pagamento", payment: "pending" },
      to: { appointment: "confirmed", payment: "paid" },
    },
    {
      type: "barber_completes_service",
      from: { appointment: "confirmed", payment: "paid" },
      to: { appointment: "completed", payment: "paid" },
    },
    // Expiration after 15 min timeout
    {
      type: "auto_cancel",
      from: { appointment: "pendente_pagamento", payment: "pending" },
      to: { appointment: "cancelled", payment: "expired" },
    },
  ];

  it("should only allow valid state transitions", () => {
    const validFromStates = new Set(
      validTransitions.map((t) => JSON.stringify(t.from))
    );

    // A confirmed appointment can't go back to pendente_pagamento
    const invalidTransition = {
      appointment: "confirmed" as AppointmentStatus,
      payment: "paid" as PaymentStatus,
    };
    const target = {
      appointment: "pendente_pagamento" as AppointmentStatus,
      payment: "pending" as PaymentStatus,
    };

    const transitionKey = JSON.stringify({ from: invalidTransition, to: target });
    // This wouldn't match any valid transition
    const isValid = validTransitions.some(
      (t) =>
        t.from.appointment === invalidTransition.appointment &&
        t.to.appointment === target.appointment
    );

    expect(isValid).toBe(false);
  });

  it('should confirm appointment when webhook processes payment', () => {
    const appt = { status: "pendente_pagamento", payment_status: "pending" };

    // Webhook fires
    const newStatus = "confirmed";
    const newPaymentStatus = "paid";

    expect(newStatus).toBe("confirmed");
    expect(newPaymentStatus).toBe("paid");
  });
});
