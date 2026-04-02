import { useState, useEffect } from "react";
import { Loader2, Save, QrCode, ShieldCheck, Check, Upload, X, Wifi, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface PaymentSettingsTabProps {
  barbershopId: string;
}

const PaymentSettingsTab = ({ barbershopId }: PaymentSettingsTabProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [infinitePayTag, setInfinitePayTag] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixBeneficiary, setPixBeneficiary] = useState("");
  const [pixStaticQrUrl, setPixStaticQrUrl] = useState("");
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [pingStatus, setPingStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [pingMessage, setPingMessage] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      const { data: shopData } = await (supabase.from("barbershops") as any)
        .select("settings")
        .eq("id", barbershopId)
        .single();

      if (shopData?.settings && typeof shopData.settings === "object") {
        const settings = shopData.settings as Record<string, any>;
        setPixKey(settings.pix_key || "");
        setPixKeyType(settings.pix_key_type || "cpf");
        setPixBeneficiary(settings.pix_beneficiary || "");
        setInfinitePayTag(settings.infinitepay_tag || "");
        setPixStaticQrUrl(settings.pix_static_qr_url || "");
      }

      setLoading(false);
    };
    
    loadSettings();
  }, [barbershopId]);

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${barbershopId}/pix-qr.${ext}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
      setPixStaticQrUrl(urlData.publicUrl);
      toast({ title: "QR Code enviado!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: current } = await (supabase.from("barbershops") as any)
        .select("settings")
        .eq("id", barbershopId)
        .single();

      const existingSettings = (current?.settings && typeof current.settings === "object") 
        ? current.settings as Record<string, any> 
        : {};

      const cleanTag = infinitePayTag.trim().replace(/[@$ ]/g, '');

      const newSettings = { 
        ...existingSettings, 
        pix_key: pixKey.trim(),
        pix_key_type: pixKeyType,
        pix_beneficiary: pixBeneficiary.trim(),
        infinitepay_tag: cleanTag,
        pix_static_qr_url: pixStaticQrUrl,
      };

      delete (newSettings as any).abacate_pay_api_key;
      delete (newSettings as any).infinitepay_api_key;
      delete (newSettings as any).infinitepay_token;

      const { error: settingsError } = await (supabase.from("barbershops") as any)
        .update({ settings: newSettings })
        .eq("id", barbershopId);

      if (settingsError) throw settingsError;

      toast({ title: "Configurações salvas!", description: "Os dados de pagamento foram atualizados." });
      setInfinitePayTag(cleanTag);
      queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
      
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
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
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <div className="bg-emerald-500/10 p-2 rounded-xl">
            <QrCode className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Pix Manual (Copia e Cola)</h3>
            <p className="text-xs text-muted-foreground">Exibido no PDV (Caixa) para pagamentos presenciais rápidos.</p>
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
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tipo da Chave</label>
            <Select value={pixKeyType} onValueChange={setPixKeyType}>
              <SelectTrigger className="bg-secondary border-border h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Celular</SelectItem>
                <SelectItem value="random">Chave Aleatória</SelectItem>
              </SelectContent>
            </Select>
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
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">QR Code Estático (Imagem)</label>
            {pixStaticQrUrl ? (
              <div className="flex items-center gap-3">
                <img src={pixStaticQrUrl} alt="QR Code Pix" className="h-16 w-16 rounded-lg border border-border object-contain bg-white" />
                <Button variant="ghost" size="sm" onClick={() => setPixStaticQrUrl("")} className="text-destructive hover:text-destructive">
                  <X className="h-4 w-4 mr-1" /> Remover
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer h-12 px-4 bg-secondary border border-border rounded-lg hover:border-primary/30 transition-colors">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm text-muted-foreground">{uploading ? "Enviando..." : "Enviar imagem do QR Code"}</span>
                <input type="file" accept="image/*" onChange={handleQrUpload} className="hidden" disabled={uploading} />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: INFINITEPAY */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <div className="bg-primary/10 p-2 rounded-xl">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">Integração InfinitePay</h3>
            <p className="text-xs text-muted-foreground">Gera Links e QR Codes dinâmicos com baixa automática.</p>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">
            InfiniteTag (Seu @ na InfinitePay)
          </label>
          <div className="flex gap-2 max-w-2xl">
            <Input
              type="text"
              value={infinitePayTag}
              onChange={(e) => setInfinitePayTag(e.target.value)}
              placeholder="Ex: ribeiro-guilherme-11k"
              className="bg-secondary border-border h-12 font-mono text-sm w-full"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Insira o seu handle da InfinitePay. Não é necessário incluir o símbolo @ ou $.
          </p>
        </div>

        <div className="bg-secondary/30 rounded-xl p-4 border border-border mt-4">
          <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
            URL do Webhook (Cole no painel da InfinitePay)
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-[11px] text-primary font-mono break-all select-all">
              https://whtlqimtclodchfdljcg.supabase.co/functions/v1/infinitepay-webhook
            </code>
            <Button type="button" variant="outline" onClick={copyWebhook} className="h-9 px-4 shrink-0 rounded-lg border-border hover:bg-secondary">
              {copiedWebhook ? <Check className="h-4 w-4 text-emerald-500" /> : "Copiar URL"}
            </Button>
          </div>
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
