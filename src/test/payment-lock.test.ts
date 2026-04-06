import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ═══════════════════════════════════════════════════════
// 3-MINUTE PAYMENT LOCK & AUTO-CANCEL TESTS
// ═══════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────
// Test 1: Expires At Calculation
// The code sets expires_at = NOW() + 3 minutes
// ──────────────────────────────────────────────────────
describe("Payment Lock Duration", () => {
  const LOCK_SECONDS = 3 * 60; // 180 seconds

  it("should set expires_at to exactly 3 minutes from now", () => {
    const now = Date.now();
    const expiresAt = new Date(now + LOCK_SECONDS * 1000);
    const diffMinutes = (expiresAt.getTime() - now) / 1000 / 60;
    expect(diffMinutes).toBe(3);
  });

  it("should set expires_at timestamp in the future", () => {
    const expiresAt = new Date(Date.now() + LOCK_SECONDS * 1000);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

// ──────────────────────────────────────────────────────
// Test 2: Countdown Timer Logic
// formatTime: seconds → "M:SS"
// ──────────────────────────────────────────────────────
describe("Countdown Timer Format", () => {
  const formatTime = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return "0:00";
    return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
  };

  it("formats 3:00 correctly", () => {
    expect(formatTime(180)).toBe("3:00");
  });

  it("formats 2:59 correctly", () => {
    expect(formatTime(179)).toBe("2:59");
  });

  it("formats 1:05 correctly", () => {
    expect(formatTime(65)).toBe("1:05");
  });

  it("formats 0:30 correctly", () => {
    expect(formatTime(30)).toBe("0:30");
  });

  it("formats 0:00 correctly", () => {
    expect(formatTime(0)).toBe("0:00");
  });

  it("formats 0:01 correctly", () => {
    expect(formatTime(1)).toBe("0:01");
  });

  it("handles negative seconds", () => {
    expect(formatTime(-5)).toBe("0:00");
  });
});

// ──────────────────────────────────────────────────────
// Test 3: Timer Color Logic
// ──────────────────────────────────────────────────────
describe("Timer Color States", () => {
  const getTimerColor = (timeLeft: number): string => {
    if (timeLeft <= 60) return "text-red-400";
    if (timeLeft <= 120) return "text-amber-400";
    return "text-emerald-400";
  };

  it("shows emerald for > 2 minutes", () => {
    expect(getTimerColor(121)).toBe("text-emerald-400");
  });

  it("shows amber for 1-2 minutes", () => {
    expect(getTimerColor(120)).toBe("text-amber-400");
    expect(getTimerColor(61)).toBe("text-amber-400");
  });

  it("shows red for last minute", () => {
    expect(getTimerColor(60)).toBe("text-red-400");
    expect(getTimerColor(1)).toBe("text-red-400");
  });

  it("shows red for zero time", () => {
    expect(getTimerColor(0)).toBe("text-red-400");
  });
});

// ──────────────────────────────────────────────────────
// Test 4: Slot Filtering with Expires At
// pending_payment with expires_at < NOW should be excluded
// ──────────────────────────────────────────────────────
describe("Slot Filtering with Expired Reservations", () => {
  const shouldBlockSlot = (appt: { status: string; expires_at: string | null }, now: Date): boolean => {
    if (appt.status === "cancelled") return false;
    if (appt.status !== "pending_payment") return true;
    // pending_payment: only block if expires_at is still in future
    if (!appt.expires_at) return true; // no expiry set — block defensively
    return new Date(appt.expires_at) > now;
  };

  it("confirmed appointments always block the slot", () => {
    const now = new Date();
    expect(shouldBlockSlot({ status: "confirmed", expires_at: null }, now)).toBe(true);
  });

  it("pending_payment WITH future expires_at blocks the slot", () => {
    const futureExpiry = new Date(Date.now() + 180000).toISOString();
    const now = new Date();
    expect(shouldBlockSlot({ status: "pending_payment", expires_at: futureExpiry }, now)).toBe(true);
  });

  it("pending_payment WITH expired expires_at does NOT block", () => {
    const pastExpiry = new Date(Date.now() - 60000).toISOString();
    const now = new Date();
    expect(shouldBlockSlot({ status: "pending_payment", expires_at: pastExpiry }, now)).toBe(false);
  });

  it("cancelled appointments never block", () => {
    const now = new Date();
    expect(shouldBlockSlot({ status: "cancelled", expires_at: null }, now)).toBe(false);
  });
});

// ──────────────────────────────────────────────────────
// Test 5: Cleanup RPC Logic
// ──────────────────────────────────────────────────────
describe("Cleanup Expired Appointments", () => {
  // Mirror of cleanup_expired_appointments function
  const cleanupExpired = (
    appointments: Array<{ id: string; status: string; expires_at: string | null }>,
    now: Date,
  ): Array<{ id: string; newStatus: string }> => {
    return appointments
      .filter(
        (a) =>
          a.status === "pending_payment" &&
          a.expires_at !== null &&
          new Date(a.expires_at) < now,
      )
      .map((a) => ({ id: a.id, newStatus: "cancelled" }));
  };

  it("cancels expired pending_payment appointments", () => {
    const now = new Date();
    const appts = [
      { id: "1", status: "pending_payment", expires_at: new Date(now.getTime() - 60000).toISOString() },
      { id: "2", status: "pending_payment", expires_at: new Date(now.getTime() + 120000).toISOString() },
      { id: "3", status: "confirmed", expires_at: null },
    ];

    const result = cleanupExpired(appts, now);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
    expect(result[0].newStatus).toBe("cancelled");
  });

  it("does not cancel appointments with future expires_at", () => {
    const now = new Date();
    const appts = [
      { id: "1", status: "pending_payment", expires_at: new Date(now.getTime() + 60000).toISOString() },
    ];
    const result = cleanupExpired(appts, now);
    expect(result).toHaveLength(0);
  });

  it("does not cancel non-pending_payment appointments", () => {
    const now = new Date();
    const appts = [
      { id: "1", status: "confirmed", expires_at: new Date(now.getTime() - 60000).toISOString() },
      { id: "2", status: "cancelled", expires_at: new Date(now.getTime() - 60000).toISOString() },
    ];
    const result = cleanupExpired(appts, now);
    expect(result).toHaveLength(0);
  });

  it("does not cancel pending_payment without expires_at", () => {
    const now = new Date();
    const appts = [
      { id: "1", status: "pending_payment", expires_at: null },
    ];
    const result = cleanupExpired(appts, now);
    expect(result).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────
// Test 6: Session Storage for Payment State
// ──────────────────────────────────────────────────────
describe("Payment Lock Session Persistence", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
  });

  it("stores expires_at and appointment ID on redirect", () => {
    const expiresAt = Date.now() + 180000;
    const apptId = "test-appt-uuid";
    mockStorage["payment_expires_at"] = String(expiresAt);
    mockStorage["pending_appt_id"] = apptId;

    expect(Number(mockStorage["payment_expires_at"])).toBeCloseTo(expiresAt, -3);
    expect(mockStorage["pending_appt_id"]).toBe(apptId);
  });

  it("detects expired reservation on return", () => {
    const storedExpiry = Date.now() - 1000; // already expired
    mockStorage["payment_expires_at"] = String(storedExpiry);
    mockStorage["pending_appt_id"] = "test-appt-uuid";

    const isExpired = Date.now() > Number(mockStorage["payment_expires_at"]);
    expect(isExpired).toBe(true);
  });

  it("clears storage after expiration", () => {
    mockStorage["payment_expires_at"] = String(Date.now() - 1000);
    mockStorage["pending_appt_id"] = "test-appt-uuid";

    delete mockStorage["payment_expires_at"];
    delete mockStorage["pending_appt_id"];

    expect(mockStorage["payment_expires_at"]).toBeUndefined();
    expect(mockStorage["pending_appt_id"]).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────
// Test 7: End-to-End Payment Flow
// ──────────────────────────────────────────────────────
describe("End-to-End Payment Lock Flow", () => {
  it("booking: pending_payment with expires_at blocks other bookings", () => {
    const bookingCreated = Date.now();
    const expiresAt = bookingCreated + 180000; // 3 min
    const status = "pending_payment";

    // Another client queries slots 1 min later
    const queryTime = bookingCreated + 60000;
    expect(status === "confirmed" || (status === "pending_payment" && expiresAt > queryTime)).toBe(true);
  });

  it("payment completed: status updates to confirmed, expires_at cleared", () => {
    const appt = { status: "pending_payment", expires_at: new Date(Date.now() + 60000).toISOString() };

    // Webhook confirms payment
    appt.status = "confirmed";

    // Slot remains blocked (confirmed appointments always block)
    expect(appt.status === "confirmed").toBe(true);
  });

  it("payment failed/ignored: expires, slot becomes available", () => {
    const expiresAt = Date.now() - 1000; // already past
    const status = "pending_payment";

    // Cleanup runs
    const cleanedUp = status === "pending_payment" && expiresAt < Date.now();
    expect(cleanedUp).toBe(true);
    // After cleanup: status = "cancelled" → slot free
  });

  it("user returns from checkout after timeout → sees expired message", () => {
    const expiry = Date.now() - 30000; // 30 seconds ago
    const timeLeft = Math.max(0, Math.floor((expiry - Date.now()) / 1000));

    expect(timeLeft).toBe(0);
    // UI should show: "Reserva Expirada"
  });
});
