import { useEffect, useState } from "react";
import {
  CalendarDays, Loader2, Search, Clock, LayoutGrid, List,
  Check, XCircle, Play, Phone, MessageSquare, QrCode,
  Banknote, CalendarPlus, Maximize, Minimize, ExternalLink, Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, compareAsc, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import CalendarView from "@/components/CalendarView";
import QuickBooking from "@/components/QuickBooking";
import CompletionModal from "@/components/CompletionModal";
import PixPaymentModal from "@/components/PixPaymentModal";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
  payment_status: string;
  payment_method: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Confirmado", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  completed: { label: "Concluído", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelado", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const paymentBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Aguardando", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  pending_local: { label: "Pagar no Local", className: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  awaiting: { label: "Pix Enviado", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  paid: { label: "Pago", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  failed: { label: "Falhou", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const Agenda = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [barberFilter, setBarberFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [kioskMode, setKioskMode] = useState(false);
  const [completionModal, setCompletionModal] = useState<{ open: boolean; appointmentId: string }>({ open: false, appointmentId: "" });
  const [pixModal, setPixModal] = useState<{ open: boolean; data: { paymentUrl: string; pixCode: string } | null; price: number; serviceName: string }>({ open: false, data: null, price: 0, serviceName: "" });
  const [barbers, setBarbers] = useState<{ id: string; name: string }[]>([]);
  const [editModal, setEditModal] = useState<{ open: boolean; appt: Appointment | null }>({ open: false, appt: null });
  const [editForm, setEditForm] = useState({ client_name: "", client_phone: "", service_name: "", barber_name: "", scheduled_date: "", scheduled_time: "", price: "" });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!barbershop) return;
    const fetchData = async () => {
      const [apptRes, svcRes, barberRes] = await Promise.all([
        supabase.from("appointments").select("*").eq("barbershop_id", barbershop.id).neq("status", "pendente_sinal").order("scheduled_at", { ascending: false }),
        supabase.from("services").select("id, name, price, duration").eq("barbershop_id", barbershop.id).eq("active", true).order("sort_order"),
        supabase.from("barbers").select("id, name").eq("barbershop_id", barbershop.id).eq("active", true),
      ]);
      setAppointments((apptRes.data as Appointment[]) || []);
      setServices((svcRes.data as Service[]) || []);
      setBarbers((barberRes.data as { id: string; name: string }[]) || []);
      setLoading(false);
    };
    fetchData();
  }, [barbershop]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!barbershop) return null;

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const now = new Date();
  const activeAppointments = appointments.filter((a) => a.status !== "cancelled");
  const todayAppointments = activeAppointments.filter((a) => a.scheduled_at.startsWith(todayStr));
  const nextClients = todayAppointments
    .filter((a) => new Date(a.scheduled_at) >= now)
    .sort((a, b) => compareAsc(new Date(a.scheduled_at), new Date(b.scheduled_at)))
    .slice(0, 5);

  const refreshAppts = async () => {
    const { data } = await supabase.from("appointments").select("*").eq("barbershop_id", barbershop.id).neq("status", "pendente_sinal").order("scheduled_at", { ascending: false });
    setAppointments((data as Appointment[]) || []);
  };

  const openEditModal = (appt: Appointment) => {
    const dt = new Date(appt.scheduled_at);
    setEditForm({
      client_name: appt.client_name,
      client_phone: appt.client_phone || "",
      service_name: appt.service_name,
      barber_name: appt.barber_name || "",
      scheduled_date: format(dt, "yyyy-MM-dd"),
      scheduled_time: format(dt, "HH:mm"),
      price: String(appt.price),
    });
    setEditModal({ open: true, appt });
  };

  const handleEditSave = async () => {
    if (!editModal.appt) return;
    setEditSaving(true);
    const scheduledAt = new Date(`${editForm.scheduled_date}T${editForm.scheduled_time}:00`);
    const svc = services.find((s) => s.name === editForm.service_name);
    const { error } = await supabase.from("appointments").update({
      client_name: editForm.client_name,
      client_phone: editForm.client_phone,
      service_name: editForm.service_name,
      barber_name: editForm.barber_name,
      scheduled_at: scheduledAt.toISOString(),
      price: svc ? svc.price : Number(editForm.price) || 0,
    }).eq("id", editModal.appt.id);
    setEditSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Agendamento atualizado!" }); setEditModal({ open: false, appt: null }); refreshAppts(); }
  };

  const handleStatusChange = async (apptId: string, newStatus: string) => {
    if (newStatus === "completed") {
      setCompletionModal({ open: true, appointmentId: apptId });
      return;
    }
    const { error } = await supabase.from("appointments").update({ status: newStatus }).eq("id", apptId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: `Status: ${statusLabels[newStatus]}` }); refreshAppts(); }
  };

  const handleMarkAsPaid = async (apptId: string) => {
    const { error } = await supabase.from("appointments").update({ payment_status: "paid", status: "confirmed" }).eq("id", apptId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Marcado como Pago!" }); refreshAppts(); }
  };

  const handleGeneratePix = async (appt: Appointment) => {
    toast({ title: "Gerando Pix..." });
    try {
      const pixRes = await supabase.functions.invoke("create-pix-charge", {
        body: { appointment_id: appt.id, barbershop_id: barbershop.id },
      });
      if (pixRes.data?.success && pixRes.data?.payment_url) {
        setPixModal({ open: true, data: { paymentUrl: pixRes.data.payment_url, pixCode: pixRes.data.pix_code || "" }, price: Number(appt.price), serviceName: appt.service_name });
      } else {
        toast({ title: "Erro", description: pixRes.data?.error || "Falha ao gerar Pix", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const openWhatsApp = (phone: string, clientName: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const msg = encodeURIComponent(`Olá ${clientName}! 😊 Obrigado por agendar na ${barbershop.name}. Até breve!`);
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  const sendWhatsAppReminder = (appt: Appointment) => {
    const cleanPhone = (appt.client_phone || "").replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const hora = format(new Date(appt.scheduled_at), "HH:mm");
    const msg = encodeURIComponent(`Olá ${appt.client_name}! Passando para confirmar seu agendamento hoje às ${hora} com ${appt.barber_name || "nosso profissional"} na ${barbershop.name}. Confirma? 😊`);
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  const handleReschedule = (_clientName: string, days: number) => {
    const futureDate = addDays(new Date(), days);
    toast({ title: "Reagendamento sugerido", description: `Sugerido para ${format(futureDate, "dd/MM/yyyy")}` });
    navigator.clipboard.writeText(`${window.location.origin}/agendamentos/${barbershop.slug}`);
  };

  const filteredAppointments = appointments
    .filter((a) => filter === "all" || a.status === filter)
    .filter((a) => !dateFilter || a.scheduled_at.startsWith(dateFilter))
    .filter((a) => !barberFilter || (a.barber_name || "").toLowerCase().includes(barberFilter.toLowerCase()))
    .filter((a) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return a.client_name.toLowerCase().includes(q) || (a.client_phone && a.client_phone.includes(q)) || a.service_name.toLowerCase().includes(q);
    });

  return (
    <div className={`${kioskMode ? "fixed inset-0 z-50 bg-background overflow-auto" : "p-6 max-w-5xl mx-auto"} animate-fade-in`}>
      <CompletionModal open={completionModal.open} onClose={() => setCompletionModal({ open: false, appointmentId: "" })} barbershopId={barbershop.id} appointmentId={completionModal.appointmentId} onCompleted={refreshAppts} />
      {pixModal.data && (
        <PixPaymentModal open={pixModal.open} onClose={() => setPixModal({ open: false, data: null, price: 0, serviceName: "" })} paymentUrl={pixModal.data.paymentUrl} pixCode={pixModal.data.pixCode} price={pixModal.price} serviceName={pixModal.serviceName} />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Agenda
          </h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setKioskMode(!kioskMode)}>
            {kioskMode ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
          </Button>
          <QuickBooking barbershopId={barbershop.id} services={services} onBooked={refreshAppts} />
          <Button variant="outline" size="sm" onClick={() => window.open(`/agendamentos/${barbershop.slug}`, "_blank")}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Link
          </Button>
        </div>
      </div>

      {/* Next Clients */}
      {nextClients.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 mb-6">
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Próximos Clientes
          </h2>
          <div className="space-y-2">
            {nextClients.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-card border border-border px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{a.client_name}</p>
                  <p className="text-xs text-muted-foreground">{a.service_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-primary">{format(new Date(a.scheduled_at), "HH:mm")}</p>
                  <p className="text-xs text-muted-foreground">R$ {Number(a.price).toFixed(2).replace(".", ",")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-bold">Agendamentos</h2>
        <div className="flex gap-1 p-1 rounded-lg bg-secondary">
          <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "gold-gradient text-primary-foreground" : "text-muted-foreground"}`}>
            <List className="h-4 w-4" />
          </button>
          <button onClick={() => setViewMode("calendar")} className={`p-1.5 rounded-md transition-all ${viewMode === "calendar" ? "gold-gradient text-primary-foreground" : "text-muted-foreground"}`}>
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {viewMode === "calendar" ? (
        <CalendarView appointments={appointments} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, telefone, serviço..." className="bg-card border-border pl-10" />
            </div>
            <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-card border-border w-auto" />
            <Input value={barberFilter} onChange={(e) => setBarberFilter(e.target.value)} placeholder="Barbeiro" className="bg-card border-border w-32" />
          </div>

          <div className="flex gap-1 mb-4 p-1 rounded-lg bg-secondary overflow-x-auto">
            {["all", "pending", "confirmed", "completed", "cancelled"].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${filter === s ? "gold-gradient text-primary-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"}`}>
                {s === "all" ? "Todos" : statusLabels[s] || s}
              </button>
            ))}
          </div>

          {filteredAppointments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-10">Nenhum agendamento encontrado.</p>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Serviço</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Barbeiro</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Data/Hora</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Valor</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Pagamento</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAppointments.map((a) => {
                      const badge = statusBadgeConfig[a.status] || statusBadgeConfig.pending;
                      const payBadge = paymentBadgeConfig[a.payment_status] || paymentBadgeConfig.pending;
                      return (
                        <tr key={a.id} className="border-t border-border">
                          <td className="px-4 py-3">
                            <p className="font-medium">{a.client_name}</p>
                            <p className="text-xs text-muted-foreground">{a.client_phone}</p>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">{a.service_name}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{a.barber_name || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{format(new Date(a.scheduled_at), "dd/MM HH:mm")}</td>
                          <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">R$ {Number(a.price).toFixed(2).replace(".", ",")}</td>
                          <td className="px-4 py-3"><Badge className={`${badge.className} text-xs`}>{badge.label}</Badge></td>
                          <td className="px-4 py-3 hidden md:table-cell"><Badge className={`${payBadge.className} text-xs`}>{payBadge.label}</Badge></td>
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Ações</Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-card border-border">
                                {a.status === "pending" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(a.id, "confirmed")}>
                                    <Check className="h-3.5 w-3.5 mr-2 text-blue-400" /> Confirmar
                                  </DropdownMenuItem>
                                )}
                                {(a.status === "pending" || a.status === "confirmed") && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(a.id, "completed")}>
                                    <Play className="h-3.5 w-3.5 mr-2 text-green-400" /> Concluir
                                  </DropdownMenuItem>
                                )}
                                {a.status !== "cancelled" && a.status !== "completed" && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(a.id, "cancelled")} className="text-destructive">
                                    <XCircle className="h-3.5 w-3.5 mr-2" /> Cancelar
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openEditModal(a)}>
                                  <Pencil className="h-3.5 w-3.5 mr-2 text-primary" /> Editar
                                </DropdownMenuItem>
                                {a.payment_status !== "paid" && a.status !== "cancelled" && (
                                  <DropdownMenuItem onClick={() => handleMarkAsPaid(a.id)}>
                                    <Banknote className="h-3.5 w-3.5 mr-2 text-green-400" /> Marcar como Pago
                                  </DropdownMenuItem>
                                )}
                                {a.payment_status !== "paid" && a.status !== "cancelled" && (
                                  <DropdownMenuItem onClick={() => handleGeneratePix(a)}>
                                    <QrCode className="h-3.5 w-3.5 mr-2 text-primary" /> Gerar Pix Agora
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {a.client_phone && (
                                  <DropdownMenuItem onClick={() => openWhatsApp(a.client_phone, a.client_name)}>
                                    <Phone className="h-3.5 w-3.5 mr-2 text-green-500" /> WhatsApp
                                  </DropdownMenuItem>
                                )}
                                {a.client_phone && a.status !== "cancelled" && a.status !== "completed" && (
                                  <DropdownMenuItem onClick={() => sendWhatsAppReminder(a)}>
                                    <MessageSquare className="h-3.5 w-3.5 mr-2 text-green-400" /> Lembrete WhatsApp
                                  </DropdownMenuItem>
                                )}
                                {a.status === "completed" && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleReschedule(a.client_name, 15)}>
                                      <CalendarPlus className="h-3.5 w-3.5 mr-2 text-primary" /> Agendar em 15 dias
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleReschedule(a.client_name, 30)}>
                                      <CalendarPlus className="h-3.5 w-3.5 mr-2 text-primary" /> Agendar em 30 dias
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      {/* Edit Appointment Dialog */}
      <Dialog open={editModal.open} onOpenChange={(v) => { if (!v) setEditModal({ open: false, appt: null }); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" /> Editar Agendamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Cliente</label>
              <Input value={editForm.client_name} onChange={(e) => setEditForm((f) => ({ ...f, client_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
              <Input value={editForm.client_phone} onChange={(e) => setEditForm((f) => ({ ...f, client_phone: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Serviço</label>
              <Select value={editForm.service_name} onValueChange={(v) => setEditForm((f) => ({ ...f, service_name: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => <SelectItem key={s.id} value={s.name}>{s.name} - R$ {s.price}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Profissional</label>
              <Select value={editForm.barber_name} onValueChange={(v) => setEditForm((f) => ({ ...f, barber_name: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {barbers.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Data</label>
                <Input type="date" value={editForm.scheduled_date} onChange={(e) => setEditForm((f) => ({ ...f, scheduled_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Hora</label>
                <Input type="time" value={editForm.scheduled_time} onChange={(e) => setEditForm((f) => ({ ...f, scheduled_time: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full gold-gradient text-primary-foreground font-semibold" onClick={handleEditSave} disabled={editSaving || !editForm.client_name.trim()}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agenda;
