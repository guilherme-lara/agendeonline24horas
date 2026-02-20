import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TrendingDown, Plus, Loader2, Trash2, PiggyBank } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  created_at: string;
}

const categories = [
  { value: "aluguel", label: "Aluguel" },
  { value: "produtos", label: "Produtos" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "marketing", label: "Marketing" },
  { value: "salarios", label: "Salários" },
  { value: "agua_luz", label: "Água/Luz" },
  { value: "outros", label: "Outros" },
];

const catColors: Record<string, string> = {
  aluguel: "text-red-400",
  produtos: "text-blue-400",
  equipamentos: "text-purple-400",
  marketing: "text-orange-400",
  salarios: "text-yellow-400",
  agua_luz: "text-cyan-400",
  outros: "text-muted-foreground",
};

const Despesas = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [category, setCategory] = useState("outros");
  const [saving, setSaving] = useState(false);
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));

  const fetchExpenses = async () => {
    if (!barbershop) return;
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("date", { ascending: false });
    setExpenses((data as Expense[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, [barbershop]);

  const handleCreate = async () => {
    if (!barbershop || !description.trim() || !amount) return;
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      barbershop_id: barbershop.id,
      description: description.trim(),
      amount: Number(amount),
      date,
      category,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Despesa registrada!" });
      setOpen(false);
      setDescription("");
      setAmount("");
      fetchExpenses();
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("expenses").delete().eq("id", id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Despesa removida" });
  };

  const filtered = expenses.filter((e) => e.date.startsWith(monthFilter));
  const totalMonth = filtered.reduce((s, e) => s + Number(e.amount), 0);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-primary" /> Despesas
          </h1>
          <p className="text-sm text-muted-foreground">Controle financeiro de saídas</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gold-gradient text-primary-foreground font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Nova Despesa
        </Button>
      </div>

      {/* Month filter + summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Total do Mês</p>
          <p className="font-display text-2xl font-bold text-destructive">
            R$ {totalMonth.toFixed(2).replace(".", ",")}
          </p>
          <p className="text-xs text-muted-foreground">{filtered.length} lançamentos</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <PiggyBank className="h-8 w-8 text-primary" />
          <div>
            <p className="text-xs text-muted-foreground">Filtrar mês</p>
            <Input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <TrendingDown className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">Nenhuma despesa neste mês</h3>
          <p className="text-sm text-muted-foreground mb-4">Registre as saídas financeiras da barbearia.</p>
          <Button onClick={() => setOpen(true)} variant="outline">Registrar Despesa</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => (
            <div key={e.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{e.description}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(e.date + "T00:00"), "dd/MM/yyyy", { locale: ptBR })} ·{" "}
                  <span className={catColors[e.category] || "text-muted-foreground"}>
                    {categories.find((c) => c.value === e.category)?.label || e.category}
                  </span>
                </p>
              </div>
              <span className="font-bold text-destructive whitespace-nowrap">
                R$ {Number(e.amount).toFixed(2).replace(".", ",")}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(e.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
            <Input type="number" placeholder="Valor (R$)" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              className="w-full gold-gradient text-primary-foreground font-semibold"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar Despesa
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Despesas;
