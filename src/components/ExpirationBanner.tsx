import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useAuth } from "@/hooks/useAuth";
import { openPlanCheckout } from "@/lib/infinitepay-checkout";
import { useMemo } from "react";

const ExpirationBanner = () => {
  const { barbershop } = useBarbershop();
  const { isAdmin } = useAuth();
  const shop = barbershop as any;

  const daysLeft = useMemo(() => {
    if (!shop || isAdmin) return null;
    const endDate = shop.trial_ends_at || shop.plan_ends_at;
    if (!endDate) return null;
    if (shop.plan_status === "active" && !shop.plan_ends_at) return null;
    const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [shop, isAdmin]);

  if (daysLeft === null || daysLeft > 3 || daysLeft < 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/15 border border-yellow-500/30 rounded-2xl mb-4 animate-in slide-in-from-top duration-500">
      <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
      <p className="text-xs font-bold text-foreground flex-1">
        ⚠️ Sua licença expira em <span className="text-yellow-500">{daysLeft} {daysLeft === 1 ? "dia" : "dias"}</span>. Renove agora para evitar o bloqueio do sistema.
      </p>
      <Button
        size="sm"
        onClick={() => openPlanCheckout(shop?.plan_name || "prata", shop?.id)}
        className="gold-gradient text-primary-foreground font-bold text-xs rounded-xl h-9 px-4 flex-shrink-0"
      >
        <ExternalLink className="h-3.5 w-3.5 mr-1" />
        Renovar
      </Button>
    </div>
  );
};

export default ExpirationBanner;
