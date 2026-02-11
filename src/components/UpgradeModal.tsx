import { Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  requiredPlan: string;
  featureName: string;
}

const UpgradeModal = ({ open, onClose, requiredPlan, featureName }: UpgradeModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm mx-4 rounded-xl border border-border bg-card p-8 shadow-card">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full gold-gradient shadow-gold">
            <Crown className="h-7 w-7 text-primary-foreground" />
          </div>
          <h2 className="font-display text-xl font-bold mb-2">Upgrade Necessário</h2>
          <p className="text-sm text-muted-foreground mb-6">
            A funcionalidade <strong className="text-foreground">{featureName}</strong> está
            disponível a partir do plano <strong className="text-primary">{requiredPlan}</strong>.
          </p>
          <Button className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90">
            <Crown className="mr-2 h-4 w-4" /> Ver Planos
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
