import { useState, useEffect } from "react";
import { Key, Loader2, Save, Eye, EyeOff, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface PaymentSettingsTabProps {
  barbershopId: string;
}

const PaymentSettingsTab = ({ barbershopId }: PaymentSettingsTabProps) => {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("barbershops")
      .select("settings")
      .eq("id", barbershopId)
      .single()
      .then(({ data }) => {
        if (data?.settings && typeof data.settings === "object") {
          setApiKey((data.settings as Record<string, any>).abacate_pay_api_key || "");
        }
        setLoading(false);
      });
  }, [barbershopId]);

  const handleSave = async () => {
    setSaving(true);
    const { data: current } = await supabase
      .from("barbershops")
      .select("settings")
      .eq("id", barbershopId)
      .single();

    const existingSettings = (current?.settings && typeof current.settings === "object") ? current.settings as Record<string, any> : {};

    const { error } = await supabase
      .from("barbershops")
      .update({
        settings: { ...existingSettings, abacate_pay_api_key: apiKey.trim() },
      })
      .eq("id", barbershopId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Chave salva!", description: "A chave AbacatePay foi configurada com sucesso." });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Key className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-bold">Configurações de Pagamento</h2>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="font-medium text-sm mb-1">AbacatePay — Pix Automático</h3>
          <p className="text-xs text-muted-foreground mb-4">
            Configure sua chave de API para gerar cobranças Pix automaticamente nos agendamentos.
          </p>
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">API Key do AbacatePay</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="abc_test_..."
                className="bg-secondary border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gold-gradient text-primary-foreground font-semibold hover:opacity-90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use chaves no formato <code className="text-primary">abc_test_...</code> para modo de teste.
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Não tem uma conta?{" "}
            <a
              href="https://abacatepay.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Criar conta no AbacatePay <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSettingsTab;
