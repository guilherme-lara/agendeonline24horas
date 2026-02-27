import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Scissors, Loader2, Plus, Trash2, GripVertical, Settings, AlertTriangle, RefreshCw, Check, X 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  active: boolean;
  sort_order: number;
  requires_advance_payment: boolean;
  advance_payment_value: number;
}

const Servicos = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados de UI para o formulário
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [requiresAdvance, setRequiresAdvance] = useState(false);
  const [advanceValue, setAdvanceValue] = useState("");

  // --- BUSCA DE SERVIÇOS (TANSTACK QUERY) ---
  const { data: services = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["services", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .order("sort_order");
      
      if (error) throw error;
      return data as Service[];
    },
    enabled: !!barbershop?.id,
    refetchOnWindowFocus: true, // Sincronia ativa ao voltar para a aba
  });

  // --- MUTAÇÃO: SALVAR / EDITAR SERVIÇO ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Health Check da Sessão
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Recarregando...");

      const payload = {
        name: name.trim(),
        price: Number(price) || 0,
        duration: Number(duration) || 30,
        requires_advance_payment: requiresAdvance,
        advance_payment_value: requiresAdvance ? (Number(advanceValue) || 0) : 0,
      };

      if (editing) {
        const { error } = await supabase.from("services").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert({ 
          ...payload, 
          barbershop_id: barbershop?.id, 
          sort_order: services.length 
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: editing ? "Serviço Atualizado!" : "Serviço Cadastrado!" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  });

  // --- MUTAÇÃO: ATUALIZAR STATUS (ATIVO/INATIVO) ---
  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string, active: boolean }) => {
      const { error } = await supabase.from("services").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  // --- MUTAÇÃO: DELETAR ---
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Serviço removido com sucesso." });
    },
  });

  // --- LÓGICA DO FORMULÁRIO ---
  const openNew = () => {
    setEditing(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setName(s.name);
    setPrice(String(s.price));
    setDuration(String(s.duration));
    setRequiresAdvance(s.requires_advance_payment || false);
    setAdvanceValue(String(s.advance_payment_value || 0));
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setName(""); setPrice(""); setDuration("30"); setRequiresAdvance(false); setAdvanceValue("");
  };

  // --- RENDERS DE PROTEÇÃO ---
  if (isLoading && !services.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse uppercase tracking-widest font-bold">Afiando as tesouras...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Erro de sincronização</h2>
        <p className="text-sm text-slate-400 mb-8">Não conseguimos carregar o seu catálogo de serviços.</p>
        <Button onClick={() => refetch()} className="gold-gradient px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
            <Scissors className="h-8 w-8 text-cyan-400" /> Catálogo de Serviços
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Defina os preços, tempos e regras de sinal para cada serviço.</p>
        </div>
        <Button onClick={openNew} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-cyan-900/20 transition-all active:scale-95">
          <Plus className="h-5 w-5 mr-2" /> Novo Serviço
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-16 text-center backdrop-blur-sm shadow-xl">
          <div className="bg-slate-950 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-800">
            <Scissors className="h-10 w-10 text-slate-700" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Catálogo Vazio</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto mb-6">Comece cadastrando seu serviço principal (ex: Corte de Cabelo) para liberar a agenda.</p>
          <Button onClick={openNew} variant="outline" className="border-slate-700 text-slate-400 hover:text-white">Cadastrar Primeiro Serviço</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {services.map((s) => (
            <div key={s.id} className={`group flex items-center gap-4 rounded-2xl border transition-all duration-300 p-5 backdrop-blur-md shadow-lg ${!s.active ? "bg-slate-950/40 border-slate-900 opacity-60" : "bg-slate-900/40 border-slate-800 hover:border-cyan-500/30"}`}>
              <GripVertical className="h-5 w-5 text-slate-700 flex-shrink-0 cursor-grab group-hover:text-slate-500 transition-colors" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                    <p className="font-bold text-white text-lg tracking-tight truncate">{s.name}</p>
                    {s.requires_advance_payment && (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] uppercase font-black">
                            Exige Sinal
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                  <span className="text-cyan-500">R$ {Number(s.price).toFixed(2).replace(".", ",")}</span>
                  <span>&bull;</span>
                  <span>{s.duration} Minutos</span>
                  {s.requires_advance_payment && (
                    <>
                        <span>&bull;</span>
                        <span className="text-emerald-500">Sinal: R$ {Number(s.advance_payment_value).toFixed(2).replace(".", ",")}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2 pr-4 border-r border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter hidden sm:block">Status</span>
                    <Switch checked={s.active} onCheckedChange={() => toggleMutation.mutate({ id: s.id, active: !s.active })} disabled={toggleMutation.isPending} />
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-600 hover:text-white hover:bg-slate-800 rounded-xl" onClick={() => openEdit(s)}>
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl" onClick={() => { if(confirm("Deletar este serviço permanentemente?")) deleteMutation.mutate(s.id); }} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DIALOG: NOVO/EDITAR SERVIÇO */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#0b1224] border-slate-800 text-white max-w-md shadow-2xl">
          <DialogHeader className="border-b border-slate-800/50 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black">
                <Scissors className="text-cyan-400 h-6 w-6" /> {editing ? "Ajustar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome do Serviço</label>
                    <Input placeholder="Ex: Corte Degradê, Barba Terapia..." value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-950 border-slate-800 h-12 text-white" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preço Final (R$)</label>
                        <Input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-slate-950 border-slate-800 h-12 font-mono text-cyan-400 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tempo Médio (Minutos)</label>
                        <Input type="number" placeholder="30" value={duration} onChange={(e) => setDuration(e.target.value)} className="bg-slate-950 border-slate-800 h-12 text-white font-bold" />
                    </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-white uppercase tracking-tight">Pagamento Antecipado (Sinal)</p>
                            <p className="text-[9px] text-slate-500 uppercase font-medium">O cliente paga um valor para agendar</p>
                        </div>
                        <Switch checked={requiresAdvance} onCheckedChange={setRequiresAdvance} />
                    </div>
                    {requiresAdvance && (
                        <div className="animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1 block">Valor do Adiantamento (R$)</label>
                            <Input type="number" placeholder="0.00" value={advanceValue} onChange={(e) => setAdvanceValue(e.target.value)} className="bg-slate-900 border-emerald-500/30 h-11 font-mono text-emerald-400 font-bold" />
                        </div>
                    )}
                </div>
            </div>

            <Button
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-cyan-900/20 transition-all active:scale-95"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim()}
            >
              {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
              {editing ? "Salvar Alterações" : "Ativar Novo Serviço"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Servicos;
