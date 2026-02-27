import { useEffect, useState, useCallback } from "react";
import {
  ShoppingCart, Loader2, Search, Plus, Trash2, CheckCircle, Receipt, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Appointment {
  id: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  barber_name: string;
  price: number;
  scheduled_at: string;
  status: string;
}

interface Product {
  id: string;
  name: string;
  sell_price: number;
  quantity: number;
}

interface CartItem {
  name: string;
  price: number;
  qty: number;
  type: "service" | "product";
  product_id?: string;
}

const Caixa = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // <-- Estado de erro isolado
  const [search, setSearch] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payMethod, setPayMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  // <-- FUNÇÃO BLINDADA COM TRY/CATCH/FINALLY -->
  const loadCaixaData = useCallback(async () => {
    if (!barbershop) return;
    setLoading(true);
    setError(false);

    try {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      
      const [apptRes, prodRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, client_name, client_phone, service_name, barber_name, price, scheduled_at, status")
          .eq("barbershop_id", barbershop.id)
          .gte("scheduled_at", `${todayStr}T00:00:00`)
          .lte("scheduled_at", `${todayStr}T23:59:59`)
          .in("status", ["confirmed", "pending", "completed"])
          .order("scheduled_at"),
        supabase
          .from("inventory")
          .select("id, name, sell_price, quantity")
          .eq("barbershop_id", barbershop.id)
          .eq("active", true)
          .gt("quantity", 0),
      ]);

      if (apptRes.error) throw apptRes.error;
      if (prodRes.error) throw prodRes.error;

      setAppointments((apptRes.data as Appointment[]) || []);
      setProducts((prodRes.data as Product[]) || []);
    } catch (err) {
      console.error("Erro ao carregar dados do caixa:", err);
      setError(true);
    } finally {
      setLoading(false); // A MÁGICA: Independente de dar erro, o skeleton desliga
    }
  }, [barbershop]);

  useEffect(() => {
    loadCaixaData();
  }, [loadCaixaData]);

  const openCheckout = (appt: Appointment) => {
    setSelectedAppt(appt);
    setCart([{ name: appt.service_name, price: Number(appt.price), qty: 1, type: "service" }]);
    setPayMethod("cash");
  };

  const addProduct = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) {
        return prev.map((i) => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { name: p.name, price: Number(p.sell_price), qty: 1, type: "product", product_id: p.id }];
    });
  };

  const removeItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const handleFinalize = async () => {
    if (!barbershop || !selectedAppt) return;
    setSaving(true);

    try {
      // Create order (comanda) linked to appointment
      const { error: orderError } = await supabase.from("orders").insert([{
        barbershop_id: barbershop.id,
        appointment_id: selectedAppt.id,
        barber_name: selectedAppt.barber_name,
        items: cart as any,
        total,
        payment_method: payMethod,
        status: "closed",
      }]);

      if (orderError) throw orderError;

      // Update appointment to completed with total_price
      const { error: apptError } = await supabase.from("appointments").update({
        status: "completed",
        payment_status: "paid",
        total_price: total,
      }).eq("id", selectedAppt.id);

      if (apptError) throw apptError;

      // Deduct product stock
      for (const item of cart) {
        if (item.type === "product" && item.product_id) {
          const prod = products.find((p) => p.id === item.product_id);
          if (prod) {
            await supabase.from("inventory").update({ quantity: prod.quantity - item.qty }).eq("id", prod.id);
            await supabase.from("stock_movements").insert({
              barbershop_id: barbershop.id,
              inventory_id: item.product_id,
              type: "sale",
              quantity: -item.qty,
              notes: `Venda PDV - ${selectedAppt.client_name}`,
            });
          }
        }
      }

      toast({ title: "Atendimento finalizado!", description: `Total: R$ ${total.toFixed(2).replace(".", ",")}` });
      setSelectedAppt(null);
      setCart([]);
      
      // Ao invés de repetir código de busca, apenas chamamos nossa função blindada
      await loadCaixaData();
      
    } catch (err: any) {
      console.error("Erro ao finalizar:", err);
      toast({ title: "Erro", description: err.message || "Falha ao finalizar venda.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // <-- TELAS DE PROTEÇÃO -->
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  // TELA DE ERRO (Adeus F5!)
  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="font-display text-xl font-bold mb-2">Falha na conexão</h2>
      <p className="text-sm text-muted-foreground mb-6">Não foi possível carregar os dados do caixa.</p>
      <Button onClick={loadCaixaData} className="gold-gradient text-primary-foreground font-semibold px-8">
        Tentar Novamente
      </Button>
    </div>
  );

  if (!barbershop) return null;

  const filteredAppts = appointments.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.client_name.toLowerCase().includes(q) || a.service_name.toLowerCase().includes(q);
  });

  const filteredProducts = products.filter((p) =>
    !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-primary" /> Caixa / PDV
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} · {filteredAppts.length} atendimentos
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente ou serviço..."
          className="bg-card border-border pl-10"
        />
      </div>

      {/* Appointments list */}
      {filteredAppts.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">Nenhum atendimento hoje</h3>
          <p className="text-sm text-muted-foreground">Os agendamentos do dia aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAppts.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
              <div>
                <p className="font-medium">{a.client_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{a.service_name}</span>
                  <span>·</span>
                  <span>{format(new Date(a.scheduled_at), "HH:mm")}</span>
                  <span>·</span>
                  <span>R$ {Number(a.price).toFixed(2).replace(".", ",")}</span>
                </div>
                {a.barber_name && <p className="text-xs text-muted-foreground mt-0.5">{a.barber_name}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge className={a.status === "completed"
                  ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
                }>
                  {a.status === "completed" ? "Finalizado" : "Aberto"}
                </Badge>
                {a.status !== "completed" && (
                  <Button size="sm" onClick={() => openCheckout(a)} className="gold-gradient text-primary-foreground font-semibold">
                    <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Abrir Caixa
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Checkout Dialog */}
      <Dialog open={!!selectedAppt} onOpenChange={(v) => { if (!v) setSelectedAppt(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Caixa — {selectedAppt?.client_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cart items */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Itens</p>
              {cart.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-secondary rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">{item.type === "service" ? "Serviço" : "Produto"}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-medium">
                      {item.qty > 1 ? `${item.qty}x ` : ""}R$ {(item.price * item.qty).toFixed(2).replace(".", ",")}
                    </span>
                    {item.type === "product" && (
                      <button onClick={() => removeItem(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add products */}
            <div>
              <p className="text-sm font-medium mb-2">Adicionar Produto</p>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="mb-2"
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProduct(p)}
                    className="w-full flex items-center justify-between text-sm bg-card border border-border rounded-lg px-3 py-2 hover:border-primary/40 transition-colors"
                  >
                    <span>{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Estoque: {p.quantity}</span>
                      <span className="text-primary font-medium">R$ {Number(p.sell_price).toFixed(2).replace(".", ",")}</span>
                      <Plus className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum produto encontrado</p>
                )}
              </div>
            </div>

            {/* Payment method */}
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
              </SelectContent>
            </Select>

            {/* Total */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="font-bold text-lg">Total</span>
              <span className="font-display text-2xl font-bold text-primary">
                R$ {total.toFixed(2).replace(".", ",")}
              </span>
            </div>

            <Button
              className="w-full gold-gradient text-primary-foreground font-semibold"
              onClick={handleFinalize}
              disabled={saving || cart.length === 0}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              Finalizar Atendimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Caixa;
