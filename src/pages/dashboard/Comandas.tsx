import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Plus, Loader2, Trash2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Order {
  id: string;
  barber_name: string;
  total: number;
  payment_method: string;
  status: string;
  notes: string;
  created_at: string;
  items: { name: string; price: number; qty: number }[];
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  open: { label: "Aberta", cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  closed: { label: "Fechada", cls: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelada", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

const Comandas = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [barberName, setBarberName] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [items, setItems] = useState<{ name: string; price: number; qty: number }[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchOrders = async () => {
    if (!barbershop) return;
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("created_at", { ascending: false });
    setOrders((data as unknown as Order[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, [barbershop]);

  const addItem = () => {
    if (!itemName.trim() || !itemPrice) return;
    setItems((prev) => [...prev, { name: itemName.trim(), price: Number(itemPrice), qty: 1 }]);
    setItemName("");
    setItemPrice("");
  };

  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const handleCreate = async () => {
    if (!barbershop || items.length === 0) return;
    setSaving(true);
    const { error } = await supabase.from("orders").insert({
      barbershop_id: barbershop.id,
      barber_name: barberName,
      items,
      total,
      payment_method: payMethod,
      notes,
      status: "open",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Comanda criada!" });
      setOpen(false);
      setItems([]);
      setBarberName("");
      setNotes("");
      fetchOrders();
    }
  };

  const closeOrder = async (id: string) => {
    await supabase.from("orders").update({ status: "closed" }).eq("id", id);
    fetchOrders();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6 text-primary" /> Comandas
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie o checkout físico da barbearia</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gold-gradient text-primary-foreground font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Nova Comanda
        </Button>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Ticket className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">Nenhuma comanda ainda</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie sua primeira comanda para registrar um atendimento.</p>
          <Button onClick={() => setOpen(true)} variant="outline">Criar Comanda</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {orders.map((o) => (
            <div key={o.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{o.barber_name || "Sem profissional"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(o.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Badge className={statusConfig[o.status]?.cls}>{statusConfig[o.status]?.label}</Badge>
              </div>
              <div className="space-y-1">
                {(o.items as any[]).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.name} ×{item.qty}</span>
                    <span>R$ {Number(item.price).toFixed(2).replace(".", ",")}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="font-bold text-primary">R$ {Number(o.total).toFixed(2).replace(".", ",")}</span>
                {o.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => closeOrder(o.id)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Fechar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Comanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do profissional" value={barberName} onChange={(e) => setBarberName(e.target.value)} />
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-2">
              <p className="text-sm font-medium">Itens</p>
              <div className="flex gap-2">
                <Input placeholder="Serviço/Produto" value={itemName} onChange={(e) => setItemName(e.target.value)} />
                <Input placeholder="R$" type="number" className="w-24" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
                <Button variant="outline" onClick={addItem}><Plus className="h-4 w-4" /></Button>
              </div>
              {items.map((it, i) => (
                <div key={i} className="flex justify-between text-sm bg-secondary rounded px-3 py-2">
                  <span>{it.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-primary">R$ {it.price.toFixed(2).replace(".", ",")}</span>
                    <button onClick={() => setItems((p) => p.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                  </div>
                </div>
              ))}
              {items.length > 0 && (
                <div className="flex justify-between font-bold pt-2 border-t border-border">
                  <span>Total</span>
                  <span className="text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
                </div>
              )}
            </div>
            <Input placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button
              className="w-full gold-gradient text-primary-foreground font-semibold"
              onClick={handleCreate}
              disabled={saving || items.length === 0}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Criar Comanda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Comandas;
