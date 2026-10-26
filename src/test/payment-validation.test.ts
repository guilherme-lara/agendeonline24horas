import { describe, expect, it } from "vitest";
import {
  normalizeProviderAmount,
  validatePaymentAmount,
} from "../../supabase/functions/_shared/payment-validation";

describe("Payment amount validation", () => {
  it("normalizes whole currency values in cents", () => {
    expect(normalizeProviderAmount(12500)).toBe(125);
    expect(normalizeProviderAmount(12.5)).toBe(12.5);
  });

  it("requires the amount recorded for the active charge", () => {
    const result = validatePaymentAmount({
      amountReceived: 49,
      amountPaid: 0,
      totalAmount: 100,
      expectedAmount: 50,
      hasSignal: true,
      signalAmount: 20,
    });

    expect(result).toMatchObject({ valid: false, reason: "expected_amount_mismatch" });
  });

  it("records a valid signal as partial until the remaining balance is paid", () => {
    const firstPayment = validatePaymentAmount({
      amountReceived: 30,
      amountPaid: 0,
      totalAmount: 100,
      expectedAmount: 30,
      hasSignal: true,
      signalAmount: 30,
    });
    expect(firstPayment).toMatchObject({ valid: true, nextAmountPaid: 30, fullyPaid: false });

    const finalPayment = validatePaymentAmount({
      amountReceived: 70,
      amountPaid: firstPayment.nextAmountPaid,
      totalAmount: 100,
      expectedAmount: 70,
      hasSignal: true,
      signalAmount: 30,
    });
    expect(finalPayment).toMatchObject({ valid: true, nextAmountPaid: 100, fullyPaid: true });
  });

  it("rejects a repeated payment that would exceed the balance", () => {
    const result = validatePaymentAmount({
      amountReceived: 30,
      amountPaid: 80,
      totalAmount: 100,
      expectedAmount: 30,
      hasSignal: true,
      signalAmount: 30,
    });
    expect(result).toMatchObject({ valid: false, reason: "exceeds_balance" });
  });

  it("requires full payment when no deposit is configured", () => {
    const result = validatePaymentAmount({
      amountReceived: 50,
      amountPaid: 0,
      totalAmount: 100,
      expectedAmount: 50,
      hasSignal: false,
      signalAmount: 0,
    });
    expect(result).toMatchObject({ valid: false, reason: "total_mismatch" });
  });
});
