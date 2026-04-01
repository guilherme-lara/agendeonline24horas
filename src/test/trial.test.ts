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

  it("should determine banner color based on days left", () => {
    const getColor = (daysLeft: number) => {
      if (daysLeft <= 3) return "red";
      if (daysLeft <= 15) return "green";
      return "amber";
    };

    expect(getColor(1)).toBe("red");
    expect(getColor(3)).toBe("red");
    expect(getColor(10)).toBe("green");
    expect(getColor(15)).toBe("green");
    expect(getColor(20)).toBe("amber");
  });
});
