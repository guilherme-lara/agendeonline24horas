import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Loader2, Search, Clock, LayoutGrid, List,
  MessageSquare, User, Pencil, History, ArrowRight
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

const statusBadgeConfig: Record<string, { label: string; dot: string; chip: string }> = {
  pending:              { label: "Pendente",          dot: "bg-sys-text-muted",      chip: "bg-sys-bg-base text-sys-text-muted border-sys-border" },
  pendente_pagamento:   { label: "Aguardando Pgto",   dot: "bg-sys-status-warning",  chip: "bg-sys-status-warning/10 text-sys-status-warning border-sys-status-warning/30 animate-pulse" },
  confirmed:            { label: "Confirmado",        dot: "bg-sys-status-info",     chip: "bg-sys-status-info/10 text-sys-status-info border-sys-status-info/30" },
  completed:            { label: "Concluído",         dot: "bg-sys-status-success",  chip: "bg-sys-status-success/10 text-sys-status-success border-sys-status-success/30" },
  cancelled:            { label: "Cancelado",         dot: "bg-sys-status-danger",   chip: "bg-sys-status-danger/10 text-sys-status-danger border-sys-status-danger/30" },
};

const AppointmentStatusBadge = ({ appt }: { appt: any }) => {
  const config = statusBadgeConfig[appt.status] || statusBadgeConfig.pending;
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (appt.status !== "pendente_pagamento" || !appt.expires_at) { setTimeLeft(null); return; }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(appt.expires_at).getTime() - Date.now()) / 1000));
      if (diff <= 0) { setTimeLeft("Expirado"); return; }
      const mm = Math.floor(diff / 60);
      const ss = String(diff % 60).padStart(2, "0");
      setTimeLeft(`${mm}:${ss}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [appt.status, appt.expires_at]);

  return (
    <div className="flex flex-col gap-1 items-start">
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.chip}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
      {timeLeft && (
        <span className={`text-[10px] font-semibold tabular-nums ${timeLeft === "Expirado" ? "text-sys-status-danger" : "text-sys-status-warning"}`}>
          {timeLeft === "Expirado" ? "Reserva expirada" : `Expira em ${timeLeft}`}
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
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
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
      .on('postgres_changes',
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
      toast({ title: "Agendamento atualizado" });
    }
  });

  const handleWhatsAppClick = (appt: any) => {
    if (!appt.client_phone) {
      toast({ title: "Cliente sem telefone", description: "Não é possível enviar mensagem.", variant: "destructive" });
      return;
    }
    const cleanPhone = appt.client_phone.replace(/\D/g, '');
    const date = format(parseISO(appt.scheduled_at), "dd/MM/yyyy", { locale: ptBR });
    const time = format(parseISO(appt.scheduled_at), "HH:mm");
    const message = `Olá, ${appt.client_name}! Passando para confirmar seu agendamento para "${appt.service_name}" no dia ${date} às ${time} na ${clinic.name}. Estamos te esperando!`;
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
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

  // Quick KPIs for the day
  const todayStats = useMemo(() => {
    const today = new Date().toDateString();
    const todayAppts = appointments.filter((a: any) => new Date(a.scheduled_at).toDateString() === today && a.status !== 'cancelled');
    const revenue = todayAppts.reduce((sum: number, a: any) => sum + Number(a.price || 0), 0);
    return { count: todayAppts.length, revenue };
  }, [appointments]);

  const handleOpenEdit = (appt: any) => {
    const d = parseISO(appt.scheduled_at);
    setEditModal({ open: true, appt: { ...appt, scheduled_date: format(d, 'yyyy-MM-dd'), scheduled_time: format(d, 'HH:mm') } });
  };

  if (isLoading && queryEnabled && !appointments.length) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center"><Loader2 className="animate-spin text-sys-brand-primary h-8 w-8 mx-auto mb-4" /><p className="text-sys-text-muted">Carregando agendamentos...</p></div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-sys-bg-base p-4 lg:p-6 animate-in fade-in duration-300">

      {/* Compact toolbar (single row, SalonSoft style) */}
      <div className="bg-sys-surface border border-sys-border rounded-2xl shadow-sm px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 mr-2">
          <div className="h-9 w-9 rounded-xl bg-sys-brand-primary/10 text-sys-brand-primary flex items-center justify-center">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-semibold text-sys-text-primary">Agenda</h1>
            <p className="text-[11px] text-sys-text-muted capitalize">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4 px-4 border-l border-sys-border">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sys-text-muted">Hoje</p>
            <p className="text-sm font-bold text-sys-text-primary">{todayStats.count} agendamentos</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-sys-text-muted">Receita prevista</p>
            <p className="text-sm font-bold text-sys-status-success">R$ {todayStats.revenue.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sys-text-muted h-4 w-4" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente ou serviço..."
            className="h-9 pl-9 bg-sys-bg-base border-sys-border text-sm" />
        </div>

        <div className="flex bg-sys-bg-base border border-sys-border p-0.5 rounded-lg">
          <button onClick={() => setActiveTab("active")} className={`px-3 h-8 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${activeTab === "active" ? "bg-sys-surface text-sys-text-primary shadow-sm" : "text-sys-text-muted hover:text-sys-text-primary"}`}>
            <Clock className="h-3.5 w-3.5" /> Ativos
          </button>
          <button onClick={() => setActiveTab("completed")} className={`px-3 h-8 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${activeTab === "completed" ? "bg-sys-surface text-sys-text-primary shadow-sm" : "text-sys-text-muted hover:text-sys-text-primary"}`}>
            <History className="h-3.5 w-3.5" /> Histórico
          </button>
        </div>

        <div className="flex bg-sys-bg-base border border-sys-border p-0.5 rounded-lg">
          <button onClick={() => setViewMode("calendar")} className={`h-8 w-8 rounded-md inline-flex items-center justify-center transition-colors ${viewMode === "calendar" ? "bg-sys-surface text-sys-brand-primary shadow-sm" : "text-sys-text-muted hover:text-sys-text-primary"}`} title="Grade">
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={`h-8 w-8 rounded-md inline-flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-sys-surface text-sys-brand-primary shadow-sm" : "text-sys-text-muted hover:text-sys-text-primary"}`} title="Lista">
            <List className="h-4 w-4" />
          </button>
        </div>

        <QuickBooking barbershopId={clinic?.id} services={services} onBooked={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} />
      </div>

      {viewMode === "list" ? (
        <div className="bg-sys-surface border border-sys-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-sys-bg-base border-b border-sys-border">
                <tr className="text-[10px] uppercase font-semibold text-sys-text-muted tracking-wider">
                  <th className="px-4 py-3 text-left">Hora</th>
                  <th className="px-4 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Serviço / Profissional</th>
                  <th className="px-4 py-3 text-left">Preço</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sys-border">
                {filtered.map((a: any) => {
                  const cfg = statusBadgeConfig[a.status] || statusBadgeConfig.pending;
                  return (
                    <tr key={a.id} className={`hover:bg-sys-bg-base/60 transition-colors group ${a.status === 'pendente_pagamento' ? 'opacity-70' : ''}`}>
                      <td className={`px-4 py-3 font-bold text-sys-text-primary tabular-nums border-l-4 ${cfg.dot.replace('bg-', 'border-')}`}>
                        {format(parseISO(a.scheduled_at), "HH:mm")}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sys-text-primary font-semibold">{a.client_name}</p>
                        <p className="text-[11px] text-sys-text-muted font-mono">{a.client_phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sys-text-primary text-sm">{a.service_name}</p>
                        <p className="flex items-center gap-1 mt-0.5 text-[11px] text-sys-text-muted">
                          <User className="h-3 w-3" /> {a.barber_name || "Geral"}
                          {(a.has_signal || a.payment_status === 'paid') && (
                            <Badge className="ml-2 bg-sys-status-success/10 text-sys-status-success border border-sys-status-success/30 text-[9px] px-1.5 py-0">
                              {a.signal_value > 0 ? `Sinal R$${Number(a.signal_value).toFixed(0)}` : "Pago"}
                            </Badge>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-bold text-sys-text-primary">R$ {Number(a.price).toFixed(2)}</td>
                      <td className="px-4 py-3"><AppointmentStatusBadge appt={a} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {a.status === 'confirmed' && a.client_phone && (
                            <Button variant="ghost" size="icon" onClick={() => handleWhatsAppClick(a)} className="h-8 w-8 rounded-lg text-sys-status-success hover:bg-sys-status-success/10" title="WhatsApp">
                              <MessageSquare className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(a)} className="h-8 w-8 rounded-lg text-sys-text-muted hover:text-sys-brand-primary hover:bg-sys-brand-primary/10" title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {activeTab === "active" && a.status !== 'pendente_pagamento' && (
                            <Button variant="ghost" size="icon" onClick={() => window.location.href = '/dashboard/caixa'} className="h-8 w-8 rounded-lg text-sys-status-success hover:bg-sys-status-success/10" title="Ir para o Caixa">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-8 py-16 text-center text-sys-text-muted text-sm">Nenhum agendamento encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <CalendarView appointments={filtered} barbershopId={clinic?.id} onRefresh={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} onEventClick={handleOpenEdit} />
      )}

      <Dialog open={editModal.open} onOpenChange={(o) => !o && setEditModal({ open: false, appt: null })}>
        <DialogContent className="bg-sys-surface border-sys-border text-sys-text-primary max-w-2xl rounded-2xl shadow-lg">
          <DialogHeader><DialogTitle className="text-xl font-semibold flex items-center gap-2"><Pencil className="text-sys-brand-primary h-5 w-5" /> Editar Agendamento</DialogTitle></DialogHeader>
          {editModal.appt && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-2">
              <div className="space-y-1.5"><label className="text-[11px] font-semibold text-sys-text-muted uppercase tracking-wide">Nome do Cliente</label><Input defaultValue={editModal.appt.client_name} onChange={(e) => updateMutation.mutate({ id: editModal.appt.id, client_name: e.target.value })} className="bg-sys-bg-base border-sys-border" /></div>
              <div className="space-y-1.5"><label className="text-[11px] font-semibold text-sys-text-muted uppercase tracking-wide">Telefone (WhatsApp)</label><Input defaultValue={editModal.appt.client_phone} onChange={(e) => updateMutation.mutate({ id: editModal.appt.id, client_phone: e.target.value })} className="bg-sys-bg-base border-sys-border font-mono" /></div>
              <div className="space-y-1.5"><label className="text-[11px] font-semibold text-sys-text-muted uppercase tracking-wide">Status</label><select defaultValue={editModal.appt.status} onChange={(e) => updateMutation.mutate({ id: editModal.appt.id, status: e.target.value })} className="w-full bg-sys-bg-base border border-sys-border rounded-xl h-10 px-3 text-sm text-sys-text-primary"><option value="pendente_pagamento">Aguardando Pagamento</option><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agenda;
