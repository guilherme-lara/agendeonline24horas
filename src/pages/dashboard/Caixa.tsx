import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart, Loader2, Search, Plus, Trash2, CheckCircle, Receipt, AlertTriangle, RefreshCw, X, Minus, Eye, CreditCard, Banknote, QrCode, Copy, Check, DollarSign, MessageCircle, PartyPopper
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay } from "date-fns";
import { toBRT } from "@/lib/timezone";
import { useState, useMemo, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import confetti from "canvas-confetti";

const Caixa = () => {
  const { barbershop } = useBarbershop() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<any | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [payMethod, setPayMethod] = useState("cash");
  const [viewDetailsAppt, setViewDetailsAppt] = useState<any | null>(null);
  const [orderDetails, setOrderDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [copiedPix, setCopiedPix] = useState(false);

  // Parse settings para Pix Estático do PDV
  const rawSettings = barbershop?.settings;
  let shopSettings: any = {};
  if (typeof rawSettings === "string") {
    try { shopSettings = JSON.parse(rawSettings); } catch (e) {}
  } else if (rawSettings) {
    shopSettings = rawSettings;
  }
  const pixKey = shopSettings?.pix_key || "";
  const pixBeneficiary = shopSettings?.pix_beneficiary || barbershop?.name || "";

  const handleCopyPix = () => {
    if (!pixKey) return;
    navigator.clipboard.writeText(pixKey);
    setCopiedPix(true);
    toast({ title: "Chave Pix copiada!" });
    setTimeout(() => setCopiedPix(false), 2000);
  };

  const { data: appointments = [], isLoading: loadingAppts } = useQuery({
    queryKey: ["daily-appointments", barbershop?.id],
    queryFn: async () => {
      // Usa horário de Brasília para filtrar "hoje"
      const nowBrt = toBRT(new Date().toISOString());
      const dayStart = startOfDay(nowBrt);
      const dayEnd = endOfDay(nowBrt);
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .gte("scheduled_at", dayStart.toISOString())
        .lte("scheduled_at", dayEnd.toISOString())
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

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (Number(item.price) * item.qty), 0);
  }, [cart]);

  const handleSelectAppt = (appt: any) => {
    setSelectedAppt(appt);
    const initialCart = [{ name: appt.service_name, price: appt.price, qty: 1, type: "service" }];
    
    if (appt.has_signal && appt.signal_value > 0) {
       initialCart.push({
           name: "Desconto (Sinal Adiantado)",
           price: -Math.abs(appt.signal_value),
           qty: 1,
           type: "discount"
       });
    }
    setCart(initialCart);
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAppt || !barbershop) throw new Error("Dados ausentes. Selecione um agendamento.");
      
      // Verifica sessão antes de qualquer operação
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error("Sessão expirada. Faça login novamente para continuar.");
      }
      
      const finalTotal = Math.max(0, cartTotal);
      
      // 1. Cria a order
      const { data: orderData, error: orderError } = await supabase.from("orders").insert({
        barbershop_id: barbershop.id,
        appointment_id: selectedAppt.id,
        items: cart,
        total: finalTotal,
        payment_method: payMethod,
        status: payMethod === 'pix' ? "pendente" : "closed" 
      }).select("id").single();

      if (orderError) {
        // Diagnóstico detalhado
        if (orderError.code === '42501' || orderError.message?.includes('policy')) {
          throw new Error(`Permissão negada ao criar comanda. Verifique se você é o dono desta barbearia. (Código: ${orderError.code})`);
        }
        if (orderError.code === '23505') {
          throw new Error("Comanda duplicada. Este agendamento já foi finalizado.");
        }
        throw new Error(`Erro ao criar comanda: ${orderError.message} (Código: ${orderError.code || 'N/A'})`);
      }

      // 2. SE FOR PIX: Chama a Edge Function
      if (payMethod === 'pix' && finalTotal > 0) {
        const { data: pixData, error: pixError } = await supabase.functions.invoke('create-pix-charge', {
          body: {
            amount: Math.round(finalTotal * 100),
            orderId: selectedAppt.id,
            tenant_id: barbershop.id,
            description: `Comanda: ${selectedAppt.client_name}`
          }
        });

        if (pixError || !pixData?.success) {
          throw new Error("Erro ao gerar o Pix na InfinitePay. Tente outra forma de pagamento.");
        }

        window.open(pixData.payment_url, '_blank');
        return { isPix: true };
      }

      // 3. SE NÃO FOR PIX: Dá baixa imediata no agendamento
      const { error: apptError } = await supabase.from("appointments").update({
        status: "completed",
        payment_status: "paid",
        total_price: finalTotal
      }).eq("id", selectedAppt.id);

      if (apptError) {
        // Order já foi criada — não é fatal, mas avisa
        console.error("Erro ao atualizar agendamento:", apptError);
        throw new Error(`Comanda criada, mas erro ao fechar agendamento: ${apptError.message}. Verifique na Agenda.`);
      }

      // 4. Baixa de estoque para produtos
      for (const item of cart) {
        if (item.type === "product" && item.product_id) {
          const { data: current } = await supabase.from("inventory").select("quantity").eq("id", item.product_id).single();
          if (current) {
            const { error: stockErr } = await supabase.from("inventory").update({ quantity: Math.max(0, current.quantity - item.qty) }).eq("id", item.product_id);
            if (stockErr) {
              console.warn(`Aviso: Falha ao baixar estoque de ${item.name}:`, stockErr.message);
            }
          }
        }
      }

      return { isPix: false };
    },
    onSuccess: (res) => {
      if (res?.isPix) {
        toast({ title: "Pix Gerado!", description: "Link aberto em nova aba. Aguardando pagamento..." });
      } else {
        queryClient.invalidateQueries({ queryKey: ["daily-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["inventory-pdv"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
        toast({ title: "✅ Venda Finalizada!", description: `Valor: R$ ${Math.max(0, cartTotal).toFixed(2).replace(".", ",")}` });
        setSelectedAppt(null);
        setCart([]);
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "❌ Erro na finalização", 
        description: error.message || "Erro desconhecido. Tente novamente.", 
        variant: "destructive" 
      });
    }
  });

  const addProductToCart = (p: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.product_id === p.id);
      if (existing) return prev.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { name: p.name, price: Number(p.sell_price), qty: 1, type: "product", product_id: p.id }];
    });
  };

  const removeFromCart = (idx: number) => {
    const item = cart[idx];
    if (item.type === "service" || item.type === "discount") return; // não remove serviço base
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const openDetails = async (appt: any) => {
    setViewDetailsAppt(appt);
    setLoadingDetails(true);
    try {
      const { data, error } = await supabase.from("orders").select("*").eq("appointment_id", appt.id).maybeSingle();
      if (error) throw error;
      setOrderDetails(data);
    } catch (err: any) {
      toast({ title: "Erro ao carregar detalhes", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoadingDetails(false);
    }
  };

  const getPaymentIcon = (method: string) => {
    switch(method) {
      case 'pix': return <QrCode className="h-4 w-4 text-primary" />;
      case 'card': return <CreditCard className="h-4 w-4 text-primary" />;
      default: return <Banknote className="h-4 w-4 text-emerald-400" />;
    }
  };

  const getPaymentName = (method: string) => {
    switch(method) { case 'pix': return "Pix"; case 'card': return "Cartão"; default: return "Dinheiro"; }
  };

  return (
    <div className="w-full max-w-full p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-foreground flex items-center gap-3 font-display">
          <ShoppingCart className="text-primary" /> Frente de Caixa
        </h1>
        {pixKey && (
          <Button 
            onClick={() => setShowPixModal(true)} 
            variant="outline" 
            className="border-primary/30 text-primary hover:bg-primary/10 font-bold rounded-xl"
          >
            <QrCode className="h-4 w-4 mr-2" /> Mostrar Pix Fixo
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input 
              placeholder="Localizar cliente para cobrar..." 
              className="bg-card border-border pl-11 h-12 rounded-2xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loadingAppts && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
          {appointments.filter((a:any) => a.client_name.toLowerCase().includes(search.toLowerCase())).map((a:any) => (
            <div key={a.id} className="p-4 bg-card border border-border rounded-2xl flex items-center justify-between group hover:border-primary/30 transition-all">
              <div>
                <p className="font-bold text-foreground flex items-center gap-2">
                  {a.client_name}
                  {a.status === 'completed' && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-black">{a.service_name} &bull; R$ {a.status === 'completed' ? a.total_price : a.price}</p>
                  {a.has_signal && a.status !== 'completed' && (
                     <Badge className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] px-1.5 py-0">- R$ {a.signal_value} (Sinal)</Badge>
                  )}
                </div>
              </div>
              
              {a.status === 'completed' ? (
                <Button 
                  variant="outline"
                  onClick={() => openDetails(a)}
                  className="border-border text-muted-foreground hover:text-primary hover:border-primary/30 font-bold rounded-xl h-9 px-4"
                >
                  <Eye className="h-4 w-4 mr-2" /> Ver Detalhes
                </Button>
              ) : (
                <Button 
                  onClick={() => handleSelectAppt(a)}
                  disabled={!!selectedAppt && selectedAppt.id === a.id}
                  className="gold-gradient text-primary-foreground font-bold rounded-xl h-9 px-6 shadow-gold"
                >
                  Cobrar
                </Button>
              )}
            </div>
          ))}
          {!loadingAppts && appointments.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhum agendamento para hoje.
            </div>
          )}
        </div>

        {selectedAppt && (
          <div className="bg-card border border-border rounded-3xl p-8 shadow-card animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-foreground font-display">Comanda Atual</h2>
                <p className="text-primary text-xs font-bold uppercase tracking-widest">{selectedAppt.client_name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setSelectedAppt(null); setCart([]); }} className="rounded-full text-muted-foreground">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-3 mb-8">
              {cart.map((item, idx) => (
                <div key={idx} className={`flex items-center justify-between p-4 bg-background rounded-2xl border border-border ${item.type === 'discount' ? 'border-amber-500/30 bg-amber-500/5' : ''}`}>
                  <div>
                    <p className={`text-sm font-bold ${item.type === 'discount' ? 'text-amber-500' : 'text-foreground'}`}>{item.name}</p>
                    {item.type !== 'discount' && <p className="text-[10px] text-muted-foreground">R$ {item.price.toFixed(2)} un.</p>}
                  </div>
                  <div className="flex items-center gap-4">
                    {item.type !== 'discount' && item.type !== 'service' && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeFromCart(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    {item.type !== 'discount' && (
                      <div className="flex items-center bg-card rounded-lg p-1 border border-border">
                        <button onClick={() => setCart(prev => prev.map((it, i) => i === idx ? {...it, qty: Math.max(1, it.qty - 1)} : it))} className="p-1 hover:text-primary"><Minus className="h-3 w-3" /></button>
                        <span className="w-8 text-center text-xs font-black text-foreground">{item.qty}</span>
                        <button onClick={() => setCart(prev => prev.map((it, i) => i === idx ? {...it, qty: it.qty + 1} : it))} className="p-1 hover:text-primary"><Plus className="h-3 w-3" /></button>
                      </div>
                    )}
                    <p className={`text-sm font-black w-20 text-right ${item.type === 'discount' ? 'text-amber-500' : 'text-foreground'}`}>
                      {item.type === 'discount' ? '- ' : ''}R$ {Math.abs(item.price * item.qty).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-8">
              <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Adicionar Produto</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                {inventory.map((p: any) => (
                  <button key={p.id} onClick={() => addProductToCart(p)} className="flex items-center justify-between p-3 bg-background border border-border rounded-xl hover:border-primary/30 transition-all text-left">
                    <div>
                      <p className="text-[11px] font-bold text-foreground truncate">{p.name}</p>
                      <p className="text-[9px] text-muted-foreground">Qtd: {p.quantity}</p>
                    </div>
                    <span className="text-[11px] font-black text-emerald-500">R${p.sell_price}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-border space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground font-bold uppercase text-[10px]">Forma de Pagamento</span>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger className="w-40 bg-background border-border h-10 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-popover-foreground">
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">Link InfinitePay</SelectItem>
                    <SelectItem value="card">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-xl font-black text-foreground">Restante a Pagar</span>
                <span className="text-4xl font-black text-primary tracking-tighter">
                   R$ {Math.max(0, cartTotal).toFixed(2).replace(".", ",")}
                </span>
              </div>
              <Button 
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="w-full h-16 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl text-lg shadow-xl shadow-emerald-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {checkoutMutation.isPending ? (
                  <><Loader2 className="animate-spin h-6 w-6 mr-2" /> Processando...</>
                ) : payMethod === 'pix' ? (
                  <><QrCode className="h-6 w-6 mr-2" /> Gerar Pix na InfinitePay</>
                ) : (
                  <><CheckCircle className="h-6 w-6 mr-2" /> Finalizar Venda</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* MODAL PIX FIXO */}
        <Dialog open={showPixModal} onOpenChange={setShowPixModal}>
          <DialogContent className="bg-card border-border text-foreground max-w-sm rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black flex items-center gap-2 font-display">
                <QrCode className="h-5 w-5 text-primary" /> Pix do Estabelecimento
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="bg-secondary/50 border border-border rounded-2xl p-4 text-center">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Beneficiário</p>
                <p className="text-lg font-black text-foreground">{pixBeneficiary}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chave Pix</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-background rounded-xl px-4 py-3 font-mono text-sm text-foreground break-all border border-border">{pixKey}</div>
                  <Button onClick={handleCopyPix} className="gold-gradient text-primary-foreground px-4 shrink-0 rounded-xl">
                    {copiedPix ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button onClick={() => setShowPixModal(false)} variant="outline" className="w-full rounded-xl border-border">Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* MODAL DETALHES / RECIBO */}
        <Dialog open={!!viewDetailsAppt} onOpenChange={(v) => !v && setViewDetailsAppt(null)}>
          <DialogContent className="bg-card border-border text-foreground max-w-md rounded-3xl p-0 overflow-hidden shadow-card">
            <div className="bg-secondary/50 p-6 border-b border-border flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-black flex items-center gap-2 font-display">
                  <Receipt className="h-5 w-5 text-emerald-500" /> Recibo
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-bold mt-1 uppercase">{viewDetailsAppt?.client_name}</p>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black tracking-widest text-[9px]">PAGO</Badge>
            </div>
            <div className="p-6">
              {loadingDetails ? (
                <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
              ) : orderDetails ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] border-b border-border pb-2">Itens Cobrados</p>
                    {orderDetails.items?.map((item: any, i: number) => (
                      <div key={i} className={`flex justify-between items-center text-sm ${item.type === 'discount' ? 'text-amber-500' : 'text-foreground'}`}>
                        <div className="flex items-center gap-2">
                          {item.type !== 'discount' && <span className="text-muted-foreground font-bold">{item.qty}x</span>}
                          <span className="font-bold">{item.name}</span>
                        </div>
                        <span className="font-bold">
                          {item.type === 'discount' ? '- ' : ''}R$ {Math.abs(item.price * item.qty).toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-secondary/50 rounded-2xl p-4 border border-border space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground font-bold uppercase">Pagamento</span>
                      <div className="flex items-center gap-1.5 bg-card px-2 py-1 rounded-md border border-border">
                        {getPaymentIcon(orderDetails.payment_method)}
                        <span className="text-xs font-bold text-foreground">{getPaymentName(orderDetails.payment_method)}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-border/50">
                      <span className="text-sm font-black text-foreground">TOTAL FINAL</span>
                      <span className="text-2xl font-black text-emerald-500 tracking-tighter">
                        R$ {Number(orderDetails.total).toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm">Nenhuma comanda encontrada.</div>
              )}
            </div>
            <div className="p-4 border-t border-border bg-secondary/30">
              <Button onClick={() => setViewDetailsAppt(null)} variant="outline" className="w-full border-border font-bold rounded-xl">Fechar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Caixa;
