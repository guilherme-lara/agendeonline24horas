import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Plus, Loader2, Trash2, CheckCircle, AlertTriangle, RefreshCw, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Order {
  id: string; barber_name: string; total: number; payment_method: string;
  status: string; notes: string; created_at: string;
  items: { name: string; price: number; qty: number }[];
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  open: { label: "Aberta", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  closed: { label: "Fechada", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelada", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const Comandas = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [barberName, setBarberName] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [draftItems, setDraftItems] = useState<{ name: string; price: number; qty: number }[]>([]);
  const queryEnabled = !!barbershop?.id;

  const { data: orders = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["orders", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase.from("orders").select("*").eq("barbershop_id", barbershop.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Order[];
    },
    enabled: !!barbershop?.id,
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada.");
      if (!barbershop) return;
      const totalValue = draftItems.reduce((s, i) => s + i.price * i.qty, 0);
      const { error } = await supabase.from("orders").insert({ barbershop_id: barbershop.id, barber_name: barberName, items: draftItems, total: totalValue, payment_method: payMethod, notes, status: "open" });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); toast({ title: "Comanda Aberta!" }); setIsDialogOpen(false); resetForm(); },
    onError: (err: any) => { toast({ title: "Erro ao criar", description: err.message, variant: "destructive" }); }
  });

  const closeOrderMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("orders").update({ status: "closed" }).eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["orders"] }); toast({ title: "Comanda Fechada" }); },
    onError: (err: any) => { toast({ title: "Erro ao fechar", description: err.message, variant: "destructive" }); }
  });

  const resetForm = () => { setBarberName(""); setPayMethod("cash"); setNotes(""); setDraftItems([]); };
  const addItemToDraft = () => { if (!itemName.trim() || !itemPrice) return; setDraftItems((prev) => [...prev, { name: itemName.trim(), price: Number(itemPrice), qty: 1 }]); setItemName(""); setItemPrice(""); };
  const draftTotal = useMemo(() => draftItems.reduce((s, i) => s + i.price * i.qty, 0), [draftItems]);

  if (isLoading && queryEnabled && !orders.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Carregando comandas...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronização</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar as comandas.</p>
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
            <Ticket className="h-8 w-8 text-primary" /> Registro de Comandas
          </h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">Gerencie o fluxo financeiro físico da sua barbearia em tempo real.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="gold-gradient text-primary-foreground font-bold h-12 px-6 rounded-xl shadow-gold">
          <Plus className="h-5 w-5 mr-2" /> Abrir Nova Comanda
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-16 text-center shadow-card">
          <Ticket className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-foreground mb-2">Sem comandas no histórico</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">Comece a registrar seus atendimentos manuais clicando no botão acima.</p>
          <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="border-border text-muted-foreground hover:text-foreground">Criar Primeira Comanda</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {orders.map((o) => (
            <div key={o.id} className="group flex flex-col justify-between rounded-2xl border border-border bg-card p-5 hover:border-primary/20 transition-all shadow-card">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-foreground text-lg leading-tight">{o.barber_name || "Sem profissional"}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      {format(parseISO(o.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Badge className={`${statusConfig[o.status]?.cls} border font-black text-[10px] uppercase px-2 py-0.5`}>
                    {statusConfig[o.status]?.label}
                  </Badge>
                </div>
                <div className="bg-background/50 rounded-xl p-3 space-y-2 border border-border/50">
                  {o.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs font-medium">
                      <span className="text-muted-foreground">{item.name} <span className="text-[10px] opacity-50 ml-1">x{item.qty}</span></span>
                      <span className="text-foreground">R$ {Number(item.price).toFixed(2).replace(".", ",")}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/50">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Valor Total</span>
                    <span className="font-black text-primary text-xl tracking-tight">R$ {Number(o.total).toFixed(2).replace(".", ",")}</span>
                </div>
                {o.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => closeOrderMutation.mutate(o.id)} disabled={closeOrderMutation.isPending}
                    className="border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500 hover:text-white font-bold rounded-lg transition-all h-9 px-4">
                    {closeOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                    Fechar Comanda
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(v) => { if(!v) setIsDialogOpen(false); }}>
        <DialogContent className="bg-card border-border text-foreground max-w-md shadow-2xl">
          <DialogHeader className="border-b border-border/50 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black font-display">
                <Ticket className="text-primary h-6 w-6" /> Abertura de Comanda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Profissional Responsável</label>
                    <Input placeholder="Ex: Roberto Barbeiro" value={barberName} onChange={(e) => setBarberName(e.target.value)} className="bg-background border-border h-11" />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Forma de Recebimento</label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger className="bg-background border-border h-11"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover border-border text-popover-foreground">
                        <SelectItem value="cash">💵 Dinheiro</SelectItem>
                        <SelectItem value="pix">📱 Pix</SelectItem>
                        <SelectItem value="card">💳 Cartão</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="bg-background/50 rounded-xl border border-border p-4 space-y-4">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block border-b border-border pb-2">Itens Consumidos</label>
              <div className="flex gap-2">
                <Input placeholder="Corte, Pomada, etc" value={itemName} onChange={(e) => setItemName(e.target.value)} className="bg-secondary border-border text-xs h-10" />
                <Input placeholder="R$" type="number" className="w-24 bg-secondary border-border text-xs h-10" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
                <Button variant="outline" onClick={addItemToDraft} className="border-primary/30 text-primary hover:bg-primary/10 h-10 w-10 p-0"><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {draftItems.map((it, i) => (
                  <div key={i} className="flex justify-between items-center text-xs bg-secondary rounded-lg px-3 py-2 border border-border/50">
                    <span className="text-foreground/80 font-bold">{it.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-primary font-black">R$ {it.price.toFixed(2).replace(".", ",")}</span>
                      <button onClick={() => setDraftItems((p) => p.filter((_, j) => j !== i))} className="text-red-500/40 hover:text-red-500 transition-colors"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
              {draftItems.length > 0 && (
                <div className="flex justify-between items-center font-black pt-2 border-t border-border text-sm">
                  <span className="text-muted-foreground uppercase text-[10px] tracking-widest">Subtotal</span>
                  <span className="text-foreground text-lg">R$ {draftTotal.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
                 <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Observações Adicionais</label>
                 <Input placeholder="Detalhes do corte ou produto..." value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-background border-border h-11 text-xs" />
            </div>
            <Button
              className="w-full gold-gradient text-primary-foreground font-bold h-12 rounded-xl shadow-gold transition-all active:scale-95"
              onClick={() => createOrderMutation.mutate()} disabled={createOrderMutation.isPending || draftItems.length === 0}>
              {createOrderMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              Lançar Comanda no Sistema
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Comandas;