import { useState, useEffect } from "react";
import { Loader2, Save, ExternalLink, QrCode, ShieldCheck, Check } from "lucide-react";
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
  
  const [infinitePayTag, setInfinitePayTag] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixBeneficiary, setPixBeneficiary] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      // Carrega as configurações públicas do JSON da tabela barbershops
      const { data: shopData } = await (supabase.from("barbershops") as any)
        .select("settings")
        .eq("id", barbershopId)
        .single();

      if (shopData?.settings && typeof shopData.settings === "object") {
        const settings = shopData.settings as Record<string, any>;
        setPixKey(settings.pix_key || "");
        setPixBeneficiary(settings.pix_beneficiary || "");
        setInfinitePayTag(settings.infinitepay_tag || ""); // Carrega a Tag
      }

      setLoading(false);
    };
    loadSettings();
  }, [barbershopId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Pega as configurações atuais para não sobrescrever o que já existe
      const { data: current } = await (supabase.from("barbershops") as any)
        .select("settings")
        .eq("id", barbershopId)
        .single();

      const existingSettings = (current?.settings && typeof current.settings === "object") ? current.settings as Record<string, any> : {};

      // 2. Limpa a tag para garantir que não tenha @, $ ou espaços
      const cleanTag = infinitePayTag.trim().replace(/[@$ ]/g, '');

      // 3. Mescla as configurações novas com as antigas
      const newSettings = { 
        ...existingSettings, 
        pix_key: pixKey.trim(),
        pix_beneficiary: pixBeneficiary.trim(),
        infinitepay_tag: cleanTag
      };

      // Remove chaves antigas e inúteis por segurança e limpeza
      delete (newSettings as any).abacate_pay_api_key;
      delete (newSettings as any).infinitepay_api_key;
      delete (newSettings as any).infinitepay_token;

      // 4. Salva de volta no Supabase
      const { error: settingsError } = await (supabase.from("barbershops") as any)
        .update({ settings: newSettings })
        .eq("id", barbershopId);

      if (settingsError) throw settingsError;

      toast({ title: "Configurações salvas!", description: "Dados de pagamento atualizados com sucesso." });
      setInfinitePayTag(cleanTag); // Atualiza o input com a tag limpa
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
              Gera QR Codes dinâmicos com o valor exato na tela do cliente.
            </p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">
            InfiniteTag (Seu @ na InfinitePay)
          </label>
          <div className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Input
                type="text"
                value={infinitePayTag}
                onChange={(e) => setInfinitePayTag(e.target.value)}
                placeholder="Ex: ribeiro-guilherme-11k"
                className="bg-secondary border-border h-12 font-mono text-sm"
              />
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
