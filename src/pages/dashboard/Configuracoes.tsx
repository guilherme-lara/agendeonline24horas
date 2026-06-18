import { useState, useEffect } from "react";
import { Settings, Loader2, Save, AlertTriangle, RefreshCw, Building2, QrCode, Copy, Check } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import LogoUpload from "@/components/LogoUpload";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const formatCnpjCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const Configuracoes = () => {
  const { clinic, loading: barberLoading, refetch, isError } = useClinic() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Proteção contra loading infinito
  const queryEnabled = !!clinic?.id;

  // Estados locais para controle dos inputs do formulário
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [address, setAddress] = useState("");

  // Campos Pix
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixBeneficiary, setPixBeneficiary] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);

  // --- PARSER SEGURO DE CONFIGURAÇÕES ---
  const getParsedSettings = (rawSettings: any) => {
    if (typeof rawSettings === "string") {
      try { return JSON.parse(rawSettings); } catch (e) { return {}; }
    }
    return rawSettings || {};
  };

  // Sincroniza o formulário sempre que os dados da clínica mudarem
  useEffect(() => {
    if (clinic) {
      setCompanyName(clinic.name || "");
      setPhone(clinic.phone || "");
      setAddress(clinic.address || "");
      
      const parsedSettings = getParsedSettings(clinic.settings);
      
      setCnpjCpf(parsedSettings.cnpj_cpf || "");
      setPixKey(parsedSettings.pix_key || "");
      setPixKeyType(parsedSettings.pix_key_type || "cpf");
      setPixBeneficiary(parsedSettings.pix_beneficiary || "");
    }
  }, [clinic]);

  const handleCopyPix = () => {
    if (!pixKey) return;
    navigator.clipboard.writeText(pixKey);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };

  // --- MUTAÇÃO: SALVAR CONFIGURAÇÕES ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Recarregando...");

      const currentSettings = getParsedSettings(clinic.settings);

      const payload = {
        name: companyName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        settings: {
          ...currentSettings,
          cnpj_cpf: cnpjCpf.trim(),
          pix_key: pixKey.trim(),
          pix_key_type: pixKeyType,
          pix_beneficiary: pixBeneficiary.trim(),
        },
      };

      console.log("Enviando Payload para o Supabase:", payload);

      const { data, error: updateError } = await supabase
        .from("barbershops")
        .update(payload)
        .eq("id", clinic.id)
        .select(); // FORÇA o banco a devolver a linha atualizada

      if (updateError) throw updateError;
      
      // Se data voltar vazio, significa que o RLS bloqueou a edição (o usuário não tem permissão)
      if (!data || data.length === 0) {
          throw new Error("Permissão negada. Você não tem autorização para editar este estabelecimento.");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-clinic"] });
      toast({ title: "Configurações Atualizadas!", description: "As mudanças já estão em vigor em todo o sistema." });
    },
    onError: (err: any) => {
      console.error("Erro ao salvar:", err);
      toast({ 
        title: "Falha ao salvar", 
        description: err.message || "Verifique sua conexão.", 
        variant: "destructive" 
      });
    }
  });

  // --- RENDERS DE PROTEÇÃO ---
  if (barberLoading && queryEnabled && !clinic) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Carregando painel de controle...</p>
      </div>
    );
  }

  if (isError && !clinic) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronização</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar as configurações da sua empresa.</p>
        <Button onClick={() => refetch()} className="bg-primary text-primary-foreground px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!clinic) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex items-center gap-4 border-b border-zinc-100 pb-8">
        <div className="bg-zinc-100 p-3 rounded-xl border border-zinc-200">
            <Settings className="h-7 w-7 text-zinc-900" />
        </div>
        <div>
            <h1 className="text-3xl font-bold text-zinc-900 tracking-tight font-display">Configurações</h1>
            <p className="text-zinc-500 text-sm font-medium">Gerencie a identidade e os dados fiscais do seu negócio.</p>
        </div>
      </div>

      <div className="grid gap-8">
        {/* SEÇÃO: IDENTIDADE VISUAL */}
        <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-sm transition-shadow">
            <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Logo da Empresa
            </h2>
            <LogoUpload
              barbershopId={clinic.id}
              currentUrl={(clinic as any).logo_url || ""}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ["current-clinic"] })}
            />
            <p className="text-[10px] text-muted-foreground mt-4 uppercase font-bold text-center">Recomendado: Imagem quadrada (512x512px)</p>
        </div>

        {/* SEÇÃO: DADOS DA EMPRESA */}
        <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-sm transition-shadow space-y-6">
            <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Save className="h-4 w-4" /> Informações do Perfil
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome Comercial</label>
                  <Input 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)} 
                    placeholder="Meu Negócio" 
                    className="bg-background border-border h-12 text-foreground focus-visible:ring-primary/50" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">WhatsApp de Contato</label>
                  <Input
                    value={phone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                      let formatted = digits;
                      if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                      if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                      setPhone(formatted);
                    }}
                    placeholder="(11) 99999-9999"
                    className="bg-background border-border h-12 text-foreground focus-visible:ring-primary/50 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CPF ou CNPJ</label>
                  <Input
                    value={cnpjCpf}
                    onChange={(e) => setCnpjCpf(formatCnpjCpf(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    className="bg-background border-border h-12 text-foreground focus-visible:ring-primary/50 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Endereço Público</label>
                  <Input 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    placeholder="Rua, Número, Cidade" 
                    className="bg-background border-border h-12 text-foreground focus-visible:ring-primary/50" 
                  />
                </div>
            </div>
        </div>

        {/* SEÇÃO: CHAVE PIX */}
        <div className="bg-white border border-zinc-200 rounded-xl p-8 shadow-sm transition-shadow space-y-6">
            <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                <QrCode className="h-4 w-4" /> Chave Pix para Recebimentos
            </h2>
            <p className="text-xs text-muted-foreground -mt-4">
              Configure sua chave Pix para receber sinais de agendamento e cobranças presenciais.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tipo da Chave</label>
                  <Select value={pixKeyType} onValueChange={setPixKeyType}>
                    <SelectTrigger className="bg-background border-border h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border text-popover-foreground">
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="random">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome do Beneficiário</label>
                  <Input
                    value={pixBeneficiary}
                    onChange={(e) => setPixBeneficiary(e.target.value)}
                    placeholder="Nome que aparece no Pix"
                    className="bg-background border-border h-12 text-foreground"
                  />
                </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chave Pix (Copia e Cola)</label>
              <div className="flex gap-2">
                <Input
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  placeholder="Insira sua chave Pix aqui..."
                  className="bg-background border-border h-12 text-foreground font-mono flex-1"
                />
                <Button variant="outline" onClick={handleCopyPix} className="border-border h-12 px-4">
                  {copiedPix ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Esta chave será exibida para seus clientes no momento de pagar o sinal do agendamento.
              </p>
            </div>
        </div>

        <Button 
            onClick={() => saveMutation.mutate()} 
            disabled={saveMutation.isPending} 
            className="w-full bg-zinc-900 text-white font-bold h-14 rounded-xl shadow-sm hover:bg-zinc-800 transition-all"
        >
          {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
          Aplicar Alterações no Sistema
        </Button>
      </div>
    </div>
  );
};

export default Configuracoes;
