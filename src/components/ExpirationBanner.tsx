import { AlertTriangle, ExternalLink, Clock } from "lucide-react";
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
    const endDate = shop.trial_ends_at || shop.plan_ends_at || shop.expires_at;
    if (!endDate) return null;
    if (shop.plan_status === "active" && !shop.plan_ends_at && !shop.expires_at)
      return null;
    const diff = Math.ceil(
      (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  }, [shop, isAdmin]);

  if (daysLeft === null || daysLeft < 0) return null;

  // Determina cor e estilo baseado nos dias restantes
  const getBannerStyle = () => {
    if (daysLeft <= 3) {
      // Últimos 3 dias: Vermelho com pulse
      return {
        bg: "bg-red-600/15",
        border: "border-red-600/30",
        text: "text-red-600",
        icon: "text-red-600",
        animate: "animate-pulse",
      };
    }
    if (daysLeft <= 15) {
      // Até dia 15: Verde
      return {
        bg: "bg-emerald-500/15",
        border: "border-emerald-500/30",
        text: "text-emerald-500",
        icon: "text-emerald-500",
        animate: "",
      };
    }
    // Dia 16 ao 27: Laranja
    return {
      bg: "bg-amber-500/15",
      border: "border-amber-500/30",
      text: "text-amber-500",
      icon: "text-amber-500",
      animate: "",
    };
  };

  const style = getBannerStyle();

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${style.bg} border ${style.border} rounded-2xl mb-4 animate-in slide-in-from-top duration-500 ${style.animate}`}
    >
      {daysLeft <= 3 ? (
        <AlertTriangle className={`h-5 w-5 ${style.icon} flex-shrink-0`} />
      ) : (
        <Clock className={`h-5 w-5 ${style.icon} flex-shrink-0`} />
      )}
      <p className="text-xs font-bold text-foreground flex-1">
        {daysLeft <= 3 ? (
          <>
            ⚠️ Sua licença expira em{" "}
            <span className={style.text}>
              {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
            </span>
            . Renove agora para evitar o bloqueio do sistema.
          </>
        ) : daysLeft <= 15 ? (
          <>
            ✅ Você tem <span className={style.text}>{daysLeft} dias</span> de
            trial Pro. Aproveite todos os recursos!
          </>
        ) : (
          <>
            🔄 Trial Pro:{" "}
            <span className={style.text}>{daysLeft} dias restantes</span>.
            Considere um plano para continuar após o período.
          </>
        )}
      </p>
      <Button
        size="sm"
        onClick={() => openPlanCheckout(shop?.plan_name || "prata", shop?.id)}
        className="gold-gradient text-primary-foreground font-bold text-xs rounded-xl h-9 px-4 flex-shrink-0"
      >
        <ExternalLink className="h-3.5 w-3.5 mr-1" />
        {daysLeft <= 3 ? "Renovar" : "Ver Planos"}
      </Button>
    </div>
  );
};

export default ExpirationBanner;
