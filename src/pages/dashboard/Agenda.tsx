import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays, Loader2, Search, Clock, LayoutGrid, List,
  Check, XCircle, Play, Phone, MessageSquare, QrCode, User,
  Pencil, AlertTriangle, History, ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, compareAsc, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo } from "react";
import CalendarView from "@/components/CalendarView";
import QuickBooking from "@/components/QuickBooking";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

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

  // Estados
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [editModal, setEditModal] = useState({ open: false, appt: null as any });

  // Query de Agendamentos
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", barbershop?.id)
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!barbershop?.id,
  });

  // Mutação de Edição
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

  // Filtros
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

  if (isLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-cyan-500" /></div>;

  return (
    <div className="w-full min-h-screen bg-[#060b18] p-4 lg:p-8 animate-in fade-in duration-500">
      
      {/* HEADER ADAPTÁVEL */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
            <CalendarDays className="text-cyan-500" /> Master Agenda
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* TABS ESTILIZADAS */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl">
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setActiveTab("active")}
              className={`rounded-xl px-6 ${activeTab === "active" ? "bg-cyan-600 text-white shadow-lg" : "text-slate-500"}`}
            >
              <Clock className="h-4 w-4 mr-2" /> Ativos
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setActiveTab("completed")}
              className={`rounded-xl px-6 ${activeTab === "completed" ? "bg-slate-800 text-white" : "text-slate-500"}`}
            >
              <History className="h-4 w-4 mr-2" /> Concluídos
            </Button>
          </div>

          <div className="h-8 w-[1px] bg-slate-800 mx-2 hidden xl:block" />

          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-2xl">
            <Button variant="ghost" size="sm" onClick={() => setViewMode("calendar")} className={`rounded-xl ${viewMode === "calendar" ? "bg-slate-800 text-cyan-400" : "text-slate-500"}`}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className={`rounded-xl ${viewMode === "list" ? "bg-slate-800 text-cyan-400" : "text-slate-500"}`}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          <QuickBooking barbershopId={barbershop?.id} services={[]} onBooked={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} />
        </div>
      </div>

      {/* BUSCA FULL WIDTH */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 h-5 w-5" />
        <Input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por cliente, serviço ou barbeiro..." 
          className="w-full bg-slate-900/50 border-slate-800 h-14 pl-12 rounded-2xl text-white focus:ring-cyan-500/20"
        />
      </div>

      {/* VIEW RENDERER */}
      {viewMode === "list" ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950/50 border-b border-slate-800">
                <tr className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em]">
                  <th className="px-8 py-6 text-left">Hora</th>
                  <th className="px-8 py-6 text-left">Cliente</th>
                  <th className="px-8 py-6 text-left">Serviço / Profissional</th>
                  <th className="px-8 py-6 text-left">Preço</th>
                  <th className="px-8 py-6 text-left">Status</th>
                  <th className="px-8 py-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filtered.map((a: any) => (
                  <tr key={a.id} className="hover:bg-cyan-500/[0.02] transition-colors group">
                    <td className="px-8 py-5 text-cyan-400 font-black text-lg">{format(parseISO(a.scheduled_at), "HH:mm")}</td>
                    <td className="px-8 py-5">
                      <p className="text-white font-bold">{a.client_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{a.client_phone}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-slate-300 text-sm font-medium">{a.service_name}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 uppercase font-black">
                        <User className="h-3 w-3" /> {a.barber_name || "Geral"}
                      </div>
                    </td>
                    <td className="px-8 py-5 font-bold text-emerald-400 text-sm">R$ {Number(a.price).toFixed(2)}</td>
                    <td className="px-8 py-5">
                      <Badge className={`${statusBadgeConfig[a.status]?.className} border-none font-black text-[9px] uppercase px-3 py-1`}>
                        {statusBadgeConfig[a.status]?.label}
                      </Badge>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" size="icon" 
                          onClick={() => setEditModal({ open: true, appt: a })}
                          className="h-10 w-10 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-cyan-400"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {activeTab === "active" && (
                          <Button 
                            variant="ghost" size="icon" 
                            onClick={() => window.location.href = '/dashboard/caixa'}
                            className="h-10 w-10 rounded-xl hover:bg-emerald-500/10 text-emerald-500"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <CalendarView appointments={filtered} barbershopId={barbershop?.id} />
      )}

      {/* MODAL DE EDIÇÃO DIRETA */}
      <Dialog open={editModal.open} onOpenChange={(o) => !o && setEditModal({ open: false, appt: null })}>
        <DialogContent className="bg-[#0b1224] border-slate-800 text-white max-w-lg rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2">
              <Pencil className="text-cyan-400 h-6 w-6" /> Editar Agendamento
            </DialogTitle>
          </DialogHeader>
          
          {editModal.appt && (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Nome do Cliente</label>
                <Input 
                  defaultValue={editModal.appt.client_name} 
                  onChange={(e) => editModal.appt.client_name = e.target.value}
                  className="bg-slate-950 border-slate-800"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Preço (R$)</label>
                <Input 
                  type="number"
                  defaultValue={editModal.appt.price} 
                  onChange={(e) => editModal.appt.price = Number(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-emerald-400 font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Status</label>
                <select 
                  defaultValue={editModal.appt.status}
                  onChange={(e) => editModal.appt.status = e.target.value}
                  className="w-full bg-slate-950 border border-slate-800 rounded-md h-10 px-3 text-sm"
                >
                  <option value="pending">Pendente</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <Button 
                className="col-span-2 mt-4 bg-cyan-600 hover:bg-cyan-500 text-white font-black h-12 rounded-xl"
                onClick={() => updateMutation.mutate(editModal.appt)}
              >
                Salvar Alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agenda;
