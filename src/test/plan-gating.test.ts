import { describe, it, expect } from "vitest";

/**
 * Tests the plan gating logic used in App.tsx PlanGate component.
 * Simulates the canAccessFeature check from usePlanGate.
 */
const PLAN_HIERARCHY: Record<string, number> = {
  bronze: 1,
  prata: 2,
  ouro: 3,
  pro: 3, // Trial pro = ouro level
};

function canAccessFeature(currentPlan: string, minPlan: string): boolean {
  const currentLevel = PLAN_HIERARCHY[currentPlan] || 0;
  const requiredLevel = PLAN_HIERARCHY[minPlan] || 0;
  return currentLevel >= requiredLevel;
}

describe("Plan Gating", () => {
  it("Bronze can access Caixa (minPlan: bronze)", () => {
    expect(canAccessFeature("bronze", "bronze")).toBe(true);
  });

  it("Bronze cannot access Relatórios (minPlan: prata)", () => {
    expect(canAccessFeature("bronze", "prata")).toBe(false);
  });

  it("Prata can access Despesas (minPlan: prata)", () => {
    expect(canAccessFeature("prata", "prata")).toBe(true);
  });

  it("Ouro can access everything", () => {
    expect(canAccessFeature("ouro", "ouro")).toBe(true);
    expect(canAccessFeature("ouro", "prata")).toBe(true);
    expect(canAccessFeature("ouro", "bronze")).toBe(true);
  });

  it("Pro trial has ouro-level access", () => {
    expect(canAccessFeature("pro", "ouro")).toBe(true);
  });
});
