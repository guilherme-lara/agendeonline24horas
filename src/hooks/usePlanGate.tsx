import { useMemo } from "react";
import { useBarbershop } from "./useBarbershop";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type PlanTier = "trial" | "bronze" | "prata" | "ouro";

const PLAN_RANK: Record<string, number> = {
  trial: 0,
  bronze: 1,
  essential: 1, // legacy alias
  prata: 2,
  growth: 2, // legacy alias
  ouro: 3,
  pro: 3, // legacy alias
};

const PLAN_LIMITS: Record<string, { hasFinanceiro: boolean; hasExport: boolean; hasPacotes: boolean }> = {
  trial:  { hasFinanceiro: false, hasExport: false, hasPacotes: false },
  bronze: { hasFinanceiro: false, hasExport: false, hasPacotes: false },
  prata:  { hasFinanceiro: true,  hasExport: false, hasPacotes: false },
  ouro:   { hasFinanceiro: true, hasExport: true, hasPacotes: true },
};

function normalizePlanName(raw: string): PlanTier {
  const lower = raw.toLowerCase();
  if (lower === "ouro" || lower === "pro") return "ouro";
  if (lower === "prata" || lower === "growth") return "prata";
  if (lower === "bronze" || lower === "essential") return "bronze";
  return "trial";
}

export const usePlanGate = () => {
  const { barbershop } = useBarbershop();
  const { isAdmin } = useAuth();
  const shop = barbershop as any;

  const currentPlan = useMemo(() => {
    if (!shop) return "trial" as PlanTier;
    return normalizePlanName(shop.plan_name || "trial");
  }, [shop]);

  const isActive = useMemo(() => {
    if (!shop) return false;
    return shop.plan_status === "active";
  }, [shop]);

  // Count current barbers
  const { data: barberCount = 0 } = useQuery({
    queryKey: ["barber-count", shop?.id],
    queryFn: async () => {
      if (!shop?.id) return 0;
      const { count, error } = await supabase
        .from("barbers")
        .select("id", { count: "exact", head: true })
        .eq("barbershop_id", shop.id)
        .eq("active", true);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!shop?.id,
    staleTime: 60_000,
  });

  const limits = PLAN_LIMITS[currentPlan] || PLAN_LIMITS.trial;

  const canAddBarber = true; // Barbeiros ilimitados para todos os planos
  const hasFinanceiro = isAdmin || limits.hasFinanceiro;
  const hasExport = isAdmin || limits.hasExport;
  const hasPacotes = isAdmin || limits.hasPacotes;

  const canAccessFeature = (minPlan: PlanTier): boolean => {
    if (isAdmin) return true;
    const currentRank = PLAN_RANK[currentPlan] || 0;
    const requiredRank = PLAN_RANK[minPlan] || 0;
    return currentRank >= requiredRank;
  };

  const getUpgradePlan = (minPlan: PlanTier): string => {
    const names: Record<PlanTier, string> = {
      trial: "Bronze",
      bronze: "Bronze",
      prata: "Prata",
      ouro: "Ouro",
    };
    return names[minPlan] || "Prata";
  };

  return {
    currentPlan,
    isActive,
    canAddBarber,
    barberCount,
    hasFinanceiro,
    hasExport,
    hasPacotes,
    canAccessFeature,
    getUpgradePlan,
    isAdmin,
  };
};
