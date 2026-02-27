import { useState, useEffect } from "react";
import { Settings, Loader2, Save, AlertTriangle, RefreshCw, Building2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import LogoUpload from "@/components/LogoUpload";

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
  const { barbershop, loading: barberLoading, refetch, isError } = useBarbershop() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados locais para controle dos inputs do formulário
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [address, setAddress] = useState("");

  // Sincroniza o formulário sempre que os dados da barbearia mudarem (ex: refresh de fundo)
  useEffect(() => {
    if (barbershop) {
      setCompanyName(barbershop.name || "");
      setPhone(barbershop.phone || "");
      setAddress(barbershop.address || "");
      setCnpjCpf((barbershop.settings as any)?.cnpj_cpf || "");
    }
  }, [barbershop]);

  // --- MUTAÇÃO: SALVAR CONFIGURAÇÕES (O FIM DO TRAVAMENTO) ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Health Check da Sessão antes de salvar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Recarregando...");

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
    },
    onSuccess: () => {
      // Invalida o cache global para atualizar o nome na Sidebar e Dashboard na hora
      queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
      toast({ title: "Configurações Atualizadas!", description: "As mudanças já estão em vigor em todo o sistema." });
    },
    onError: (err: any) => {
      toast({ 
        title: "Falha ao salvar", 
        description: err.message || "Verifique sua conexão.", 
        variant: "destructive" 
      });
    }
  });

  // --- RENDERS DE PROTEÇÃO ---
  if (barberLoading && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse uppercase tracking-widest font-bold">Carregando painel de controle...</p>
      </div>
    );
  }

  if (isError && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Erro de sincronização</h2>
        <p className="text-sm text-slate-400 mb-8">Não conseguimos carregar as configurações da sua empresa.</p>
        <Button onClick={() => refetch()} className="gold-gradient px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex items-center gap-4 border-b border-slate-800 pb-8">
        <div className="bg-cyan-500/10 p-3 rounded-2xl border border-cyan-500/20">
            <Settings className="h-7 w-7 text-cyan-400" />
        </div>
        <div>
            <h1 className="text-3xl font-black text-white tracking-tight">Configurações</h1>
            <p className="text-slate-500 text-sm font-medium">Gerencie a identidade e os dados fiscais do seu negócio.</p>
        </div>
      </div>

      <div className="grid gap-8">
        {/* SEÇÃO: IDENTIDADE VISUAL */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm shadow-xl">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Building2 className="h-4 w-4" /> Logo da Empresa
            </h2>
            <LogoUpload
              barbershopId={barbershop.id}
              currentUrl={(barbershop as any).logo_url || ""}
              onUploaded={() => queryClient.invalidateQueries({ queryKey: ["current-barbershop"] })}
            />
            <p className="text-[10px] text-slate-500 mt-4 uppercase font-bold text-center">Recomendado: Imagem quadrada (512x512px)</p>
        </div>

        {/* SEÇÃO: DADOS DA EMPRESA */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm shadow-xl space-y-6">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Save className="h-4 w-4" /> Informações do Perfil
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome Comercial</label>
                  <Input 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)} 
                    placeholder="Minha Barbearia" 
                    className="bg-slate-950 border-slate-800 h-12 text-white focus-visible:ring-cyan-500/50" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">WhatsApp de Contato</label>
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
                    className="bg-slate-950 border-slate-800 h-12 text-white focus-visible:ring-cyan-500/50 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CPF ou CNPJ</label>
                  <Input
                    value={cnpjCpf}
                    onChange={(e) => setCnpjCpf(formatCnpjCpf(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    className="bg-slate-950 border-slate-800 h-12 text-white focus-visible:ring-cyan-500/50 font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Endereço Público</label>
                  <Input 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value)} 
                    placeholder="Rua, Número, Cidade" 
                    className="bg-slate-950 border-slate-800 h-12 text-white focus-visible:ring-cyan-500/50" 
                  />
                </div>
            </div>

            <Button 
                onClick={() => saveMutation.mutate()} 
                disabled={saveMutation.isPending} 
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-cyan-900/20 transition-all active:scale-95"
            >
              {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
              Aplicar Alterações no Sistema
            </Button>
        </div>
      </div>
    </div>
  );
};

export default Configuracoes;
