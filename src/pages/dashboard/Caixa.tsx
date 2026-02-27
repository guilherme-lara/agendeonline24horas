import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart, Loader2, Search, Plus, Trash2, CheckCircle, Receipt, AlertTriangle, RefreshCw, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
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
  const queryClient = useQueryClient();

  // Estados de UI
  const [search, setSearch] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payMethod, setPayMethod] = useState("cash");
  const [productSearch, setProductSearch] = useState("");

  // --- BUSCA DE AGENDAMENTOS DO DIA (TANSTACK QUERY) ---
  const { data: appointments = [], isLoading: loadingAppts, isError: errorAppts } = useQuery({
    queryKey: ["daily-appointments", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_name, client_phone, service_name, barber_name, price, scheduled_at, status")
        .eq("barbershop_id", barbershop.id)
        .gte("scheduled_at", `${todayStr}T00:00:00`)
        .lte("scheduled_at", `${todayStr}T23:59:59`)
        .in("status", ["confirmed", "pending", "completed"])
        .order("scheduled_at");
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!barbershop?.id,
    refetchOnWindowFocus: true, // Sincroniza ao voltar para a aba
  });

  // --- BUSCA DE ESTOQUE (TANSTACK QUERY) ---
  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory-pdv", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("id, name, sell_price, quantity")
        .eq("barbershop_id", barbershop?.id)
        .eq("active", true)
        .gt("quantity", 0);
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!barbershop?.id,
  });

  // --- MUTAÇÃO: FINALIZAR ATENDIMENTO ---
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Recarregando...");
      if (!selectedAppt || !barbershop) return;

      const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

      // 1. Criar Comanda (Orders)
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

      // 2. Atualizar Agendamento
      await supabase.from("appointments").update({
        status: "completed",
        payment_status: "paid",
        total_price: total,
      }).eq("id", selectedAppt.id);

      // 3. Baixa de Estoque
      for (const item of cart) {
        if (item.type === "product" && item.product_id) {
          const prod = inventory.find((p) => p.id === item.product_id);
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
      return total;
    },
    onSuccess: (total) => {
      queryClient.invalidateQueries({ queryKey: ["daily-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-pdv"] });
      toast({ title: "Atendimento Finalizado!", description: `Total: R$ ${total?.toFixed(2).replace(".", ",")}` });
      setSelectedAppt(null);
      setCart([]);
    },
    onError: (err: any) => {
      toast({ title: "Erro no Checkout", description: err.message, variant: "destructive" });
    }
  });

  // --- LÓGICA DO CARRINHO ---
  const openCheckout = (appt: Appointment) => {
    setSelectedAppt(appt);
    setCart([{ name: appt.service_name, price: Number(appt.price), qty: 1, type: "service" }]);
    setPayMethod("cash");
  };

  const addProductToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === p.id);
      if (existing) return prev.map((i) => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { name: p.name, price: Number(p.sell_price), qty: 1, type: "product", product_id: p.id }];
    });
  };

  const filteredAppts = useMemo(() => {
    return appointments.filter((a) => {
      const q = search.toLowerCase();
      return !search.trim() || a.client_name.toLowerCase().includes(q) || a.service_name.toLowerCase().includes(q);
    });
  }, [appointments, search]);

  const filteredProducts = useMemo(() => {
    return inventory.filter((p) => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.toLowerCase()));
  }, [inventory, productSearch]);

  const cartTotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

  // --- RENDERS DE PROTEÇÃO ---
  if (loadingAppts) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>;

  if (errorAppts) return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Erro de sincronização</h2>
      <p className="text-sm text-slate-400 mb-8">Não conseguimos conectar ao seu caixa. Verifique a internet.</p>
      <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["daily-appointments"] })} className="gold-gradient px-8 font-bold">
        <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
      </Button>
    </div>
  );

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
          <ShoppingCart className="h-8 w-8 text-cyan-400" /> Frente de Caixa
        </h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">
          {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })} &bull; {filteredAppts.length} atendimentos registrados hoje
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cliente na fila..."
          className="bg-slate-900/40 border-slate-800 pl-11 h-12 text-white placeholder:text-slate-600 focus-visible:ring-cyan-500/50"
        />
      </div>

      {filteredAppts.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-16 text-center backdrop-blur-sm">
          <Receipt className="h-10 w-10 text-slate-700 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Caixa vazio</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">Os atendimentos agendados para hoje aparecerão aqui para cobrança.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredAppts.map((a) => (
            <div key={a.id} className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-all shadow-lg backdrop-blur-sm">
              <div className="flex items-center gap-4">
                 <div className="h-10 w-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-xs font-bold text-cyan-400 uppercase">
                    {a.client_name.slice(0,2)}
                 </div>
                 <div>
                    <p className="font-bold text-white leading-tight">{a.client_name}</p>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                      <span className="text-cyan-500">{a.service_name}</span>
                      <span>&bull;</span>
                      <span>{format(parseISO(a.scheduled_at), "HH:mm")}</span>
                      <span>&bull;</span>
                      <span className="text-emerald-500">R$ {Number(a.price).toFixed(2).replace(".", ",")}</span>
                    </div>
                 </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={a.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                }>
                  {a.status === "completed" ? "Pago" : "Aberto"}
                </Badge>
                {a.status !== "completed" && (
                  <Button onClick={() => openCheckout(a)} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-10 px-6 rounded-xl shadow-lg shadow-cyan-900/20">
                    <ShoppingCart className="h-4 w-4 mr-2" /> Abrir Checkout
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CHECKOUT PDV */}
      <Dialog open={!!selectedAppt} onOpenChange={(v) => { if (!v) setSelectedAppt(null); }}>
        <DialogContent className="bg-[#0b1224] border-slate-800 text-white max-w-lg shadow-2xl">
          <DialogHeader className="border-b border-slate-800/50 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black">
              <ShoppingCart className="text-cyan-400 h-6 w-6" /> Finalizar Atendimento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* CLIENTE E ITENS */}
            <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
               <div className="p-3 border-b border-slate-800 bg-slate-900/50">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Cliente</p>
                  <p className="font-bold text-white">{selectedAppt?.client_name}</p>
               </div>
               <div className="p-3 space-y-2">
                  {cart.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-xs group">
                      <div className="flex items-center gap-2">
                         <span className="text-slate-300 font-medium">{item.name}</span>
                         <Badge variant="outline" className="h-4 text-[8px] border-slate-700 text-slate-500">{item.type === "service" ? "Srv" : "Prod"}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-cyan-400 font-black">{item.qty > 1 ? `${item.qty}x ` : ""}R$ {(item.price * item.qty).toFixed(2).replace(".", ",")}</span>
                        {item.type === "product" && (
                          <button onClick={() => setCart(c => c.filter((_, idx) => idx !== i))} className="text-red-500/40 hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* ADICIONAR PRODUTOS RÁPIDO */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Adicionar Extras (Venda Cruzada)</label>
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Pesquisar pomada, bebida..."
                className="bg-slate-950 border-slate-800 h-10 text-xs"
              />
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addProductToCart(p)}
                    className="w-full flex items-center justify-between p-2 bg-slate-950/50 border border-slate-800 rounded-lg hover:border-cyan-500/30 transition-all text-left"
                  >
                    <div>
                        <p className="text-xs font-bold text-white">{p.name}</p>
                        <p className="text-[9px] text-slate-500">Disponível: {p.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-cyan-400">R$ {Number(p.sell_price).toFixed(2).replace(".", ",")}</span>
                        <div className="h-6 w-6 bg-cyan-500/10 rounded flex items-center justify-center text-cyan-400"><Plus className="h-3 w-3" /></div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* MEIO DE PAGAMENTO E TOTAL */}
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pagamento</label>
                    <Select value={payMethod} onValueChange={setPayMethod}>
                      <SelectTrigger className="bg-slate-950 border-slate-800 h-11"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-[#0b1224] border-slate-800 text-white">
                        <SelectItem value="cash">Dinheiro</SelectItem>
                        <SelectItem value="pix">Pix (Manual)</SelectItem>
                        <SelectItem value="card">Cartão</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 text-right">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total a Pagar</p>
                    <p className="text-2xl font-black text-white">R$ {cartTotal.toFixed(2).replace(".", ",")}</p>
                </div>
            </div>

            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 rounded-xl shadow-xl shadow-emerald-900/20"
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending || cart.length === 0}
            >
              {checkoutMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle className="h-5 w-5 mr-2" />}
              Finalizar Venda
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Caixa;
