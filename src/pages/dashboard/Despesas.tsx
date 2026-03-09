import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { TrendingDown, Plus, Loader2, CheckCircle, Trash2, PiggyBank, AlertTriangle, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Expense { id: string; description: string; amount: number; date: string; category: string; created_at: string; }

const categories = [
  { value: "aluguel", label: "Aluguel" }, { value: "produtos", label: "Produtos" },
  { value: "equipamentos", label: "Equipamentos" }, { value: "marketing", label: "Marketing" },
  { value: "salarios", label: "Salários" }, { value: "agua_luz", label: "Água/Luz" },
  { value: "outros", label: "Outros" },
];

const catColors: Record<string, string> = {
  aluguel: "text-red-400 bg-red-400/10 border-red-400/20",
  produtos: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  equipamentos: "text-purple-400 bg-purple-400/10 border-purple-400/20",
  marketing: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  salarios: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  agua_luz: "text-primary bg-primary/10 border-primary/20",
  outros: "text-muted-foreground bg-muted border-border",
};

const Despesas = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryEnabled = !!barbershop?.id;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState("outros");

  const { data: expenses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["expenses", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase.from("expenses").select("*").eq("barbershop_id", barbershop.id).order("date", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!barbershop?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("expenses").insert({ barbershop_id: barbershop?.id, description: description.trim(), amount: Number(amount), date, category });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); toast({ title: "Despesa Lançada!" }); setIsDialogOpen(false); resetForm(); },
    onError: (err: any) => { toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["expenses"] }); toast({ title: "Registro removido" }); },
    onError: (err: any) => { toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" }); }
  });

  const filteredExpenses = useMemo(() => expenses.filter((e) => e.date.startsWith(monthFilter)), [expenses, monthFilter]);
  const totalMonth = useMemo(() => filteredExpenses.reduce((s, e) => s + Number(e.amount), 0), [filteredExpenses]);
  const resetForm = () => { setDescription(""); setAmount(""); setDate(format(new Date(), "yyyy-MM-dd")); setCategory("outros"); };

  if (isLoading && queryEnabled && !expenses.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Analisando contas...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronização</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar o seu financeiro.</p>
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
            <TrendingDown className="h-8 w-8 text-red-400" /> Fluxo de Despesas
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">Controle rigoroso de todas as saídas da sua barbearia.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="bg-red-600 hover:bg-red-500 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-95">
          <Plus className="h-5 w-5 mr-2" /> Novo Lançamento
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-red-500/20 rounded-2xl p-6 shadow-card relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingDown className="h-12 w-12 text-red-500" /></div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total em Despesas (Mês Selecionado)</p>
          <p className="text-3xl font-black text-red-400 tracking-tighter">R$ {totalMonth.toFixed(2).replace(".", ",")}</p>
          <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase">{filteredExpenses.length} comprovantes registrados</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <PiggyBank className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Período de Análise</p>
            <Input type="month" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="bg-transparent border-none p-0 h-auto text-foreground font-bold focus-visible:ring-0 cursor-pointer" />
          </div>
        </div>
      </div>

      {filteredExpenses.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-16 text-center shadow-card">
          <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
            <TrendingDown className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma saída registrada</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Suas despesas do mês selecionado aparecerão aqui.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredExpenses.map((e) => (
            <div key={e.id} className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/20 transition-all shadow-card">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground text-lg truncate leading-tight">{e.description}</p>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{format(parseISO(e.date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    <span className="text-muted-foreground/30 font-bold">&bull;</span>
                    <Badge variant="outline" className={`${catColors[e.category] || "text-muted-foreground"} border-none text-[9px] uppercase font-black px-0`}>
                        {categories.find((c) => c.value === e.category)?.label || e.category}
                    </Badge>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-black text-red-400 text-xl tracking-tighter">- R$ {Number(e.amount).toFixed(2).replace(".", ",")}</span>
                <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all rounded-xl opacity-0 group-hover:opacity-100"
                    onClick={() => { if(confirm("Deseja remover este registro?")) deleteMutation.mutate(e.id); }} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(v) => { if(!v) setIsDialogOpen(false); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-md shadow-2xl">
          <DialogHeader className="border-b border-border/50 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black font-display">
                <TrendingDown className="text-red-400 h-6 w-6" /> Registrar Saída
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Descrição da Despesa</label>
                    <Input placeholder="Ex: Aluguel da Loja, Compra de Shampoos..." value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background border-border h-12" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Valor (R$)</label>
                        <Input type="number" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-background border-border h-12 font-mono text-red-400 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data do Pagamento</label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-background border-border h-12 text-foreground" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Categoria Financeira</label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-background border-border h-12"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                </div>
            </div>
            <Button
              className="w-full bg-red-600 hover:bg-red-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-red-900/20 transition-all active:scale-95"
              onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !description.trim() || !amount}>
              {createMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              Confirmar Lançamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Despesas;