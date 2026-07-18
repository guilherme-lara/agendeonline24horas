import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Store, Lock } from "lucide-react";
import { AppointmentsList } from "@/components/pdv/AppointmentsList";
import { CartPanel, CartItem } from "@/components/pdv/CartPanel";
import { CheckoutModal, PaymentSplit } from "@/components/pdv/CheckoutModal";
import { AddItemModal } from "@/components/pdv/AddItemModal";
import { RegisterManagementModal } from "@/components/pdv/RegisterManagementModal";
import { Settings2 } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesList } from "@/components/pdv/SalesList";
import CashRegisterPanel from "@/components/CashRegisterPanel";

export default function PDV() {
  const { clinic, professionalId, loading: clinicLoading } = useClinic() as any;
  const { user, isProfessional } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [initialBalance, setInitialBalance] = useState("");
  const [viewMode, setViewMode] = useState<"pdv" | "caixa">("pdv");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [currentSaleId, setCurrentSaleId] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showRegisterMgmt, setShowRegisterMgmt] = useState(false);

  const { data: openRegister, isLoading: registerLoading } = useQuery({
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

  const openRegisterMutation = useMutation({
    mutationFn: async (balance: number) => {
      if (!clinic?.id || !user?.id) throw new Error("Faltam dados");
      const { data, error } = await supabase
        .from("cash_registers")
        .insert({
          barbershop_id: clinic.id,
          opened_by: user.id,
          initial_balance: balance,
          status: "open",
          opened_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Caixa Aberto", description: "O PDV está liberado para uso." });
      queryClient.invalidateQueries({ queryKey: ["active-cash-register"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao abrir caixa", description: error.message, variant: "destructive" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async (payments: PaymentSplit[]) => {
      if (!clinic?.id || !user?.id || !openRegister?.id) throw new Error("Faltam dados ou Caixa Fechado");
      
      const total = cartItems.reduce((acc, item) => acc + item.total_price, 0);

      // 1. Create or Update Sale
      let sale;
      if (currentSaleId) {
        const { data, error: saleError } = await supabase
          .from("sales")
          .update({
            total_amount: total,
            status: "paid",
            customer_id: customerId,
          })
          .eq("id", currentSaleId)
          .select()
          .single();
        if (saleError) throw saleError;
        sale = data;

        // delete old items to recreate
        await supabase.from("sales_items").delete().eq("sale_id", currentSaleId);
      } else {
        const { data, error: saleError } = await supabase
          .from("sales")
          .insert({
            barbershop_id: clinic.id,
            customer_id: customerId,
            total_amount: total,
            status: "paid",
            created_by: user.id,
          })
          .select()
          .single();
        if (saleError) throw saleError;
        sale = data;
      }

      if (saleError) throw saleError;

      // 2. Create Sale Items
      const itemsToInsert = cartItems.map(item => ({
        sale_id: sale.id,
        item_type: item.item_type,
        item_id: item.item_id || item.id, // Fallback to temp id if needed
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }));

      const { error: itemsError } = await supabase.from("sales_items").insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // 3. Create Cash Movements (Payments)
      const movementsToInsert = payments.map(payment => ({
        barbershop_id: clinic.id,
        register_id: openRegister.id,
        amount: payment.amount,
        movement_type: "sale",
        origin_type: "sale",
        origin_id: sale.id,
        payment_method: payment.method,
        created_by: user.id,
        description: `Venda #${sale.id.substring(0,6)}`
      }));

      const { error: movementsError } = await supabase.from("cash_movements").insert(movementsToInsert as any);
      if (movementsError) throw movementsError;

      // 4. Update Appointments (if any)
      const appointmentIds = cartItems.filter(i => i.source_appointment_id).map(i => i.source_appointment_id);
      if (appointmentIds.length > 0) {
        await supabase
          .from("appointments")
          .update({ payment_status: "paid", status: "completed" })
          .in("id", appointmentIds);
      }
      
      return sale;
    },
    onSuccess: () => {
      toast({ title: "Venda concluída!", description: "Pagamentos registrados com sucesso." });
      setCartItems([]);
      setCustomerName("");
      setCustomerId(null);
      setCurrentSaleId(null);
      setShowCheckout(false);
      queryClient.invalidateQueries({ queryKey: ["pdv-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["cash-movements"] });
    },
    onError: (error: any) => {
      toast({ title: "Erro na Venda", description: error.message, variant: "destructive" });
    }
  });

  const handleOpenRegister = (e: React.FormEvent) => {
    e.preventDefault();
    const balance = parseFloat(initialBalance.replace(",", "."));
    if (isNaN(balance) || balance < 0) return;
    openRegisterMutation.mutate(balance);
  };

  const handleSelectAppointment = (appt: any) => {
    // Evita duplicar no carrinho
    if (cartItems.some(i => i.source_appointment_id === appt.id)) return;
    
    setCartItems(prev => [...prev, {
      id: appt.id,
      item_type: "service",
      item_id: appt.id,
      name: appt.service_name,
      quantity: 1,
      unit_price: appt.price,
      total_price: appt.price,
      barber_id: appt.barber_id,
      barber_name: appt.barber_name,
      source_appointment_id: appt.id
    }]);

    if (!customerName) {
      setCustomerName(appt.client_name);
      setCustomerId(appt.client_id);
    }
  };

  const handleRemoveItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
    if (cartItems.length === 1) {
      setCustomerName("");
      setCustomerId(null);
    }
  };

  const handleCheckout = (payments: PaymentSplit[]) => {
    checkoutMutation.mutate(payments);
  };

  const handleAddManualItem = (item: any) => {
    setCartItems(prev => [...prev, {
      id: crypto.randomUUID(),
      item_type: item.item_type,
      item_id: crypto.randomUUID(), // fake id for manual items
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
      barber_id: item.barber_id,
      barber_name: item.barber_name
    }]);
  };

  
  const handleSelectSale = (sale: any) => {
    setCurrentSaleId(sale.id);
    setCustomerName(sale.customer_id || "Cliente"); // We might need to fetch customer name, but for now just "Cliente"
    setCustomerId(sale.customer_id);
    setCartItems(sale.sales_items.map((i: any) => ({
      id: i.id,
      item_type: i.item_type,
      item_id: i.item_id,
      name: i.name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      total_price: i.total_price,
    })));
  };

  const handleSaveOpenSale = async () => {
    if (!clinic?.id || !user?.id) return;
    const total = cartItems.reduce((acc, item) => acc + item.total_price, 0);
    
    if (currentSaleId) {
       await supabase.from("sales").update({ total_amount: total, customer_id: customerId }).eq("id", currentSaleId);
       await supabase.from("sales_items").delete().eq("sale_id", currentSaleId);
       if (cartItems.length > 0) {
           const itemsToInsert = cartItems.map(item => ({
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
        const { data: sale } = await supabase.from("sales").insert({
            barbershop_id: clinic.id,
            customer_id: customerId,
            total_amount: total,
            status: "open",
            created_by: user.id,
        }).select().single();

        if (sale && cartItems.length > 0) {
            const itemsToInsert = cartItems.map(item => ({
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
    toast({ title: "Comanda Salva em Aberto" });
    setCartItems([]);
    setCustomerName("");
    setCustomerId(null);
    setCurrentSaleId(null);
    queryClient.invalidateQueries({ queryKey: ["sales"] });
  };

  const isLoading = clinicLoading || registerLoading;
  const isRegisterOpen = !!openRegister;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Carregando Frente de Caixa...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col">
      <Dialog open={!isRegisterOpen}>
        <DialogContent className="sm:max-w-md [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Lock className="w-5 h-5 text-amber-500" /> Caixa Fechado
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Para iniciar as operações do PDV, informe o Fundo de Caixa.
            </p>
            <form onSubmit={handleOpenRegister} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Troco Inicial (R$)</label>
                <Input type="number" step="0.01" required value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} className="text-lg" />
              </div>
              <Button type="submit" className="w-full h-11" disabled={openRegisterMutation.isPending}>
                {openRegisterMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Store className="w-4 h-4 mr-2" />}
                Abrir Caixa Agora
              </Button>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      <div className="mb-4 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm w-max">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-[340px]">
           <TabsList className="grid w-full grid-cols-2 h-10">
             <TabsTrigger value="pdv" className="text-sm font-semibold">Operacional</TabsTrigger>
             <TabsTrigger value="caixa" className="text-sm font-semibold">Gestão de Caixa</TabsTrigger>
           </TabsList>
        </Tabs>
      </div>

      {viewMode === "pdv" ? (
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="w-2/3 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-900 border rounded-xl shadow-sm p-4 flex justify-between items-center shrink-0">
             <h2 className="text-lg font-semibold tracking-tight">Fila do Dia</h2>
             <div className="flex gap-2">
               <Button variant="outline" className="font-semibold" onClick={() => setShowRegisterMgmt(true)}>
                  <Settings2 className="w-4 h-4 mr-2" /> Caixa
               </Button>
               <Button variant="default" className="font-semibold shadow-md" onClick={() => setShowAddItem(true)}>
                  + Venda Avulsa
               </Button>
             </div>
          </div>
          <div className="flex-1 bg-white dark:bg-slate-900 border rounded-xl shadow-sm overflow-hidden flex flex-col">
             <Tabs defaultValue="agendadas" className="w-full h-full flex flex-col">
                <TabsList className="w-full justify-start rounded-none border-b border-border bg-muted/20 px-4 h-12">
                   <TabsTrigger value="agendadas" className="data-[state=active]:bg-background">Agendadas</TabsTrigger>
                   <TabsTrigger value="abertas" className="data-[state=active]:bg-background">Abertas</TabsTrigger>
                   <TabsTrigger value="fechadas" className="data-[state=active]:bg-background">Fechadas</TabsTrigger>
                </TabsList>
                <TabsContent value="agendadas" className="flex-1 overflow-y-auto p-4 mt-0">
                    <AppointmentsList onSelect={handleSelectAppointment} professionalId={isProfessional ? professionalId : undefined} />
                </TabsContent>
                <TabsContent value="abertas" className="flex-1 overflow-y-auto p-0 mt-0">
                    <SalesList barbershopId={clinic?.id} status="open" onSelectSale={handleSelectSale} createdBy={isProfessional ? user?.id : undefined} />
                </TabsContent>
                <TabsContent value="fechadas" className="flex-1 overflow-y-auto p-0 mt-0">
                    <SalesList barbershopId={clinic?.id} status="paid" onSelectSale={handleSelectSale} createdBy={isProfessional ? user?.id : undefined} />
                </TabsContent>
             </Tabs>
          </div>
        </div>

        <div className="w-1/3 bg-white dark:bg-slate-900 border rounded-xl shadow-sm flex flex-col overflow-hidden">
          <CartPanel 
            items={cartItems} 
            customerName={customerName}
            onRemoveItem={handleRemoveItem}
            onClear={() => { setCartItems([]); setCustomerName(""); setCustomerId(null); setCurrentSaleId(null); }}
            onCheckout={() => setShowCheckout(true)}
            onSaveOpenSale={handleSaveOpenSale}
          />
        </div>
      </div>
      ) : (
        <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 border rounded-xl shadow-sm p-4">
          <CashRegisterPanel />
        </div>
      )}

      <CheckoutModal 
        open={showCheckout} 
        onOpenChange={setShowCheckout}
        items={cartItems}
        customerName={customerName}
        onConfirm={handleCheckout}
        isSubmitting={checkoutMutation.isPending}
      />

      <AddItemModal
        open={showAddItem}
        onOpenChange={setShowAddItem}
        onAdd={handleAddManualItem}
      />

      {openRegister && clinic?.id && (
        <RegisterManagementModal
          open={showRegisterMgmt}
          onOpenChange={setShowRegisterMgmt}
          activeRegister={openRegister}
          clinicId={clinic.id}
        />
      )}
    </div>
  );
}
