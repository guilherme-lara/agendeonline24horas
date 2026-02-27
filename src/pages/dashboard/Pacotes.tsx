import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PackageCheck, Plus, Loader2, Pencil, Trash2, AlertTriangle, RefreshCw, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Package {
  id: string;
  name: string;
  price: number;
  quantity: number;
  service_id: string | null;
  description: string;
  active: boolean;
}

interface Service {
  id: string;
  name: string;
}

const Pacotes = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados de UI para o formulário
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [serviceId, setServiceId] = useState("none");
  const [description, setDescription] = useState("");

  // --- BUSCA DE DADOS (TANSTACK QUERY) ---
  const { data: packages = [], isLoading: loadingPkgs, isError, refetch } = useQuery({
    queryKey: ["packages", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase
        .from("packages")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .order("name");
      if (error) throw error;
      return data as Package[];
    },
    enabled: !!barbershop?.id,
    refetchOnWindowFocus: true, // Sincroniza ao voltar para a aba
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services-list", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name")
        .eq("barbershop_id", barbershop?.id)
        .eq("active", true);
      if (error) throw error;
      return data as Service[];
    },
    enabled: !!barbershop?.id,
  });

  // --- MUTAÇÃO: SALVAR/EDITAR PACOTE ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Recarregando...");

      const payload = {
        name: name.trim(),
        price: Number(price),
        quantity: Number(quantity),
        service_id: serviceId === "none" ? null : serviceId,
        description,
        barbershop_id: barbershop?.id
      };

      if (editing) {
        const { error } = await supabase.from("packages").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("packages").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast({ title: editing ? "Pacote Atualizado!" : "Pacote Criado!" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    }
  });

  // --- MUTAÇÃO: ALTERAR STATUS / EXCLUIR ---
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string, active: boolean }) => {
      const { error } = await supabase.from("packages").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["packages"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["packages"] });
      toast({ title: "Pacote removido com sucesso." });
    },
  });

  // --- LÓGICA DO FORMULÁRIO ---
  const openNew = () => {
    setEditing(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = (p: Package) => {
    setEditing(p);
    setName(p.name);
    setPrice(String(p.price));
    setQuantity(String(p.quantity));
    setServiceId(p.service_id || "none");
    setDescription(p.description || "");
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setName(""); setPrice(""); setQuantity("1"); setServiceId("none"); setDescription("");
  };

  // --- RENDERS DE PROTEÇÃO ---
  if (loadingPkgs && !packages.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse uppercase tracking-widest font-bold">Organizando combos...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Erro de sincronização</h2>
        <p className="text-sm text-slate-400 mb-8">Não conseguimos carregar seus pacotes promocionais.</p>
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
            <PackageCheck className="h-8 w-8 text-cyan-400" /> Gestão de Pacotes
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Crie ofertas irresistíveis para fidelizar seus clientes recorrentes.</p>
        </div>
        <Button onClick={openNew} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-cyan-900/20 transition-all active:scale-95">
          <Plus className="h-5 w-5 mr-2" /> Criar Novo Combo
        </Button>
      </div>

      {packages.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-16 text-center backdrop-blur-sm shadow-xl">
          <div className="bg-slate-950 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-800">
            <PackageCheck className="h-10 w-10 text-slate-700" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Nenhum pacote ativo</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto mb-6">Venda 4 cortes pelo preço de 3 e garanta o retorno do cliente o mês todo.</p>
          <Button onClick={openNew} variant="outline" className="border-slate-700 text-slate-400 hover:text-white">Montar Primeiro Pacote</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {packages.map((p) => {
            const svc = services.find((s) => s.id === p.service_id);
            return (
              <div key={p.id} className={`group flex flex-col justify-between rounded-2xl border transition-all duration-300 p-6 backdrop-blur-md shadow-lg ${!p.active ? "bg-slate-950/40 border-slate-900 opacity-60" : "bg-slate-900/40 border-slate-800 hover:border-cyan-500/30"}`}>
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-white text-lg tracking-tight leading-tight">{p.name}</h3>
                      {p.description && <p className="text-xs text-slate-500 mt-1 line-clamp-1 italic">{p.description}</p>}
                    </div>
                    <Badge variant="outline" className={`${p.active ? "border-cyan-500/30 text-cyan-400 bg-cyan-500/5" : "border-slate-700 text-slate-500"} font-black text-[9px] uppercase px-2 py-0.5`}>
                      {p.active ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 flex-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Recorrência</p>
                        <p className="text-xl font-black text-white">{p.quantity}<span className="text-xs text-slate-600 ml-1 font-bold">Sessões</span></p>
                    </div>
                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 flex-1">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Investimento</p>
                        <p className="text-xl font-black text-emerald-400">R$ {Number(p.price).toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>

                  {svc && (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-500/70 uppercase tracking-tighter">
                        <Check className="h-3 w-3" /> Válido para: {svc.name}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-6 pt-4 border-t border-slate-800/50">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="flex-1 border-slate-800 hover:bg-slate-800 text-slate-400 h-9 font-bold rounded-xl">
                    <Pencil className="h-3.5 w-3.5 mr-2" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => updateStatusMutation.mutate({ id: p.id, active: !p.active })} className="flex-1 border-slate-800 hover:bg-slate-800 text-slate-400 h-9 font-bold rounded-xl">
                    {p.active ? "Pausar" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => { if(confirm("Remover este pacote?")) deleteMutation.mutate(p.id); }} className="h-9 w-9 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DIALOG: NOVO/EDITAR PACOTE */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#0b1224] border-slate-800 text-white max-w-md shadow-2xl">
          <DialogHeader className="border-b border-slate-800/50 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black">
                <PackageCheck className="text-cyan-400 h-6 w-6" /> {editing ? "Ajustar Pacote" : "Configurar Novo Pacote"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-4">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nome do Combo</label>
                    <Input placeholder="Ex: Assinatura Mensal (4 cortes)" value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-950 border-slate-800 h-12" />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Descrição das Vantagens</label>
                    <Input placeholder="Ex: Ganhe uma cerveja por sessão" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-slate-950 border-slate-800 h-12 text-xs" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preço de Venda (R$)</label>
                        <Input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-slate-950 border-slate-800 h-12 font-mono text-emerald-400 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Número de Sessões</label>
                        <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="bg-slate-950 border-slate-800 h-12 text-white font-bold" />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Serviço Vinculado</label>
                    <Select value={serviceId} onValueChange={setServiceId}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 h-12"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#0b1224] border-slate-800 text-white">
                        <SelectItem value="none">Qualquer Serviço</SelectItem>
                        {services.map((s) => <SelectItem key={s.id} value={s.id} className="focus:bg-slate-800">{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                </div>
            </div>

            <Button
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-cyan-900/20 transition-all active:scale-95"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim()}
            >
              {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <PackageCheck className="h-5 w-5 mr-2" />}
              {editing ? "Salvar Alterações" : "Lançar Pacote no Sistema"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pacotes;
