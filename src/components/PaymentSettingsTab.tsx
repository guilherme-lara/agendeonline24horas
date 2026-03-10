import { useState, useEffect } from "react";
import { Loader2, Save, Eye, EyeOff, ExternalLink, QrCode, ShieldCheck, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface PaymentSettingsTabProps {
  barbershopId: string;
}

const PaymentSettingsTab = ({ barbershopId }: PaymentSettingsTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [infinitePayKey, setInfinitePayKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [pixBeneficiary, setPixBeneficiary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      // Load public Pix settings from barbershops table
      const { data: shopData } = await (supabase.from("barbershops") as any)
        .select("settings")
        .eq("id", barbershopId)
        .single();

      if (shopData?.settings && typeof shopData.settings === "object") {
        const settings = shopData.settings as Record<string, any>;
        setPixKey(settings.pix_key || "");
        setPixBeneficiary(settings.pix_beneficiary || "");
      }

      // 🔒 Load sensitive keys from barbershop_secrets table (RLS protected)
      const { data: secrets } = await (supabase.from("barbershop_secrets") as any)
        .select("infinitepay_token, webhook_secret")
        .eq("barbershop_id", barbershopId)
        .maybeSingle();

      if (secrets) {
        setInfinitePayKey(secrets.infinitepay_token || "");
        setWebhookSecret(secrets.webhook_secret || "");
      }

      setLoading(false);
    };
    loadSettings();
  }, [barbershopId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Salvar Pix settings (público) na tabela barbershops
      const { data: current } = await (supabase.from("barbershops") as any)
        .select("settings")
        .eq("id", barbershopId)
        .single();

      const existingSettings = (current?.settings && typeof current.settings === "object") ? current.settings as Record<string, any> : {};

      // 🔒 Remove qualquer chave de API que esteja no settings público (migração de segurança)
      const newSettings = { 
        ...existingSettings, 
        pix_key: pixKey.trim(),
        pix_beneficiary: pixBeneficiary.trim()
      };
      delete (newSettings as any).abacate_pay_api_key;
      delete (newSettings as any).infinitepay_api_key;
      delete (newSettings as any).infinitepay_token;

      const { error: settingsError } = await (supabase.from("barbershops") as any)
        .update({ settings: newSettings })
        .eq("id", barbershopId);

      if (settingsError) throw settingsError;

      // 2. 🔒 Salvar chaves sensíveis na tabela barbershop_secrets (RLS protegida)
      const { error: secretsError } = await (supabase.from("barbershop_secrets") as any)
        .upsert({
          barbershop_id: barbershopId,
          infinitepay_token: infinitePayKey.trim(),
          webhook_secret: webhookSecret.trim(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "barbershop_id" });

      if (secretsError) throw secretsError;

      toast({ title: "Configurações salvas!", description: "Chaves de pagamento atualizadas com segurança." });
      queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const copyWebhook = () => {
    navigator.clipboard.writeText("https://whtlqimtclodchfdljcg.supabase.co/functions/v1/infinitepay-webhook");
    setCopiedWebhook(true);
    toast({ title: "Webhook Copiado!" });
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in">
      
      {/* SEÇÃO 1: PIX ESTÁTICO (PDV) */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <div className="bg-emerald-500/10 p-2 rounded-xl">
            <QrCode className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Pix Manual (Copia e Cola)</h3>
            <p className="text-xs text-muted-foreground">Exibido no PDV (Caixa) para pagamentos presenciais.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sua Chave Pix</label>
            <Input 
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="CPF, CNPJ, Email ou Celular"
              className="bg-secondary border-border h-12"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nome do Beneficiário</label>
            <Input 
              value={pixBeneficiary}
              onChange={(e) => setPixBeneficiary(e.target.value)}
              placeholder="Ex: Barbearia do João"
              className="bg-secondary border-border h-12"
            />
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: INFINITEPAY (SINAIS ONLINE) */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <div className="bg-primary/10 p-2 rounded-xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Integração InfinitePay</h3>
            <p className="text-xs text-muted-foreground">
              Gera QR Codes dinâmicos com o valor exato do sinal na tela do cliente.
            </p>
          </div>
        </div>

        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
            Suas chaves de API são armazenadas em uma tabela segura com RLS, nunca expostas publicamente.
          </p>
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">
            API Key (InfinitePay)
          </label>
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                value={infinitePayKey}
                onChange={(e) => setInfinitePayKey(e.target.value)}
                placeholder="Cole sua Chave de API de Produção aqui..."
                className="bg-secondary border-border pr-10 h-12 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-secondary/30 rounded-xl p-4 border border-border mt-4">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
            URL do Webhook (Cole no painel da InfinitePay)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-[11px] text-primary font-mono break-all select-all">
              https://whtlqimtclodchfdljcg.supabase.co/functions/v1/infinitepay-webhook
            </code>
            <Button
              type="button"
              variant="outline"
              onClick={copyWebhook}
              className="h-9 px-4 shrink-0 rounded-lg border-border hover:bg-secondary"
            >
              {copiedWebhook ? <Check className="h-4 w-4 text-emerald-500" /> : "Copiar URL"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Não tem uma conta?{" "}
            <a
              href="https://infinitepay.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-bold hover:underline inline-flex items-center gap-1"
            >
              Criar conta na InfinitePay <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-12 px-10 gold-gradient text-primary-foreground font-black text-sm rounded-xl shadow-gold hover:scale-[0.98] transition-transform"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};

export default PaymentSettingsTab;
