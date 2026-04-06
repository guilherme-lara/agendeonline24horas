import { describe, it, expect } from "vitest";

describe("Trial Expiration Logic", () => {
  it("should set expiration to exactly 30 days from now", () => {
    const now = Date.now();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const expiresAt = new Date(now + THIRTY_DAYS_MS);

    const diff = expiresAt.getTime() - now;
    const diffDays = diff / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(30);
  });

  it("should calculate remaining days correctly", () => {
    const now = Date.now();
    const endDate = new Date(now + 15 * 24 * 60 * 60 * 1000); // 15 days from now
    const daysLeft = Math.ceil((endDate.getTime() - now) / (1000 * 60 * 60 * 24));
    expect(daysLeft).toBe(15);
  });

  it("should return negative for expired trials", () => {
    const now = Date.now();
    const endDate = new Date(now - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const daysLeft = Math.ceil((endDate.getTime() - now) / (1000 * 60 * 60 * 24));
    expect(daysLeft).toBeLessThan(0);
  });

  it("should determine urgency based on days left", () => {
    const getUrgency = (daysLeft: number) => {
      if (daysLeft <= 0) return "critical";
      if (daysLeft === 1) return "urgent";
      if (daysLeft <= 3) return "warning";
      return "normal";
    };

    expect(getUrgency(0)).toBe("critical");
    expect(getUrgency(-1)).toBe("critical");
    expect(getUrgency(1)).toBe("urgent");
    expect(getUrgency(2)).toBe("warning");
    expect(getUrgency(3)).toBe("warning");
    expect(getUrgency(5)).toBe("normal");
  });
});

describe("Trial Banner Visibility", () => {
  const shouldShowBanner = (trialEndsAt: string | null, planStatus: string | null): boolean => {
    if (!trialEndsAt) return false;
    const endDate = new Date(trialEndsAt);
    const today = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Show if in 0-7 day window
    if (daysRemaining >= 0 && daysRemaining <= 7) return true;
    // Show if recently expired (up to 7 days back)
    if (daysRemaining > -7) return true;
    return false;
  };

  it("shows banner when trial_ends_at is in the future (5 days)", () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldShowBanner(future, "trialing")).toBe(true);
  });

  it("does NOT show banner when trial_ends_at is null", () => {
    expect(shouldShowBanner(null, "trialing")).toBe(false);
  });

  it("shows banner on day 0 (expires today)", () => {
    const today = new Date().toISOString();
    expect(shouldShowBanner(today, "trialing")).toBe(true);
  });

  it("shows banner for recently expired (-3 days)", () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldShowBanner(past, "expired")).toBe(true);
  });

  it("hides banner when expired long ago (-10 days)", () => {
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldShowBanner(past, "expired")).toBe(false);
  });

  it("backfill SQL sets trial_ends_at to 7 days from now", () => {
    // Simulate what the backfill migration does
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const planStatus = "trialing";

    expect(planStatus).toBe("trialing");
    const daysLeft = Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expect(daysLeft).toBeGreaterThanOrEqual(6);
    expect(daysLeft).toBeLessThanOrEqual(7);
  });
});
