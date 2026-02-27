import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Loader2, Search, Clock, LayoutGrid, List,
  Check, XCircle, Play, Phone, MessageSquare, QrCode,
  Banknote, CalendarPlus, Maximize, Minimize, ExternalLink, Pencil,
  AlertTriangle, Calendar as CalendarIcon
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

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Confirmado", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  completed: { label: "Concluído", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelado", className: "bg-destructive/15 text-destructive border-destructive/30" },
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
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar"); // Padrão agora é calendário
  const [kioskMode, setKioskMode] = useState(false);
  const [completionModal, setCompletionModal] = useState({ open: false, appointmentId: "" });

  // --- BUSCA DE DADOS ---
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
    refetchOnWindowFocus: true,
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

  // --- MUTAÇÕES ---
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.from("appointments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({ title: "Status atualizado!" });
    },
  });

  // --- FILTROS ---
  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((a: any) => filter === "all" || a.status === filter)
      .filter((a: any) => !dateFilter || a.scheduled_at.startsWith(dateFilter))
      .filter((a: any) => !barberFilter || (a.barber_name || "").toLowerCase().includes(barberFilter.toLowerCase()))
      .filter((a: any) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return a.client_name.toLowerCase().includes(q) || a.service_name.toLowerCase().includes(q);
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

  if (loadingAppts) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!barbershop) return null;

  return (
    <div className={`${kioskMode ? "fixed inset-0 z-50 bg-[#060b18] overflow-auto" : "p-6 max-w-7xl mx-auto"} animate-in fade-in duration-500`}>
      <CompletionModal 
        open={completionModal.open} 
        onClose={() => setCompletionModal({ open: false, appointmentId: "" })} 
        barbershopId={barbershop.id} 
        appointmentId={completionModal.appointmentId} 
        onCompleted={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} 
      />
      
      {/* HEADER DINÂMICO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tighter">
            <CalendarDays className="h-8 w-8 text-primary" /> Painel da Agenda
          </h1>
          <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-bold mt-1">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* TOGGLE DE VISÃO ESTILIZADO */}
          <div className="flex items-center bg-slate-900/80 border border-slate-800 p-1 rounded-xl shadow-inner">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={`rounded-lg h-8 px-4 ${viewMode === "list" ? "gold-gradient text-black" : "text-slate-400"}`}
            >
              <List className="h-4 w-4 mr-2" /> Lista
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className={`rounded-lg h-8 px-4 ${viewMode === "calendar" ? "gold-gradient text-black" : "text-slate-400"}`}
            >
              <LayoutGrid className="h-4 w-4 mr-2" /> Calendário
            </Button>
          </div>

          <QuickBooking 
            barbershopId={barbershop.id} 
            services={services} 
            onBooked={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} 
          />
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setKioskMode(!kioskMode)}
            className="border-slate-800 text-slate-400 hover:text-white rounded-xl"
          >
            {kioskMode ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* SEQUÊNCIA DE ATENDIMENTO (Oculta no modo calendário se desejar mais espaço) */}
      {viewMode === "list" && nextClients.length > 0 && (
        <div className="bg-slate-900/40 border border-primary/20 p-6 rounded-[2rem] mb-8 backdrop-blur-md shadow-2xl animate-in slide-in-from-top-4">
            <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Sequência de Atendimento
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {nextClients.map((a: any) => (
                    <div key={a.id} className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl hover:border-primary/30 transition-all group">
                        <p className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">{a.client_name}</p>
                        <p className="text-[10px] text-slate-500 font-black mt-1 uppercase tracking-tighter">{format(parseISO(a.scheduled_at), "HH:mm")} &bull; {a.service_name}</p>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* RENDERIZAÇÃO DA VISÃO SELECIONADA */}
      {viewMode === "list" ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-sm animate-in fade-in duration-500">
          <div className="p-6 border-b border-slate-800 bg-slate-900/60 flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[250px]">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
               <Input 
                 value={search} 
                 onChange={(e) => setSearch(e.target.value)} 
                 placeholder="Filtrar por nome do cliente ou serviço..." 
                 className="bg-slate-950 border-slate-800 pl-11 h-11 text-xs rounded-xl focus:ring-primary/20" 
               />
            </div>
            <Input 
              type="date" 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)} 
              className="bg-slate-950 border-slate-800 text-xs w-auto h-11 rounded-xl" 
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-950/50 text-slate-500 font-black uppercase tracking-[0.2em] border-b border-slate-800">
                <tr>
                  <th className="px-8 py-5 text-left">Cliente</th>
                  <th className="px-8 py-5 text-left">Serviço</th>
                  <th className="px-8 py-5 text-left">Hora</th>
                  <th className="px-8 py-5 text-left">Status</th>
                  <th className="px-8 py-5 text-right">Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center text-slate-500 font-bold uppercase tracking-widest">Nenhum agendamento encontrado</td>
                  </tr>
                ) : (
                  filteredAppointments.map((a: any) => {
                    const badge = statusBadgeConfig[a.status] || statusBadgeConfig.pending;
                    return (
                      <tr key={a.id} className="hover:bg-primary/[0.02] transition-colors group">
                        <td className="px-8 py-5 font-black text-slate-200 text-sm">{a.client_name}</td>
                        <td className="px-8 py-5 text-slate-400 font-medium">{a.service_name}</td>
                        <td className="px-8 py-5 text-primary font-black text-sm">{format(parseISO(a.scheduled_at), "HH:mm")}</td>
                        <td className="px-8 py-5">
                          <Badge className={`${badge.className} border-none font-black text-[9px] uppercase px-3 py-1 rounded-lg`}>{badge.label}</Badge>
                        </td>
                        <td className="px-8 py-5 text-right">
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="sm" className="h-9 w-9 rounded-xl hover:bg-slate-800">
                                 <Pencil className="h-4 w-4 text-slate-500" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="bg-[#0b1224] border-slate-800 text-white p-2 rounded-2xl w-48 shadow-2xl">
                                {a.status === "pending" && (
                                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: a.id, status: "confirmed" })} className="rounded-xl h-10 gap-3 font-bold text-xs cursor-pointer">
                                        <Check className="h-4 w-4 text-emerald-500" /> Confirmar
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => setCompletionModal({ open: true, appointmentId: a.id })} className="rounded-xl h-10 gap-3 font-bold text-xs cursor-pointer">
                                    <Play className="h-4 w-4 text-cyan-500" /> Concluir
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-800" />
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: a.id, status: "cancelled" })} className="rounded-xl h-10 gap-3 font-bold text-xs cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-400">
                                    <XCircle className="h-4 w-4" /> Cancelar
                                </DropdownMenuItem>
                             </DropdownMenuContent>
                           </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VISÃO DE CALENDÁRIO MASTER */
        <div className="animate-in zoom-in-95 duration-500">
           <CalendarView 
             appointments={filteredAppointments} 
             barbershopId={barbershop.id} 
             onRefresh={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })}
           />
        </div>
      )}
    </div>
  );
};

export default Agenda;
