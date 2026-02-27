import { useState, useEffect } from "react";
import { Settings, Loader2, Save, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import LogoUpload from "@/components/LogoUpload";

const formatCnpjCpf = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    // CPF: 000.000.000-00
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  // CNPJ: 00.000.000/0000-00
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const Configuracoes = () => {
  const { barbershop, loading: barberLoading, refetch } = useBarbershop();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    // Se o hook global ainda está carregando, mantemos o loading local
    if (barberLoading) return;

    if (!barbershop) {
      // Se parou de carregar e não veio barbearia, algo deu errado na conexão
      setError(true);
      setLoading(false);
      return;
    }

    // Sucesso no carregamento
    setCompanyName(barbershop.name || "");
    setPhone(barbershop.phone || "");
    setAddress(barbershop.address || "");
    setCnpjCpf((barbershop.settings as any)?.cnpj_cpf || "");
    setError(false);
    setLoading(false);
  }, [barbershop, barberLoading]);

  const handleSave = async () => {
    if (!barbershop) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("barbershops")
        .update({
          name: companyName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          settings: {
            ...(barbershop.settings || {}),
            cnpj_cpf: cnpjCpf.trim(),
          },
        })
        .eq("id", barbershop.id);

      if (updateError) throw updateError;

      toast({ title: "Configurações salvas!" });
      refetch();
    } catch (err: any) {
      toast({ 
        title: "Erro ao salvar", 
        description: err.message || "Verifique sua conexão.", 
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  // <-- TELAS DE PROTEÇÃO -->
  if (loading || (barberLoading && !error)) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // TELA DE ERRO (Adeus F5!)
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="font-display text-xl font-bold mb-2">Erro ao carregar configurações</h2>
        <p className="text-sm text-muted-foreground mb-6">Não conseguimos recuperar os dados da sua barbearia.</p>
        <Button onClick={() => { setLoading(true); refetch(); }} className="gold-gradient text-primary-foreground font-semibold px-8">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto animate-fade-in">
      <h1 className="font-display text-2xl font-bold flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6 text-primary" /> Configurações
      </h1>

      {/* Logo */}
      <div className="mb-8">
        <LogoUpload
          barbershopId={barbershop.id}
          currentUrl={(barbershop as any).logo_url || ""}
          onUploaded={() => refetch()}
        />
      </div>

      {/* Company Info */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-lg">Dados da Empresa</h2>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nome da Empresa</label>
          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Minha Barbearia" maxLength={100} />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Celular / WhatsApp</label>
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
            maxLength={15}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">CNPJ ou CPF</label>
          <Input
            value={cnpjCpf}
            onChange={(e) => setCnpjCpf(formatCnpjCpf(e.target.value))}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            maxLength={18}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Endereço Completo</label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade - UF" maxLength={200} />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gold-gradient text-primary-foreground font-semibold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};

export default Configuracoes;
