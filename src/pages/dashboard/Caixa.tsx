import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart, Loader2, Search, Plus, Trash2, CheckCircle, Receipt, AlertTriangle, RefreshCw, X, Minus
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

// ... (Interfaces permanecem iguais)

const Caixa = () => {
  const { barbershop } = useBarbershop() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [payMethod, setPayMethod] = useState("cash");
  const [productSearch, setProductSearch] = useState("");

  // --- BUSCAS (TANSTACK QUERY) ---
  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ["daily-appointments", barbershop?.id],
    queryFn: async () => {
      const todayStr = format(new Date(), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .gte("scheduled_at", `${todayStr}T00:00:00`)
        .lte("scheduled_at", `${todayStr}T23:59:59`)
        .neq("status", "cancelled")
        .order("scheduled_at");
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
  });

  const { data: inventory = [] } = useQuery({
    queryKey: ["inventory-pdv", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("barbershop_id", barbershop?.id)
        .eq("active", true);
      if (error) throw error;
      return data;
    },
    enabled: !!barbershop?.id,
  });

  // --- CÁLCULO DINÂMICO DO TOTAL (RESOLVE O SEU BUG) ---
  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (Number(item.price) * item.qty), 0);
  }, [cart]);

  // --- MUTAÇÃO DE CHECKOUT ---
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAppt || !barbershop) return;

      // 1. Criar a Ordem de Venda
      const { error: orderError } = await supabase.from("orders").insert({
        barbershop_id: barbershop.id,
        appointment_id: selectedAppt.id,
        items: cart,
        total: cartTotal, // Usa o total calculado corrigido
        payment_method: payMethod,
        status: "closed"
      });
      if (orderError) throw orderError;

      // 2. Concluir Agendamento
      await supabase.from("appointments").update({
        status: "completed",
        payment_status: "paid",
        total_price: cartTotal
      }).eq("id", selectedAppt.id);

      // 3. Atualizar Estoque (Loop de Baixa)
      for (const item of cart) {
        if (item.type === "product") {
          const { data: current } = await supabase.from("inventory").select("quantity").eq("id", item.product_id).single();
          if (current) {
            await supabase.from("inventory").update({ quantity: current.quantity - item.qty }).eq("id", item.product_id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["daily-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-pdv"] });
      toast({ title: "Venda Processada!", description: `Valor Total: R$ ${cartTotal.toFixed(2)}` });
      setSelectedAppt(null);
      setCart([]);
    }
  });

  const addProductToCart = (p: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) {
        return prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { name: p.name, price: Number(p.sell_price), qty: 1, type: "product", product_id: p.id }];
    });
  };

  return (
    <div className="w-full max-w-full p-6 animate-in fade-in duration-500">
      {/* Interface de busca de clientes (Mantida mas estilizada) */}
      <h1 className="text-3xl font-black text-white mb-8 flex items-center gap-3">
        <ShoppingCart className="text-cyan-500" /> Frente de Caixa
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LISTA DE FILA */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 h-4 w-4" />
            <Input 
              placeholder="Localizar cliente para cobrar..." 
              className="bg-slate-900 border-slate-800 pl-11 h-12 rounded-2xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {appointments.filter((a:any) => a.client_name.toLowerCase().includes(search.toLowerCase())).map((a:any) => (
            <div key={a.id} className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between group hover:border-cyan-500/30 transition-all">
              <div>
                <p className="font-bold text-white">{a.client_name}</p>
                <p className="text-[10px] text-slate-500 uppercase font-black">{a.service_name} &bull; R$ {a.price}</p>
              </div>
              <Button 
                onClick={() => {
                  setSelectedAppt(a);
                  setCart([{ name: a.service_name, price: a.price, qty: 1, type: "service" }]);
                }}
                disabled={a.status === 'completed'}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl"
              >
                {a.status === 'completed' ? 'Já Pago' : 'Cobrar'}
              </Button>
            </div>
          ))}
        </div>

        {/* ÁREA DE CHECKOUT (SELECIONADO) */}
        {selectedAppt && (
          <div className="bg-slate-900 border border-cyan-500/20 rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-white">Comanda Atual</h2>
                <p className="text-cyan-500 text-xs font-bold uppercase tracking-widest">{selectedAppt.client_name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAppt(null)} className="rounded-full text-slate-500">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* ITENS NO CARRINHO */}
            <div className="space-y-3 mb-8">
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div>
                    <p className="text-sm font-bold text-white">{item.name}</p>
                    <p className="text-[10px] text-slate-500">R$ {item.price.toFixed(2)} un.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-800">
                      <button onClick={() => setCart(prev => prev.map((it, i) => i === idx ? {...it, qty: Math.max(1, it.qty - 1)} : it))} className="p-1 hover:text-cyan-400"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center text-xs font-black">{item.qty}</span>
                      <button onClick={() => setCart(prev => prev.map((it, i) => i === idx ? {...it, qty: it.qty + 1} : it))} className="p-1 hover:text-cyan-400"><Plus className="h-3 w-3" /></button>
                    </div>
                    <p className="text-sm font-black text-white w-20 text-right">R$ {(item.price * item.qty).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* BUSCA DE PRODUTOS */}
            <div className="mb-8">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Adicionar Produto à Comanda</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {inventory.map(p => (
                  <button key={p.id} onClick={() => addProductToCart(p)} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-cyan-500/50 transition-all text-left">
                    <div>
                      <p className="text-[11px] font-bold text-white truncate">{p.name}</p>
                      <p className="text-[9px] text-slate-600">Qtd: {p.quantity}</p>
                    </div>
                    <span className="text-[11px] font-black text-emerald-400">R${p.sell_price}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* FECHAMENTO */}
            <div className="pt-6 border-t border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Forma de Pagamento</span>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger className="w-40 bg-slate-950 border-slate-800 h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b1224] border-slate-800 text-white">
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">Pix (Manual)</SelectItem>
                    <SelectItem value="card">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xl font-black text-white">Total</span>
                <span className="text-4xl font-black text-cyan-400 tracking-tighter">R$ {cartTotal.toFixed(2).replace(".", ",")}</span>
              </div>
              <Button 
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-lg shadow-xl shadow-emerald-900/20"
              >
                {checkoutMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle className="h-6 w-6 mr-2" />}
                Finalizar e Baixar Estoque
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Caixa;
