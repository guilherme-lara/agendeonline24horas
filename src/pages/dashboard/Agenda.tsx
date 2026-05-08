import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Loader2, Search, Clock, LayoutGrid, List,
  Check, XCircle, Play, Phone, MessageSquare, QrCode, User,
  Pencil, AlertTriangle, History, ArrowRight, DollarSign, Unlock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react";
import CalendarView from "@/components/CalendarView";
import QuickBooking from "@/components/QuickBooking";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-stone-500/10 text-stone-600 border-stone-500/20" },
  pendente_pagamento: { label: "⏳ Aguard. Pagamento - Expira em breve", className: "bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse" },
  confirmed: { label: "Confirmado", className: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  completed: { label: "Concluído", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  cancelled: { label: "Cancelado", className: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20" },
};

const AppointmentStatusBadge = ({ appt }: { appt: any }) => {
  const config = statusBadgeConfig[appt.status] || statusBadgeConfig.pending;
  // Countdown for pending_payment
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (appt.status !== "pendente_pagamento" || !appt.expires_at) {
      setTimeLeft(null);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(appt.expires_at).getTime() - Date.now()) / 1000));
      if (diff <= 0) {
        setTimeLeft("Expirado");
        return;
      }
      const mm = Math.floor(diff / 60);
      const ss = String(diff % 60).padStart(2, "0");
      setTimeLeft(`${mm}:${ss}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [appt.status, appt.expires_at]);

  return (
    <div className="flex flex-col gap-1">
      <Badge className={`${config.className} border font-black text-[9px] uppercase px-3 py-1`}>
        {config.label}
      </Badge>
      {timeLeft && (
        <span className={`text-[9px] font-black tabular-nums ${timeLeft === "Expirado" ? "text-red-500" : "text-amber-600/80"}`}>
          {timeLeft === "Expirado" ? "⚠️ Reserva Expirada" : `Expira em ${timeLeft}`}
        </span>
      )}
    </div>
  );
};

const Agenda = () => {
  const { clinic } = useClinic() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [editModal, setEditModal] = useState({ open: false, appt: null as any });

  const queryEnabled = !!clinic?.id;

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", clinic?.id)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
    staleTime: 0,
  });

  useEffect(() => {
    if (!clinic?.id) return;
    const channel = supabase
      .channel(`agenda-realtime-${clinic.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments', filter: `barbershop_id=eq.${clinic.id}` },
        () => queryClient.invalidateQueries({ queryKey: ["appointments", clinic.id] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinic?.id, queryClient]);

  const { data: services = [] } = useQuery({
    queryKey: ["services", clinic?.id], enabled: queryEnabled,
    queryFn: async () => {
      const { data } = await supabase.from("services").select("*").eq("barbershop_id", clinic?.id).eq("active", true).order("sort_order");
      return data || [];
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...updates } = payload;
      const { error } = await supabase.from("appointments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setEditModal({ open: false, appt: null });
      toast({ title: "Agendamento Atualizado!" });
    }
  });
  
  const handleWhatsAppClick = (appt: any) => {
    if (!appt.client_phone) {
      toast({ title: "Cliente sem telefone", description: "Não é possível enviar mensagem pois o cliente não tem um telefone cadastrado.", variant: "destructive" });
      return;
    }
    const cleanPhone = appt.client_phone.replace(/\D/g, '');
    const clientName = appt.client_name;
    const serviceName = appt.service_name;
    const date = format(parseISO(appt.scheduled_at), "dd/MM/yyyy", { locale: ptBR });
    const time = format(parseISO(appt.scheduled_at), "HH:mm");
    const shopName = clinic.name;

    const message = `Olá, ${clientName}! Passando para confirmar seu agendamento para o serviço "${serviceName}" no dia ${date} às ${time} na ${shopName}. Estamos te esperando!`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
  };

  const filtered = useMemo(() => {
    return appointments.filter((a: any) => {
      const isCompleted = a.status === "completed" || a.status === "cancelled";
      const tabMatch = activeTab === "active" ? !isCompleted : isCompleted;
      const searchMatch = !search.trim() || 
        a.client_name.toLowerCase().includes(search.toLowerCase()) || 
        a.service_name.toLowerCase().includes(search.toLowerCase());
      return tabMatch && searchMatch;
    });
  }, [appointments, activeTab, search]);

  const handleOpenEdit = (appt: any) => {
    const d = parseISO(appt.scheduled_at);
    setEditModal({ open: true, appt: { ...appt, scheduled_date: format(d, 'yyyy-MM-dd'), scheduled_time: format(d, 'HH:mm') } });
  };

  if (isLoading && queryEnabled && !appointments.length) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center"><Loader2 className="animate-spin text-primary h-8 w-8 mx-auto mb-4" /><p className="text-muted-foreground">Carregando agendamentos...</p></div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background p-4 lg:p-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-3 font-display"><CalendarDays className="text-zinc-900" /> Agenda</h1>
          <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mt-1">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white border border-zinc-200 p-1 rounded-xl shadow-sm">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab("active")} className={`rounded-lg px-6 ${activeTab === "active" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}><Clock className="h-4 w-4 mr-2" /> Ativos</Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab("completed")} className={`rounded-lg px-6 ${activeTab === "completed" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50"}`}><History className="h-4 w-4 mr-2" /> Histórico</Button>
          </div>
          <div className="h-8 w-[1px] bg-zinc-200 mx-2 hidden xl:block" />
          <div className="flex bg-white border border-zinc-200 p-1 rounded-xl shadow-sm">
            <Button variant="ghost" size="sm" onClick={() => setViewMode("calendar")} className={`rounded-lg ${viewMode === "calendar" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50"}`}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className={`rounded-lg ${viewMode === "list" ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50"}`}><List className="h-4 w-4" /></Button>
          </div>
          <QuickBooking barbershopId={clinic?.id} services={services} onBooked={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} />
        </div>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 h-5 w-5" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar por cliente ou serviço..." className="w-full bg-white border border-zinc-200 h-14 pl-14 rounded-xl text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent placeholder:text-zinc-400 shadow-sm transition-all" />
      </div>

      {viewMode === "list" ? (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 border-b border-zinc-100"><tr className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  <th className="px-8 py-6 text-left">Hora</th><th className="px-8 py-6 text-left">Cliente</th><th className="px-8 py-6 text-left">Serviço / Profissional</th>
                  <th className="px-8 py-6 text-left">Preço</th><th className="px-8 py-6 text-left">Status</th><th className="px-8 py-6 text-right">Ações</th>
              </tr></thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((a: any) => (
                  <tr key={a.id} className={`hover:bg-zinc-50/80 transition-colors group ${a.status === 'pendente_pagamento' ? 'opacity-50' : ''}`}>
                    <td className="px-8 py-5 text-zinc-900 font-bold text-lg">{format(parseISO(a.scheduled_at), "HH:mm")}</td>
                    <td className="px-8 py-5">
                      <p className="text-zinc-900 font-bold">{a.client_name}</p>
                      <p className="text-[10px] text-zinc-400 font-mono">{a.client_phone}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-foreground/80 text-sm font-medium">{a.service_name}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground uppercase font-black flex-wrap">
                         <User className="h-3 w-3" /> {a.barber_name || "Geral"}
                         {(a.has_signal || a.payment_status === 'paid') && (
                            <Badge className="ml-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] px-1.5 py-0">
                              {a.signal_value > 0 ? `SINAL PAGO R$${Number(a.signal_value).toFixed(0)}` : "PAGO"}
                            </Badge>
                         )}
                       </div>
                    </td>
                    <td className="px-8 py-5 font-bold text-emerald-500 text-sm">R$ {Number(a.price).toFixed(2)}</td>
                    <td className="px-8 py-5">
                      <AppointmentStatusBadge appt={a} />
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        {a.status === 'confirmed' && a.client_phone && (
                          <Button variant="ghost" size="icon" onClick={() => handleWhatsAppClick(a)} className="h-10 w-10 rounded-full hover:bg-green-500/10 text-green-500 hover:scale-105 transition-transform" title="Confirmar agendamento com cliente via WhatsApp">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(a)} className="h-10 w-10 rounded-full hover:bg-secondary text-muted-foreground hover:text-primary hover:scale-105 transition-transform" title="Editar Agendamento">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {activeTab === "active" && a.status !== 'pendente_pagamento' && (
                          <Button variant="ghost" size="icon" onClick={() => window.location.href = '/dashboard/caixa'} className="h-10 w-10 rounded-full hover:bg-emerald-500/10 text-emerald-500 hover:scale-105 transition-transform" title="Iniciar Checkout e Fechar Conta">
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && ( <tr><td colSpan={6} className="px-8 py-16 text-center text-muted-foreground text-sm">Nenhum agendamento encontrado para os filtros selecionados.</td></tr> )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <CalendarView appointments={filtered} barbershopId={clinic?.id} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} onEventClick={handleOpenEdit} />
      )}

      <Dialog open={editModal.open} onOpenChange={(o) => !o && setEditModal({ open: false, appt: null })}>
        <DialogContent className="bg-card border-border/50 text-foreground max-w-2xl rounded-2xl shadow-card">
          <DialogHeader><DialogTitle className="text-2xl font-black flex items-center gap-2 font-display"><Pencil className="text-primary h-6 w-6" /> Editar Agendamento</DialogTitle></DialogHeader>
          {editModal.appt && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4">
              <div className="space-y-2"><label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nome do Cliente</label><Input defaultValue={editModal.appt.client_name} onChange={(e) => updateMutation.mutate({ id: editModal.appt.id, client_name: e.target.value })} className="bg-background border-border" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Telefone (WhatsApp)</label><Input defaultValue={editModal.appt.client_phone} onChange={(e) => updateMutation.mutate({ id: editModal.appt.id, client_phone: e.target.value })} className="bg-background border-border font-mono" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</label><select defaultValue={editModal.appt.status} onChange={(e) => updateMutation.mutate({ id: editModal.appt.id, status: e.target.value })} className="w-full bg-background border border-border rounded-xl h-10 px-3 text-sm text-foreground"><option value="pendente_pagamento">Aguardando Pagamento</option><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agenda;
