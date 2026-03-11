import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Loader2, Search, Clock, LayoutGrid, List,
  Check, XCircle, Play, Phone, MessageSquare, QrCode, User,
  Pencil, AlertTriangle, History, ArrowRight, DollarSign, Unlock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect } from "react"; // Adicionado useEffect
import CalendarView from "@/components/CalendarView";
import QuickBooking from "@/components/QuickBooking";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  confirmed: { label: "Confirmado", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  completed: { label: "Concluído", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pendente_sinal: { label: "Aguard. Sinal", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
};

const paymentBadgeConfig: Record<string, { label: string; className: string }> = {
  paid: { label: "100% Pago", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  awaiting: { label: "Aguardando Pix", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  pending_local: { label: "Pagar no Local", className: "bg-muted text-muted-foreground border-border" },
  expired: { label: "Expirado", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const Agenda = () => {
  const { barbershop } = useBarbershop() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [editModal, setEditModal] = useState({ open: false, appt: null as any });

  const queryEnabled = !!barbershop?.id;

  // 1. Busca Agendamentos com Cache ZERO para Realtime
  const { data: appointments = [], isLoading, isError } = useQuery({
    queryKey: ["appointments", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", barbershop?.id)
        .neq("status", "pendente_sinal")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
    staleTime: 0, // Atualiza sempre
    refetchInterval: 30000, // Backup: checa a cada 30s
    retry: 2,
    refetchOnWindowFocus: true,
  });

  // 2. IMPLEMENTAÇÃO REALTIME
  useEffect(() => {
    if (!barbershop?.id) return;

    // Escuta mudanças na tabela de agendamentos desta barbearia específica
    const channel = supabase
      .channel(`agenda-realtime-${barbershop.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Escuta INSERT, UPDATE e DELETE
          schema: 'public',
          table: 'appointments',
          filter: `barbershop_id=eq.${barbershop.id}`
        },
        (payload) => {
          console.log("🔔 Mudança detectada na agenda:", payload);
          // Força o TanStack Query a buscar os dados novos
          queryClient.invalidateQueries({ queryKey: ["appointments", barbershop?.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barbershop?.id, queryClient]);

  // Busca Serviços (Para o Modal de Edição)
  const { data: services = [] } = useQuery({
    queryKey: ["services", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("barbershop_id", barbershop?.id).eq("active", true).order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  // Busca Barbeiros (Para o Modal de Edição)
  const { data: barbers = [] } = useQuery({
    queryKey: ["barbers", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("barbers" as any).select("*").eq("barbershop_id", barbershop?.id);
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
  });

  // MUTAÇÃO DE LIBERAR HORÁRIO (cancelar PIX expirado)
  const releaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").update({ status: "cancelled", payment_status: "expired" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Horário liberado!", description: "A vaga foi disponibilizada na agenda pública." });
    }
  });

  // MUTAÇÃO DE UPDATE COMPLETA
  const updateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, scheduled_date, scheduled_time, ...updates } = payload;
      
      if (scheduled_date && scheduled_time) {
        updates.scheduled_at = new Date(`${scheduled_date}T${scheduled_time}:00`).toISOString();
      }

      const { error } = await supabase.from("appointments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setEditModal({ open: false, appt: null });
      toast({ title: "Agendamento Atualizado!" });
    }
  });

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
    setEditModal({
      open: true,
      appt: {
        ...appt,
        scheduled_date: format(d, 'yyyy-MM-dd'),
        scheduled_time: format(d, 'HH:mm')
      }
    });
  };

  const shouldShowLoading = isLoading && queryEnabled && !appointments.length && !isError;

  if (shouldShowLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-primary h-8 w-8 mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando agendamentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background p-4 lg:p-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tighter flex items-center gap-3 font-display">
            <CalendarDays className="text-primary" /> Agenda
          </h1>
          <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest mt-1">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-card border border-border p-1 rounded-2xl">
            <Button variant="ghost" size="sm" onClick={() => setActiveTab("active")} className={`rounded-xl px-6 ${activeTab === "active" ? "gold-gradient text-primary-foreground shadow-gold" : "text-muted-foreground"}`}>
              <Clock className="h-4 w-4 mr-2" /> Ativos
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setActiveTab("completed")} className={`rounded-xl px-6 ${activeTab === "completed" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
              <History className="h-4 w-4 mr-2" /> Histórico
            </Button>
          </div>

          <div className="h-8 w-[1px] bg-border mx-2 hidden xl:block" />

          <div className="flex bg-card border border-border p-1 rounded-2xl">
            <Button variant="ghost" size="sm" onClick={() => setViewMode("calendar")} className={`rounded-xl ${viewMode === "calendar" ? "bg-secondary text-primary" : "text-muted-foreground"}`}><LayoutGrid className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className={`rounded-xl ${viewMode === "list" ? "bg-secondary text-primary" : "text-muted-foreground"}`}><List className="h-4 w-4" /></Button>
          </div>
          
          <QuickBooking barbershopId={barbershop?.id} services={services} onBooked={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} />
        </div>
      </div>

      {/* BUSCA */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
        <input 
          value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por cliente, serviço ou barbeiro..." 
          className="w-full bg-card border border-border h-14 pl-12 rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
        />
      </div>

      {/* VIEW RENDERER */}
      {viewMode === "list" ? (
        <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-secondary/50 border-b border-border">
                <tr className="text-[10px] uppercase font-black text-muted-foreground tracking-[0.2em]">
                  <th className="px-8 py-6 text-left">Hora</th>
                  <th className="px-8 py-6 text-left">Cliente</th>
                  <th className="px-8 py-6 text-left">Serviço / Profissional</th>
                  <th className="px-8 py-6 text-left">Preço</th>
                  <th className="px-8 py-6 text-left">Status</th>
                  <th className="px-8 py-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map((a: any) => {
                  const isExpiredPix = a.status === 'pending' && a.payment_method === 'pix_online' && ['pending', 'awaiting'].includes(a.payment_status) && a.created_at && (Date.now() - new Date(a.created_at).getTime() > 15 * 60 * 1000);
                  return (
                  <tr key={a.id} className={`hover:bg-secondary/30 transition-colors group ${isExpiredPix ? 'bg-destructive/5 border-l-4 border-l-destructive' : ''}`}>
                    <td className="px-8 py-5 text-primary font-black text-lg">{format(parseISO(a.scheduled_at), "HH:mm")}</td>
                    <td className="px-8 py-5">
                      <p className="text-foreground font-bold">{a.client_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{a.client_phone}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-foreground/80 text-sm font-medium">{a.service_name}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground uppercase font-black flex-wrap">
                         <User className="h-3 w-3" /> {a.barber_name || "Geral"}
                         {a.has_signal && a.signal_value > 0 && (
                            <Badge className="ml-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] px-1.5 py-0">
                              SINAL R${Number(a.signal_value).toFixed(0)}
                            </Badge>
                         )}
                         {a.payment_status && paymentBadgeConfig[a.payment_status] && (
                            <Badge className={`ml-1 border text-[8px] px-1.5 py-0 ${paymentBadgeConfig[a.payment_status].className}`}>
                              {paymentBadgeConfig[a.payment_status].label}
                            </Badge>
                         )}
                       </div>
                    </td>
                    <td className="px-8 py-5 font-bold text-emerald-500 text-sm">R$ {Number(a.price).toFixed(2)}</td>
                    <td className="px-8 py-5">
                      <Badge className={`${statusBadgeConfig[a.status]?.className || statusBadgeConfig.pending.className} border font-black text-[9px] uppercase px-3 py-1`}>
                        {statusBadgeConfig[a.status]?.label || a.status}
                      </Badge>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" size="icon" 
                          onClick={() => handleOpenEdit(a)}
                          className="h-10 w-10 rounded-xl hover:bg-secondary text-muted-foreground hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {activeTab === "active" && !isExpiredPix && (
                          <Button 
                            variant="ghost" size="icon" 
                            onClick={() => window.location.href = '/dashboard/caixa'}
                            className="h-10 w-10 rounded-xl hover:bg-emerald-500/10 text-emerald-500"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                        {isExpiredPix && (
                          <Button 
                            variant="ghost" size="sm"
                            onClick={() => releaseMutation.mutate(a.id)}
                            disabled={releaseMutation.isPending}
                            className="h-10 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive font-bold text-xs gap-1.5"
                          >
                            <Unlock className="h-3.5 w-3.5" /> Liberar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center text-muted-foreground text-sm">
                      Nenhum agendamento encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <CalendarView 
          appointments={filtered} 
          barbershopId={barbershop?.id}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })}
          onEventClick={handleOpenEdit} 
        />
      )}

      {/* MODAL DE EDIÇÃO */}
      <Dialog open={editModal.open} onOpenChange={(o) => !o && setEditModal({ open: false, appt: null })}>
        <DialogContent className="bg-card border-border text-foreground max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2 font-display">
              <Pencil className="text-primary h-6 w-6" /> Editar Agendamento
            </DialogTitle>
          </DialogHeader>
          
          {editModal.appt && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Nome do Cliente</label>
                <Input defaultValue={editModal.appt.client_name} onChange={(e) => editModal.appt.client_name = e.target.value} className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Telefone (WhatsApp)</label>
                <Input defaultValue={editModal.appt.client_phone} onChange={(e) => editModal.appt.client_phone = e.target.value} className="bg-background border-border font-mono" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Serviço</label>
                <select defaultValue={editModal.appt.service_name} onChange={(e) => editModal.appt.service_name = e.target.value} className="w-full bg-background border border-border rounded-xl h-10 px-3 text-sm text-foreground">
                  <option value={editModal.appt.service_name}>{editModal.appt.service_name}</option>
                  {services.map((s: any) => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Profissional</label>
                <select defaultValue={editModal.appt.barber_name} onChange={(e) => editModal.appt.barber_name = e.target.value} className="w-full bg-background border border-border rounded-xl h-10 px-3 text-sm text-foreground">
                  <option value="">Geral / Qualquer um</option>
                  <option value={editModal.appt.barber_name}>{editModal.appt.barber_name}</option>
                  {barbers.map((b: any) => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Data</label>
                <Input type="date" defaultValue={editModal.appt.scheduled_date} onChange={(e) => editModal.appt.scheduled_date = e.target.value} className="bg-background border-border" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Hora</label>
                <Input type="time" defaultValue={editModal.appt.scheduled_time} onChange={(e) => editModal.appt.scheduled_time = e.target.value} className="bg-background border-border" />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Valor Total (R$)</label>
                <Input type="number" defaultValue={editModal.appt.price} onChange={(e) => editModal.appt.price = Number(e.target.value)} className="bg-background border-border text-emerald-500 font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</label>
                <select defaultValue={editModal.appt.status} onChange={(e) => editModal.appt.status = e.target.value} className="w-full bg-background border border-border rounded-xl h-10 px-3 text-sm text-foreground">
                  <option value="pending">Pendente</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="col-span-2 bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-center gap-4 mt-2">
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-bold text-amber-500 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Controle de Sinal Adiantado</p>
                  <p className="text-[10px] text-muted-foreground">O valor abaixo será subtraído na hora do fechamento de caixa.</p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm font-bold cursor-pointer">
                    <input type="checkbox" defaultChecked={editModal.appt.has_signal} onChange={(e) => editModal.appt.has_signal = e.target.checked} className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500" />
                    Teve Sinal?
                  </label>
                  <Input type="number" placeholder="Valor (R$)" defaultValue={editModal.appt.signal_value || 0} onChange={(e) => editModal.appt.signal_value = Number(e.target.value)} className="w-32 bg-background border-border font-mono font-bold text-amber-500" />
                </div>
              </div>

              <Button 
                className="col-span-2 mt-4 gold-gradient text-primary-foreground font-black h-14 rounded-xl shadow-gold text-lg transition-transform active:scale-[0.98]"
                onClick={() => updateMutation.mutate(editModal.appt)}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar Alterações Completas"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agenda;
