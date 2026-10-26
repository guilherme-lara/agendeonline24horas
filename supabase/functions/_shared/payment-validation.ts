export interface PaymentValidationInput {
  amountReceived: number;
  amountPaid: number;
  totalAmount: number;
  expectedAmount: number | null;
  hasSignal: boolean;
  signalAmount: number;
  tolerance?: number;
}

export interface PaymentValidationResult {
  valid: boolean;
  nextAmountPaid: number;
  fullyPaid: boolean;
  reason?: "invalid_amount" | "exceeds_balance" | "expected_amount_mismatch" | "below_signal" | "total_mismatch";
}

export const normalizeProviderAmount = (value: number): number =>
  Number.isInteger(value) && value >= 100 ? value / 100 : value;

export const validatePaymentAmount = ({
  amountReceived,
  amountPaid,
  totalAmount,
  expectedAmount,
  hasSignal,
  signalAmount,
  tolerance = 0.02,
}: PaymentValidationInput): PaymentValidationResult => {
  if (
    !Number.isFinite(amountReceived) ||
    amountReceived <= 0 ||
    !Number.isFinite(amountPaid) ||
    amountPaid < 0 ||
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0
  ) {
    return { valid: false, nextAmountPaid: amountPaid, fullyPaid: false, reason: "invalid_amount" };
  }

  const roundedReceived = Math.round(amountReceived * 100) / 100;
  const nextAmountPaid = Math.round((amountPaid + roundedReceived) * 100) / 100;
  if (nextAmountPaid > totalAmount + tolerance) {
    return { valid: false, nextAmountPaid, fullyPaid: false, reason: "exceeds_balance" };
  }
  if (expectedAmount !== null && Math.abs(roundedReceived - expectedAmount) > tolerance) {
    return { valid: false, nextAmountPaid, fullyPaid: false, reason: "expected_amount_mismatch" };
  }
  if (hasSignal && signalAmount > 0) {
    const remainingSignal = Math.max(0, signalAmount - amountPaid);
    if (roundedReceived < remainingSignal - tolerance) {
      return { valid: false, nextAmountPaid, fullyPaid: false, reason: "below_signal" };
    }
  } else if (Math.abs(nextAmountPaid - totalAmount) > tolerance) {
    return { valid: false, nextAmountPaid, fullyPaid: false, reason: "total_mismatch" };
  }

  return {
    valid: true,
    nextAmountPaid: Math.min(nextAmountPaid, totalAmount),
    fullyPaid: nextAmountPaid >= totalAmount - tolerance,
  };
};
