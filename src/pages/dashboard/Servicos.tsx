import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Scissors, Loader2, Plus, Trash2, GripVertical, Settings, AlertTriangle, RefreshCw, Check, X, ShieldCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
<<<<<<< HEAD
=======
  const [requiresAdvance, setRequiresAdvance] = useState(true);
>>>>>>> origin/main
  const [advanceValue, setAdvanceValue] = useState("");

  const queryEnabled = !!barbershop?.id;

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
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const numericPrice = Number(price) || 0;
      const numericAdvanceValue = Number(advanceValue) || 0;

      if (numericAdvanceValue > numericPrice) {
        throw new Error("O valor do adiantamento não pode ser maior que o preço final do serviço.");
      }

      const payload = {
        name: name.trim(),
        price: numericPrice,
        duration: Number(duration) || 30,
        requires_advance_payment: true, // Ponto 1: Sempre obrigatório
        advance_payment_value: numericAdvanceValue,
      };

      if (editing) {
        const { error } = await supabase.from("services").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("services").insert({ ...payload, barbershop_id: barbershop?.id, sort_order: services.length });
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

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string, active: boolean }) => {
      const { error } = await supabase.from("services").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) {
        if (error.code === '23503') {
          throw new Error("Este serviço possui agendamentos vinculados. Desative-o em vez de deletar.");
        }
        throw new Error(`Erro ao deletar: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({ title: "Serviço removido com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover serviço", description: err.message, variant: "destructive" });
    },
  });

  const openNew = () => { setEditing(null); resetForm(); setIsDialogOpen(true); };
  const openEdit = (s: Service) => {
    setEditing(s); setName(s.name); setPrice(String(s.price)); setDuration(String(s.duration));
    setAdvanceValue(String(s.advance_payment_value || 0));
    setIsDialogOpen(true);
  };
<<<<<<< HEAD
  const resetForm = () => { setName(""); setPrice(""); setDuration("30"); setAdvanceValue(""); };
=======
  const resetForm = () => { setName(""); setPrice(""); setDuration("30"); setRequiresAdvance(true); setAdvanceValue(""); };
>>>>>>> origin/main

  if (isLoading && queryEnabled && !services.length && !isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Afiando as tesouras...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronização</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar o seu catálogo de serviços.</p>
        <Button onClick={() => refetch()} className="gold-gradient text-primary-foreground px-8 font-bold">
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
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight font-display">
            <Scissors className="h-8 w-8 text-primary" /> Catálogo de Serviços
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">Defina os preços, tempos e o sinal obrigatório para cada serviço.</p>
        </div>
        <Button onClick={openNew} className="gold-gradient text-primary-foreground font-bold h-12 px-6 rounded-xl shadow-gold transition-all active:scale-95">
          <Plus className="h-5 w-5 mr-2" /> Novo Serviço
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-16 text-center shadow-card">
          <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
            <Scissors className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Catálogo Vazio</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">Comece cadastrando seu serviço principal para liberar a agenda online.</p>
          <Button onClick={openNew} variant="outline" className="border-border text-muted-foreground hover:text-foreground">Cadastrar Primeiro Serviço</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {services.map((s) => (
            <div key={s.id} className={`group flex items-center gap-4 rounded-2xl border transition-all duration-300 p-5 backdrop-blur-md shadow-card ${!s.active ? "bg-background/40 border-border opacity-60" : "bg-card border-border hover:border-primary/30"}`}>
              <GripVertical className="h-5 w-5 text-muted-foreground/30 flex-shrink-0 cursor-grab group-hover:text-muted-foreground transition-colors" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                    <p className="font-bold text-foreground text-lg tracking-tight truncate">{s.name}</p>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] uppercase font-black">
                        Exige Sinal
                    </Badge>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                  <span className="text-primary">R$ {Number(s.price).toFixed(2).replace(".", ",")}</span>
                  <span>&bull;</span>
                  <span>{s.duration} Minutos</span>
                  <>
                      <span>&bull;</span>
                      <span className="text-emerald-500">Sinal: R$ {Number(s.advance_payment_value).toFixed(2).replace(".", ",")}</span>
                  </>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2 pr-4 border-r border-border">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter hidden sm:block">Status</span>
                    <Switch checked={s.active} onCheckedChange={() => toggleMutation.mutate({ id: s.id, active: !s.active })} disabled={toggleMutation.isPending} />
                </div>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl" onClick={() => openEdit(s)}>
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl" onClick={() => { if(confirm("Deletar este serviço permanentemente? Se houver agendamentos vinculados, prefira desativar.")) deleteMutation.mutate(s.id); }} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-md shadow-2xl">
          <DialogHeader className="border-b border-border/50 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black font-display">
                <Scissors className="text-primary h-6 w-6" /> {editing ? "Ajustar Serviço" : "Novo Serviço"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome do Serviço</label>
                    <Input placeholder="Ex: Corte Degradê, Barba Terapia..." value={name} onChange={(e) => setName(e.target.value)} className="bg-background border-border h-12 text-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Preço Final (R$)</label>
                        <Input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-background border-border h-12 font-mono text-primary font-bold" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tempo Médio (Minutos)</label>
                        <Input type="number" placeholder="30" value={duration} onChange={(e) => setDuration(e.target.value)} className="bg-background border-border h-12 text-foreground font-bold" />
                    </div>
                </div>
                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2">
                     <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                        <p className="text-xs font-bold text-emerald-300 uppercase tracking-tight">Sinal Obrigatório (Pagamento Online)</p>
                    </div>
                    <p className="text-[10px] text-emerald-500/80 font-medium -mt-1">O cliente deve pagar este valor para garantir o horário. Se for igual ao valor total, será cobrança integral.</p>
                    <div className="pt-2">
                        <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 block">Valor do Adiantamento (R$)</label>
                        <Input type="number" placeholder="0.00" value={advanceValue} onChange={(e) => setAdvanceValue(e.target.value)} className="bg-background border-emerald-500/30 h-11 font-mono text-emerald-400 font-bold" />
                    </div>
                </div>
            </div>
            <Button
              className="w-full gold-gradient text-primary-foreground font-black h-14 rounded-2xl shadow-gold transition-all active:scale-95"
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
