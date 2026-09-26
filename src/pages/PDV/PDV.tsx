import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, Calendar, Sparkles, ShoppingBag, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppointmentsList } from "@/components/pdv/AppointmentsList";
import { OpenComandasList } from "@/components/pdv/OpenComandasList";
import { CartPanel, CartItem } from "@/components/pdv/CartPanel";
import { CheckoutModal } from "@/components/pdv/CheckoutModal";
import { AddItemModal } from "@/components/pdv/AddItemModal";
import { SalesList } from "@/components/pdv/SalesList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PDV() {
  const { clinic, professionalId, loading: clinicLoading } = useClinic() as any;
  const { user, isProfessional } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [currentSaleId, setCurrentSaleId] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  
  // Mobile responsive tab view
  const [mobileTab, setMobileTab] = useState<"fila" | "comanda">("fila");

  // Totals for header / floating bar
  const subtotal = useMemo(() => cartItems.reduce((acc, item) => acc + item.total_price, 0), [cartItems]);
  const totalDeposit = useMemo(() => cartItems.reduce((acc, item) => acc + (item.advance_payment || 0), [cartItems]);
  const totalDue = useMemo(() => Math.max(0, subtotal - totalDeposit), [subtotal, totalDeposit]);

  // Active Cash Register Query
  const { data: openRegister } = useQuery({
    queryKey: ["active-cash-register", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return null;
      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("barbershop_id", clinic.id)
        .eq("status", "open")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!clinic?.id,
  });

  // Silently ensure an open register exists for the day without blocking the user
  const ensureOpenRegister = useCallback(async (): Promise<string> => {
    if (openRegister?.id) return openRegister.id;

    // 1. Check if a register is already open in the DB
    const { data: existingReg } = await supabase
      .from("cash_registers")
      .select("id")
      .eq("barbershop_id", clinic.id)
      .eq("status", "open")
      .maybeSingle();

    if (existingReg?.id) {
      return existingReg.id;
    }

    // 2. Silently create a daily cash register
    const { data: newReg, error: regError } = await supabase
      .from("cash_registers")
      .insert({
        barbershop_id: clinic.id,
        opened_by: user?.id || null,
        initial_balance: 0,
        status: "open",
        opened_at: new Date().toISOString(),
        notes: "Caixa automático do dia (Comandeira Ágil)",
      })
      .select("id")
      .maybeSingle();

    if (regError) {
      // In case of race condition with another terminal opening at the same time
      const { data: fallbackReg } = await supabase
        .from("cash_registers")
        .select("id")
        .eq("barbershop_id", clinic.id)
        .eq("status", "open")
        .maybeSingle();

      if (fallbackReg?.id) return fallbackReg.id;
      throw regError;
    }

    queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
    return newReg!.id;
  }, [clinic?.id, openRegister?.id, queryClient, user?.id]);

  // Silent automatic register opening in background on mount
  useEffect(() => {
    if (clinic?.id && !openRegister) {
      ensureOpenRegister().catch((err) => {
        console.warn("Silent register init:", err);
      });
    }
  }, [clinic?.id, openRegister, ensureOpenRegister]);

  // Realtime updates
  useEffect(() => {
    if (!clinic?.id) return;
    const filter = `barbershop_id=eq.${clinic.id}`;
    const channel = supabase
      .channel(`pdv-realtime-${clinic.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments", filter }, () => {
        queryClient.invalidateQueries({ queryKey: ["pdv-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["pdv-appointments"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter }, () => {
        queryClient.invalidateQueries({ queryKey: ["pdv-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["sales"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_movements", filter }, () => {
        queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
        queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "cash_registers", filter }, () => {
        queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "appointment_payments", filter }, () => {
        queryClient.invalidateQueries({ queryKey: ["pdv-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["sales"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "sales", filter }, () => {
        queryClient.invalidateQueries({ queryKey: ["sales"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinic?.id, queryClient]);

  // Direct and simple checkout mutation with RLS protection
  const checkoutMutation = useMutation({
    mutationFn: async ({ paymentMethod, amount }: { paymentMethod: string; amount: number }) => {
      if (!clinic?.id || !user?.id) throw new Error("Faltam dados de autenticação ou clínica");

      // 1. Ensure silent cash register
      const registerId = await ensureOpenRegister();

      const total = cartItems.reduce((acc, item) => acc + item.total_price, 0);

      // 2. Create or Update Sale (wrapped in try/catch to protect against strict RLS policies)
      let sale: any = null;
      try {
        const salePayload: any = {
          barbershop_id: clinic.id,
          total_amount: total,
          status: "paid",
          created_by: user.id,
        };
        // Only attach customer_id if it's a valid ID
        if (customerId) {
          salePayload.customer_id = customerId;
        }

        if (currentSaleId) {
          const { data: updatedSale, error: saleError } = await supabase
            .from("sales")
            .update(salePayload)
            .eq("id", currentSaleId)
            .select()
            .maybeSingle();

          if (saleError) throw saleError;
          sale = updatedSale;

          await supabase.from("sales_items").delete().eq("sale_id", currentSaleId);
        } else {
          const { data: newSale, error: saleError } = await supabase
            .from("sales")
            .insert(salePayload)
            .select()
            .maybeSingle();

          if (saleError) throw saleError;
          sale = newSale;
        }

        // 3. Create Sale Items if sale was created
        if (sale?.id) {
          const itemsToInsert = cartItems.map((item) => ({
            sale_id: sale.id,
            item_type: item.item_type,
            item_id: item.item_id || item.id,
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
          }));

          const { error: itemsError } = await supabase.from("sales_items").insert(itemsToInsert);
          if (itemsError) {
            console.warn("[PDV] Aviso ao inserir sales_items:", itemsError);
          }
        }
      } catch (saleErr: any) {
        // If table sales has RLS restriction (e.g. non-owner professional), log and proceed
        console.warn("[PDV] Tabela sales protegida por RLS. Prosseguindo com lançamento de caixa e finalização:", saleErr);
      }

      // 4. Create Cash Movements (Payment recorded at checkout)
      if (amount > 0) {
        const saleRef = sale?.id ? `#${sale.id.substring(0, 6)}` : `PDV-${Date.now().toString().slice(-4)}`;
        const movement = {
          barbershop_id: clinic.id,
          register_id: registerId,
          amount: amount,
          type: "sale",
          movement_type: "sale",
          origin_type: "sale",
          origin_id: sale?.id || null,
          payment_method: paymentMethod,
          created_by: user.id,
          description: `Venda ${saleRef} - ${paymentMethod}`,
        };

        const { error: movementError } = await supabase.from("cash_movements").insert(movement as any);
        if (movementError) {
          console.warn("[PDV] Aviso ao registrar cash_movements com movement_type, tentando com type:", movementError);
          // Fallback in case table has specific column definition
          const fallbackMovement: any = {
            barbershop_id: clinic.id,
            register_id: registerId,
            amount: amount,
            type: "sale",
            payment_method: paymentMethod,
            created_by: user.id,
            description: `Venda ${saleRef} - ${paymentMethod}`,
          };
          await supabase.from("cash_movements").insert(fallbackMovement);
        }
      }

      // 5. Update Appointments to completed and paid
      const appointmentIds = cartItems
        .filter((i) => i.source_appointment_id)
        .map((i) => i.source_appointment_id as string);

      if (appointmentIds.length > 0) {
        const { error: apptError } = await supabase
          .from("appointments")
          .update({
            payment_status: "paid",
            status: "completed",
            payment_method: paymentMethod,
            payment_confirmed_at: new Date().toISOString(),
          })
          .in("id", appointmentIds);

        if (apptError) throw apptError;
      }

      return sale;
    },
    onSuccess: () => {
      toast({
        title: "Venda finalizada com sucesso!",
        description: "Comanda concluída e pagamento registrado.",
      });
      setCartItems([]);
      setCustomerName("");
      setCustomerId(null);
      setCurrentSaleId(null);
      setShowCheckout(false);
      setMobileTab("fila");
      queryClient.invalidateQueries({ queryKey: ["pdv-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao processar venda",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSelectAppointment = (appt: any) => {
    // Evita duplicar no carrinho
    if (cartItems.some((i) => i.source_appointment_id === appt.id)) {
      toast({ title: "Item já está na comanda" });
      return;
    }

    const signal = (appt.has_signal && appt.signal_value ? Number(appt.signal_value) : 0) || Number(appt.advance_payment_amount || 0);

    // Se o agendamento já tiver itens de procedimento detalhados
    if (appt.appointment_items && appt.appointment_items.length > 0) {
      const newItems: CartItem[] = appt.appointment_items.map((subItem: any, idx: number) => ({
        id: `${appt.id}-${subItem.id || idx}`,
        item_type: "service" as const,
        item_id: subItem.id || appt.id,
        name: subItem.service_name || appt.service_name,
        quantity: 1,
        unit_price: Number(subItem.price || 0),
        total_price: Number(subItem.price || 0),
        barber_id: appt.barber_id,
        barber_name: appt.barber_name,
        source_appointment_id: appt.id,
        advance_payment: idx === 0 ? signal : 0,
      }));
      setCartItems((prev) => [...prev, ...newItems]);
    } else {
      setCartItems((prev) => [
        ...prev,
        {
          id: appt.id,
          item_type: "service",
          item_id: appt.id,
          name: appt.service_name,
          quantity: 1,
          unit_price: Number(appt.total_price ?? appt.price ?? 0),
          total_price: Number(appt.total_price ?? appt.price ?? 0),
          barber_id: appt.barber_id,
          barber_name: appt.barber_name,
          source_appointment_id: appt.id,
          advance_payment: signal,
        },
      ]);
    }

    if (!customerName) {
      setCustomerName(appt.client_name);
      setCustomerId(appt.customer_id || null);
    }

    toast({ title: "Adicionado à comanda", description: `${appt.client_name} - ${appt.service_name}` });
  };

  const handleRemoveItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    if (cartItems.length <= 1) {
      setCustomerName("");
      setCustomerId(null);
    }
  };

  const handleClearComanda = () => {
    setCartItems([]);
    setCustomerName("");
    setCustomerId(null);
    setCurrentSaleId(null);
  };

  const handleCheckoutConfirm = (paymentMethod: string, amount: number) => {
    checkoutMutation.mutate({ paymentMethod, amount });
  };

  const handleAddManualItem = (item: any) => {
    setCartItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        item_type: item.item_type,
        item_id: crypto.randomUUID(),
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        barber_id: item.barber_id,
        barber_name: item.barber_name,
      },
    ]);
  };

  const handleSelectSale = (sale: any) => {
    setCurrentSaleId(sale.id);
    setCustomerName(sale.customer_id || "Cliente");
    setCustomerId(sale.customer_id);
    setCartItems(
      (sale.sales_items || []).map((i: any) => ({
        id: i.id,
        item_type: i.item_type,
        item_id: i.item_id,
        name: i.name,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.total_price,
      }))
    );
    setMobileTab("comanda");
  };

  const handleSaveOpenSale = async () => {
    if (!clinic?.id || !user?.id) return;
    const total = cartItems.reduce((acc, item) => acc + item.total_price, 0);

    if (currentSaleId) {
      await supabase.from("sales").update({ total_amount: total, customer_id: customerId }).eq("id", currentSaleId);
      await supabase.from("sales_items").delete().eq("sale_id", currentSaleId);
      if (cartItems.length > 0) {
        const itemsToInsert = cartItems.map((item) => ({
          sale_id: currentSaleId,
          item_type: item.item_type,
          item_id: item.item_id || item.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }));
        await supabase.from("sales_items").insert(itemsToInsert);
      }
    } else {
      const { data: sale } = await supabase
        .from("sales")
        .insert({
          barbershop_id: clinic.id,
          customer_id: customerId,
          total_amount: total,
          status: "open",
          created_by: user.id,
        })
        .select()
        .single();

      if (sale && cartItems.length > 0) {
        const itemsToInsert = cartItems.map((item) => ({
          sale_id: sale.id,
          item_type: item.item_type,
          item_id: item.item_id || item.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }));
        await supabase.from("sales_items").insert(itemsToInsert);
      }
    }
    toast({ title: "Comanda salva em aberto!" });
    handleClearComanda();
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  };

  if (clinicLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground text-sm">Carregando Comandeira...</p>
      </div>
    );
  }

  const selectedAppointmentIds = cartItems
    .filter((i) => i.source_appointment_id)
    .map((i) => i.source_appointment_id as string);

  return (
    <div className="h-[calc(100dvh-75px)] sm:h-[calc(100vh-100px)] flex flex-col gap-2.5 sm:gap-3 overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2.5 bg-card border border-border px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl shadow-2xs shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-tight">Comandeira Ágil</h1>
              <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="flex sm:hidden items-center gap-1.5">
            <Button 
              variant="default" 
              size="sm"
              className="font-bold shadow-xs gap-1 h-8 text-xs px-2.5" 
              onClick={() => setShowAddItem(true)}
            >
              <Plus className="w-3.5 h-3.5" /> Avulsa
            </Button>
          </div>
        </div>

        {/* Mobile View Switcher (Fila do Dia vs Comanda) */}
        <div className="flex lg:hidden items-center w-full sm:w-auto gap-2">
          <div className="grid grid-cols-2 w-full sm:w-64 bg-muted/60 p-1 rounded-xl h-10 border border-border/50">
            <button
              type="button"
              onClick={() => setMobileTab("fila")}
              className={`flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg transition-all ${
                mobileTab === "fila" 
                  ? "bg-background text-foreground shadow-xs" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Fila do Dia
            </button>
            <button
              type="button"
              onClick={() => setMobileTab("comanda")}
              className={`flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg transition-all relative ${
                mobileTab === "comanda" 
                  ? "bg-background text-foreground shadow-xs" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Comanda
              {cartItems.length > 0 && (
                <span className="ml-1 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {cartItems.length}
                </span>
              )}
            </button>
          </div>

          <Button 
            variant="default" 
            size="sm"
            className="hidden sm:flex font-bold shadow-xs gap-1.5 h-9" 
            onClick={() => setShowAddItem(true)}
          >
            <Plus className="w-4 h-4" /> Venda Avulsa
          </Button>
        </div>

        {/* Desktop Header Action */}
        <div className="hidden lg:flex items-center gap-2">
          <Button 
            variant="default" 
            size="sm"
            className="font-bold shadow-xs gap-1.5 h-9" 
            onClick={() => setShowAddItem(true)}
          >
            <Plus className="w-4 h-4" /> Venda Avulsa
          </Button>
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden relative">
        {/* Coluna Esquerda (Fila do Dia - 60% on desktop, full width on mobile when mobileTab === 'fila') */}
        <div 
          className={`w-full lg:w-[60%] flex-col min-h-0 bg-card border border-border rounded-2xl shadow-xs overflow-hidden ${
            mobileTab === "fila" ? "flex flex-1" : "hidden lg:flex"
          }`}
        >
          <Tabs defaultValue="agendados" className="w-full h-full flex flex-col">
            {/* Tabs Header */}
            <div className="p-2.5 sm:p-3 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
              <TabsList className="bg-muted/70 p-1 rounded-xl h-10 w-full sm:w-auto grid grid-cols-3 sm:flex">
                <TabsTrigger 
                  value="agendados" 
                  className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs px-2.5 sm:px-3 truncate"
                >
                  Agendados
                </TabsTrigger>
                <TabsTrigger 
                  value="abertas" 
                  className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs px-2.5 sm:px-3 truncate"
                >
                  Em Atendimento
                </TabsTrigger>
                <TabsTrigger 
                  value="finalizados" 
                  className="text-xs font-bold rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-xs px-2.5 sm:px-3 truncate"
                >
                  Finalizados
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab 1: Agendados */}
            <TabsContent value="agendados" className="flex-1 overflow-y-auto p-3 sm:p-4 mt-0">
              <AppointmentsList 
                filter="agendados"
                onSelect={handleSelectAppointment} 
                professionalId={isProfessional ? professionalId : undefined}
                selectedAppointmentIds={selectedAppointmentIds}
              />
            </TabsContent>

            {/* Tab 2: Em Atendimento (Abertas) */}
            <TabsContent value="abertas" className="flex-1 overflow-y-auto p-3 sm:p-4 mt-0 space-y-4">
              <AppointmentsList 
                filter="abertas"
                onSelect={handleSelectAppointment} 
                professionalId={isProfessional ? professionalId : undefined}
                selectedAppointmentIds={selectedAppointmentIds}
              />

              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Comandas por Profissional
                </h3>
                <OpenComandasList 
                  barbershopId={clinic?.id} 
                  professionalId={isProfessional ? professionalId : undefined} 
                  onSelect={handleSelectAppointment} 
                />
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Comandas Avulsas Salvas em Aberto
                </h3>
                <SalesList 
                  barbershopId={clinic?.id} 
                  status="open" 
                  onSelectSale={handleSelectSale} 
                  createdBy={isProfessional ? user?.id : undefined} 
                />
              </div>
            </TabsContent>

            {/* Tab 3: Finalizados */}
            <TabsContent value="finalizados" className="flex-1 overflow-y-auto p-3 sm:p-4 mt-0 space-y-4">
              <AppointmentsList 
                filter="finalizados"
                onSelect={handleSelectAppointment} 
                professionalId={isProfessional ? professionalId : undefined}
                selectedAppointmentIds={selectedAppointmentIds}
              />

              <div className="border-t border-border pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Vendas Concluídas do Dia
                </h3>
                <SalesList 
                  barbershopId={clinic?.id} 
                  status="paid" 
                  onSelectSale={handleSelectSale} 
                  createdBy={isProfessional ? user?.id : undefined} 
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Coluna Direita (A Comanda/Resumo - 40% on desktop, full width on mobile when mobileTab === 'comanda') */}
        <div 
          className={`w-full lg:w-[40%] flex-col min-h-0 bg-card border border-border rounded-2xl shadow-xs overflow-hidden ${
            mobileTab === "comanda" ? "flex flex-1" : "hidden lg:flex"
          }`}
        >
          <CartPanel 
            items={cartItems} 
            customerName={customerName}
            onRemoveItem={handleRemoveItem}
            onClear={handleClearComanda}
            onCheckout={() => setShowCheckout(true)}
            onSaveOpenSale={handleSaveOpenSale}
            onAddManualItem={() => setShowAddItem(true)}
            onBackToFila={() => setMobileTab("fila")}
          />
        </div>

        {/* Floating Mobile Bottom Checkout Bar (when items are in comanda and viewing fila) */}
        {mobileTab === "fila" && cartItems.length > 0 && (
          <div className="lg:hidden absolute bottom-2 left-2 right-2 p-3 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-xl flex items-center justify-between gap-3 z-30 animate-in fade-in slide-in-from-bottom-2">
            <div 
              className="flex flex-col min-w-0 cursor-pointer pl-1"
              onClick={() => setMobileTab("comanda")}
            >
              <span className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-primary" />
                {cartItems.length} {cartItems.length === 1 ? "item na comanda" : "itens na comanda"}
              </span>
              <span className="text-base font-black text-foreground truncate">
                R$ {totalDue.toFixed(2).replace(".", ",")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileTab("comanda")}
                className="text-xs font-semibold h-10 px-3"
              >
                Ver Comanda
              </Button>
              <Button
                size="sm"
                onClick={() => setShowCheckout(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-4 shadow-md text-xs"
              >
                Cobrar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Streamlined Checkout Modal */}
      <CheckoutModal 
        open={showCheckout} 
        onOpenChange={setShowCheckout}
        items={cartItems}
        customerName={customerName}
        onConfirm={handleCheckoutConfirm}
        isSubmitting={checkoutMutation.isPending}
      />

      {/* Manual Item Modal */}
      <AddItemModal
        open={showAddItem}
        onOpenChange={setShowAddItem}
        onAdd={handleAddManualItem}
      />
    </div>
  );
}
