import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Loader2, Search, Clock, LayoutGrid, List,
  Check, XCircle, Play, Phone, MessageSquare, QrCode,
  Banknote, CalendarPlus, Maximize, Minimize, ExternalLink, Pencil,
  AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, compareAsc, addDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
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

// --- Configurações de Badge ---
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

const Agenda = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados de UI
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [barberFilter, setBarberFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [kioskMode, setKioskMode] = useState(false);
  const [completionModal, setCompletionModal] = useState({ open: false, appointmentId: "" });
  const [pixModal, setPixModal] = useState({ open: false, data: null as any, price: 0, serviceName: "" });
  const [editModal, setEditModal] = useState({ open: false, appt: null as any });
  const [editForm, setEditForm] = useState({ client_name: "", client_phone: "", service_name: "", barber_name: "", scheduled_date: "", scheduled_time: "", price: "" });

  // --- BUSCA DE DADOS (TANSTACK QUERY) ---
  const { data: appointments = [], isLoading: loadingAppts, isError: errorAppts } = useQuery({
    queryKey: ["appointments", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", barbershop?.id)
        .neq("status", "pendente_sinal")
        .order("scheduled_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!barbershop?.id,
    refetchOnWindowFocus: true, // Auto-update ao voltar para a aba
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("services").select("*").eq("barbershop_id", barbershop?.id).eq("active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!barbershop?.id,
  });

  const { data: barbers = [] } = useQuery({
    queryKey: ["barbers", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("barbers").select("id, name").eq("barbershop_id", barbershop?.id).eq("active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!barbershop?.id,
  });

  // --- MUTAÇÕES (AÇÕES DO SISTEMA) ---
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Status atualizado!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...updates } = payload;
      const { error } = await supabase.from("appointments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setEditModal({ open: false, appt: null });
      toast({ title: "Agendamento atualizado!" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // --- FILTROS E CÁLCULOS ---
  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((a: any) => filter === "all" || a.status === filter)
      .filter((a: any) => !dateFilter || a.scheduled_at.startsWith(dateFilter))
      .filter((a: any) => !barberFilter || (a.barber_name || "").toLowerCase().includes(barberFilter.toLowerCase()))
      .filter((a: any) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return a.client_name.toLowerCase().includes(q) || (a.client_phone && a.client_phone.includes(q)) || a.service_name.toLowerCase().includes(q);
      });
  }, [appointments, filter, dateFilter, barberFilter, search]);

  const nextClients = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const now = new Date();
    return appointments
      .filter((a: any) => a.status !== "cancelled" && a.scheduled_at.startsWith(todayStr) && parseISO(a.scheduled_at) >= now)
      .sort((a: any, b: any) => compareAsc(parseISO(a.scheduled_at), parseISO(b.scheduled_at)))
      .slice(0, 5);
  }, [appointments]);

  if (loadingAppts) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (errorAppts) return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="font-display text-xl font-bold mb-2 text-white">Falha na conexão</h2>
      <p className="text-sm text-slate-400 mb-6 px-6">Não conseguimos sincronizar a agenda. Verifique sua internet.</p>
      <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} className="gold-gradient">Tentar Novamente</Button>
    </div>
  );

  if (!barbershop) return null;

  return (
    <div className={`${kioskMode ? "fixed inset-0 z-50 bg-background overflow-auto" : "p-6 max-w-7xl mx-auto"} animate-fade-in`}>
      {/* Modais Persistentes */}
      <CompletionModal open={completionModal.open} onClose={() => setCompletionModal({ open: false, appointmentId: "" })} barbershopId={barbershop.id} appointmentId={completionModal.appointmentId} onCompleted={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} />
      
      {/* Header e Busca... (mantidos do seu original) */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Painel da Agenda
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <div className="flex gap-2">
          <QuickBooking barbershopId={barbershop.id} services={services} onBooked={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} />
        </div>
      </div>

      {/* Grid de Próximos Clientes (Usa os dados memoizados do nextClients) */}
      {nextClients.length > 0 && (
        <div className="bg-slate-900/40 border border-primary/20 p-6 rounded-2xl mb-8 backdrop-blur-sm">
            <h2 className="text-sm font-bold text-primary uppercase tracking-tighter mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Sequência de Atendimento
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {nextClients.map((a: any) => (
                    <div key={a.id} className="bg-slate-950/50 border border-slate-800 p-3 rounded-xl">
                        <p className="text-xs font-bold text-white truncate">{a.client_name}</p>
                        <p className="text-[10px] text-primary font-black">{format(parseISO(a.scheduled_at), "HH:mm")}</p>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* Filtros e Tabela de Agendamentos */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 bg-slate-900/60 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
             <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar por nome ou serviço..." className="bg-slate-950 border-slate-800 pl-10 text-xs" />
          </div>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="bg-slate-950 border-slate-800 text-xs w-auto" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-950/50 text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-left">Cliente</th>
                <th className="px-6 py-4 text-left">Serviço</th>
                <th className="px-6 py-4 text-left">Hora</th>
                <th className="px-6 py-4 text-left">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredAppointments.map((a: any) => {
                const badge = statusBadgeConfig[a.status] || statusBadgeConfig.pending;
                return (
                  <tr key={a.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-4 font-bold text-slate-200">{a.client_name}</td>
                    <td className="px-6 py-4 text-slate-400">{a.service_name}</td>
                    <td className="px-6 py-4 text-primary font-black">{format(parseISO(a.scheduled_at), "HH:mm")}</td>
                    <td className="px-6 py-4">
                      <Badge className={`${badge.className} border-none`}>{badge.label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="sm">Ações</Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800 text-white">
                            {a.status === "pending" && (
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: a.id, status: "confirmed" })}>
                                    <Check className="h-4 w-4 mr-2 text-emerald-500" /> Confirmar
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setCompletionModal({ open: true, appointmentId: a.id })}>
                                <Play className="h-4 w-4 mr-2 text-blue-500" /> Concluir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: a.id, status: "cancelled" })} className="text-red-400">
                                <XCircle className="h-4 w-4 mr-2" /> Cancelar
                            </DropdownMenuItem>
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
    </div>
  );
};

export default Agenda;
