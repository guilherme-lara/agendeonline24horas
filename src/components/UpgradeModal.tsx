import { useState } from "react";
import { Crown, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { useToast } from "@/hooks/use-toast";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  requiredPlan: string;
  featureName: string;
}

const formatWhatsApp = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const UpgradeModal = ({ open, onClose, requiredPlan, featureName }: UpgradeModalProps) => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const [whatsapp, setWhatsapp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const digits = whatsapp.replace(/\D/g, "");
  const isValid = digits.length === 11;

  const handleSubmit = async () => {
    if (!isValid || !barbershop) return;
    setSubmitting(true);
    const { error } = await supabase.from("upgrade_requests").insert({
      barbershop_id: barbershop.id,
      requested_plan: requiredPlan.toLowerCase(),
      whatsapp: whatsapp.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setSubmitted(true);
      toast({ title: "Solicitação enviada!", description: "Entraremos em contato pelo WhatsApp informado." });
    }
  };

  const handleClose = () => {
    setWhatsapp("");
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm mx-4 rounded-xl border border-border/50 bg-card p-8 shadow-sm backdrop-blur-sm">
        <button onClick={handleClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full gold-gradient shadow-gold">
            <Crown className="h-7 w-7 text-primary-foreground" />
          </div>

          {submitted ? (
            <>
              <h2 className="font-display text-xl font-bold mb-2">Solicitação Enviada!</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Nossa equipe entrará em contato pelo WhatsApp informado para ativar o plano <strong className="text-primary">{requiredPlan}</strong>.
              </p>
              <Button onClick={handleClose} className="w-full" variant="outline">Fechar</Button>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-bold mb-2">Upgrade Necessário</h2>
              <p className="text-sm text-muted-foreground mb-6">
                A funcionalidade <strong className="text-foreground">{featureName}</strong> está
                disponível a partir do plano <strong className="text-primary">{requiredPlan}</strong>.
              </p>
              <div className="mb-4">
                <label className="text-xs text-muted-foreground mb-1 block text-left">Seu WhatsApp</label>
                <Input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  className="bg-card border-border"
                />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={!isValid || submitting}
                className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Crown className="mr-2 h-4 w-4" />}
                Solicitar Upgrade
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
