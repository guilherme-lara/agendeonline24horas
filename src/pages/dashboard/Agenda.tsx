import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Loader2, Search, Clock, LayoutGrid, List,
  Check, XCircle, Play, Phone, MessageSquare, QrCode,
  Banknote, CalendarPlus, Maximize, Minimize, ExternalLink, Pencil,
  AlertTriangle, Calendar as CalendarIcon, User
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// --- Configurações de Badge de Status ---
const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  confirmed: { label: "Confirmado", className: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  completed: { label: "Concluído", className: "bg-green-500/15 text-green-400 border-green-500/30" },
  cancelled: { label: "Cancelado", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

const Agenda = () => {
  const { barbershop } = useBarbershop() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estados de UI
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar"); 
  const [kioskMode, setKioskMode] = useState(false);
  const [completionModal, setCompletionModal] = useState({ open: false, appointmentId: "" });

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
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  // --- FILTROS E CÁLCULOS ---
  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((a: any) => !dateFilter || a.scheduled_at.startsWith(dateFilter))
      .filter((a: any) => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        return (
          a.client_name.toLowerCase().includes(q) || 
          a.service_name.toLowerCase().includes(q) || 
          (a.barber_name && a.barber_name.toLowerCase().includes(q))
        );
      });
  }, [appointments, dateFilter, search]);

  const nextClients = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const now = new Date();
    return appointments
      .filter((a: any) => a.status !== "cancelled" && a.scheduled_at.startsWith(todayStr) && parseISO(a.scheduled_at) >= now)
      .sort((a: any, b: any) => compareAsc(parseISO(a.scheduled_at), parseISO(b.scheduled_at)))
      .slice(0, 5);
  }, [appointments]);

  if (loadingAppts) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>;

  if (errorAppts) return (
    <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
      <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
      <h2 className="text-xl font-bold text-white mb-2">Erro de sincronização</h2>
      <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} className="gold-gradient">Tentar Novamente</Button>
    </div>
  );

  if (!barbershop) return null;

  return (
    <div className={`${kioskMode ? "fixed inset-0 z-50 bg-[#0b1224] overflow-auto" : "p-6 max-w-7xl mx-auto"} animate-in fade-in duration-500`}>
      <CompletionModal 
        open={completionModal.open} 
        onClose={() => setCompletionModal({ open: false, appointmentId: "" })} 
        barbershopId={barbershop.id} 
        appointmentId={completionModal.appointmentId} 
        onCompleted={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} 
      />
      
      {/* HEADER MASTER COM TOGGLE DE VISÃO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tighter">
            <CalendarDays className="h-8 w-8 text-cyan-500" /> Painel da Agenda
          </h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mt-1">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* SELETOR DE VISÃO INDUSTRIAL */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-2xl shadow-2xl">
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className={`rounded-xl h-9 px-5 font-bold transition-all ${viewMode === "calendar" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-500"}`}
            >
              <LayoutGrid className="h-4 w-4 mr-2" /> Calendário
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={`rounded-xl h-9 px-5 font-bold transition-all ${viewMode === "list" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-500"}`}
            >
              <List className="h-4 w-4 mr-2" /> Lista
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
            className="border-slate-800 text-slate-500 hover:text-white rounded-xl h-11 w-11"
          >
            {kioskMode ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* SEQUÊNCIA DE ATENDIMENTO COM EXIBIÇÃO DE BARBEIRO */}
      {nextClients.length > 0 && (
        <div className="bg-slate-900/40 border border-cyan-500/20 p-6 rounded-[2.5rem] mb-10 backdrop-blur-xl shadow-2xl animate-in slide-in-from-top-4 duration-500">
            <h2 className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Sequência de Atendimento
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {nextClients.map((a: any) => (
                    <div key={a.id} className="bg-slate-950/50 border border-slate-800 p-5 rounded-3xl hover:border-cyan-500/30 transition-all group relative overflow-hidden">
                        {/* Borda lateral de identificação rápida */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-cyan-500/20 group-hover:bg-cyan-500 transition-colors" />
                        
                        <div className="flex justify-between items-start mb-3 pl-2">
                          <p className="text-sm font-black text-white truncate flex-1 group-hover:text-cyan-400 transition-colors">
                            {a.client_name}
                          </p>
                          <Badge className="bg-cyan-500/10 text-cyan-400 border-none font-black text-[10px] px-2 py-0.5">
                            {format(parseISO(a.scheduled_at), "HH:mm")}
                          </Badge>
                        </div>

                        <div className="space-y-3 pl-2">
                          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest truncate">
                            {a.service_name}
                          </p>
                          
                          {/* EXIBIÇÃO DO BARBEIRO NO CARD */}
                          <div className="flex items-center gap-2 pt-3 border-t border-slate-800/50">
                            <div className="h-6 w-6 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center">
                                <User className="h-3 w-3 text-cyan-500" />
                            </div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter truncate">
                              {a.barber_name || "Geral"}
                            </p>
                          </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* RENDERIZAÇÃO DE VISÃO CONDICIONAL */}
      {viewMode === "list" ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md animate-in fade-in duration-700">
          <div className="p-8 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full max-w-md">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
               <Input 
                 value={search} 
                 onChange={(e) => setSearch(e.target.value)} 
                 placeholder="Buscar cliente, barbeiro ou serviço..." 
                 className="bg-slate-950 border-slate-800 pl-11 h-12 text-sm rounded-2xl focus:ring-cyan-500/20" 
               />
            </div>
            <Input 
              type="date" 
              value={dateFilter} 
              onChange={(e) => setDateFilter(e.target.value)} 
              className="bg-slate-950 border-slate-800 h-12 text-sm w-full md:w-auto rounded-2xl font-mono text-cyan-400" 
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-950/50 text-slate-500 font-black uppercase tracking-[0.2em] border-b border-slate-800">
                <tr>
                  <th className="px-8 py-5 text-left">Cliente</th>
                  <th className="px-8 py-5 text-left">Serviço</th>
                  <th className="px-8 py-5 text-left">Barbeiro</th>
                  <th className="px-8 py-5 text-left">Hora</th>
                  <th className="px-8 py-5 text-left">Status</th>
                  <th className="px-8 py-5 text-right">Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-24 text-center text-slate-600 font-bold uppercase tracking-[0.3em]">
                        Nenhum registro encontrado na base
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((a: any) => {
                    const badge = statusBadgeConfig[a.status] || statusBadgeConfig.pending;
                    return (
                      <tr key={a.id} className="hover:bg-cyan-500/[0.02] transition-colors group">
                        <td className="px-8 py-5 font-black text-slate-100 text-sm">{a.client_name}</td>
                        <td className="px-8 py-5 text-slate-400 font-medium">{a.service_name}</td>
                        {/* BARBEIRO NA TABELA */}
                        <td className="px-8 py-5">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-950/50 px-2.5 py-1 rounded-lg border border-slate-800">
                                {a.barber_name || "Geral"}
                            </span>
                        </td>
                        <td className="px-8 py-5 text-cyan-400 font-black text-sm">{format(parseISO(a.scheduled_at), "HH:mm")}</td>
                        <td className="px-8 py-5">
                          <Badge className={`${badge.className} border-none font-black text-[9px] uppercase px-3 py-1 rounded-lg`}>{badge.label}</Badge>
                        </td>
                        <td className="px-8 py-5 text-right">
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="sm" className="h-10 w-10 rounded-xl hover:bg-slate-800 text-slate-500 hover:text-white">
                                 <Pencil className="h-4 w-4" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" className="bg-[#0b1224] border-slate-800 text-white p-2 rounded-[1.5rem] w-56 shadow-2xl">
                                {a.status === "pending" && (
                                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: a.id, status: "confirmed" })} className="rounded-xl h-11 gap-3 font-bold text-xs cursor-pointer focus:bg-emerald-500/10 focus:text-emerald-400">
                                        <Check className="h-4 w-4" /> Confirmar Horário
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => setCompletionModal({ open: true, appointmentId: a.id })} className="rounded-xl h-11 gap-3 font-bold text-xs cursor-pointer focus:bg-cyan-500/10 focus:text-cyan-400">
                                    <Play className="h-4 w-4" /> Concluir Atendimento
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="bg-slate-800" />
                                <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: a.id, status: "cancelled" })} className="rounded-xl h-11 gap-3 font-bold text-xs cursor-pointer text-red-500 focus:bg-red-500/10 focus:text-red-500">
                                    <XCircle className="h-4 w-4" /> Cancelar Agendamento
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
        /* VISÃO DE CALENDÁRIO COMPLETA */
        <div className="animate-in zoom-in-95 duration-500 bg-slate-900/40 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl backdrop-blur-md">
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
