import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart, Loader2, Search, Plus, Trash2, CheckCircle, Receipt, AlertTriangle, RefreshCw, X, Minus, Eye, CreditCard, Banknote, QrCode
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

const Caixa = () => {
  const { barbershop } = useBarbershop() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [payMethod, setPayMethod] = useState("cash");
  
  // Estado para o modal de visualização de detalhes
  const [viewDetailsAppt, setViewDetailsAppt] = useState<any | null>(null);
  const [orderDetails, setOrderDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

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

  // --- CÁLCULO DINÂMICO DO TOTAL ---
  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (Number(item.price) * item.qty), 0);
  }, [cart]);

  // --- MUTAÇÃO DE CHECKOUT ---
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAppt || !barbershop) return;

      const { error: orderError } = await supabase.from("orders").insert({
        barbershop_id: barbershop.id,
        appointment_id: selectedAppt.id,
        items: cart,
        total: cartTotal,
        payment_method: payMethod,
        status: "closed"
      });
      if (orderError) throw orderError;

      await supabase.from("appointments").update({
        status: "completed",
        payment_status: "paid",
        total_price: cartTotal
      }).eq("id", selectedAppt.id);

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

  // --- FUNÇÃO PARA BUSCAR DETALHES DA COMANDA ---
  const openDetails = async (appt: any) => {
    setViewDetailsAppt(appt);
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("appointment_id", appt.id)
        .maybeSingle();
      
      if (error) throw error;
      setOrderDetails(data);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível carregar os detalhes.", variant: "destructive" });
    } finally {
      setLoadingDetails(false);
    }
  };

  const getPaymentIcon = (method: string) => {
    switch(method) {
      case 'pix': return <QrCode className="h-4 w-4 text-cyan-400" />;
      case 'card': return <CreditCard className="h-4 w-4 text-cyan-400" />;
      default: return <Banknote className="h-4 w-4 text-emerald-400" />;
    }
  };

  const getPaymentName = (method: string) => {
    switch(method) {
      case 'pix': return "Pix";
      case 'card': return "Cartão";
      default: return "Dinheiro";
    }
  };

  return (
    <div className="w-full max-w-full p-6 animate-in fade-in duration-500">
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
                <p className="font-bold text-white flex items-center gap-2">
                  {a.client_name}
                  {a.status === 'completed' && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                </p>
                <p className="text-[10px] text-slate-500 uppercase font-black">{a.service_name} &bull; R$ {a.status === 'completed' ? a.total_price : a.price}</p>
              </div>
              
              {a.status === 'completed' ? (
                <Button 
                  variant="outline"
                  onClick={() => openDetails(a)}
                  className="border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 font-bold rounded-xl h-9 px-4"
                >
                  <Eye className="h-4 w-4 mr-2" /> Ver Detalhes
                </Button>
              ) : (
                <Button 
                  onClick={() => {
                    setSelectedAppt(a);
                    setCart([{ name: a.service_name, price: a.price, qty: 1, type: "service" }]);
                  }}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl h-9 px-6 shadow-lg shadow-cyan-900/20"
                >
                  Cobrar
                </Button>
              )}
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

            <div className="pt-6 border-t border-slate-800 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold uppercase text-[10px]">Forma de Pagamento</span>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger className="w-40 bg-slate-950 border-slate-800 h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0b1224] border-slate-800 text-white">
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
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

        {/* --- MODAL DE DETALHES DE VENDA FECHADA --- */}
        <Dialog open={!!viewDetailsAppt} onOpenChange={(v) => !v && setViewDetailsAppt(null)}>
          <DialogContent className="bg-[#0b1224] border-slate-800 text-white max-w-md rounded-[2rem] p-0 overflow-hidden shadow-2xl">
            <div className="bg-slate-900/80 p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-black flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-emerald-500" /> Recibo
                </DialogTitle>
                <p className="text-xs text-slate-500 font-bold mt-1 uppercase">{viewDetailsAppt?.client_name}</p>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-none font-black tracking-widest text-[9px]">PAGO</Badge>
            </div>

            <div className="p-6">
              {loadingDetails ? (
                <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>
              ) : orderDetails ? (
                <div className="space-y-6">
                  {/* Lista de Itens */}
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-slate-800 pb-2">Itens Cobrados</p>
                    {orderDetails.items?.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold">{item.qty}x</span>
                          <span className="text-white">{item.name}</span>
                        </div>
                        <span className="font-bold text-slate-300">R$ {(item.price * item.qty).toFixed(2).replace(".", ",")}</span>
                      </div>
                    ))}
                  </div>

                  {/* Resumo Financeiro */}
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 font-bold uppercase">Forma de Pagamento</span>
                      <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">
                        {getPaymentIcon(orderDetails.payment_method)}
                        <span className="text-xs font-bold text-white">{getPaymentName(orderDetails.payment_method)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-slate-800/50">
                      <span className="text-sm font-black text-white">TOTAL PAGO</span>
                      <span className="text-2xl font-black text-emerald-400 tracking-tighter">
                        R$ {Number(orderDetails.total).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-sm">Nenhuma comanda vinculada encontrada.</div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-800 bg-slate-900/50">
              <Button onClick={() => setViewDetailsAppt(null)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl">Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Caixa;
