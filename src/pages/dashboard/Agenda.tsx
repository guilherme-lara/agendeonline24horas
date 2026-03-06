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
import { format, parseISO } from "date-fns";
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
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  confirmed: { label: "Confirmado", className: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  completed: { label: "Concluído", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pendente_sinal: { label: "Aguard. Sinal", className: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
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

  const { data: appointments = [], isLoading, isError } = useQuery({
    queryKey: ["appointments", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*")
        .eq("barbershop_id", barbershop?.id)
        .neq("status", "pendente_sinal") // 🚨 A MÁGICA: Oculta os não aprovados da agenda principal
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", barbershop?.id)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
    enabled: queryEnabled,
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
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setActiveTab("active")}
              className={`rounded-xl px-6 ${activeTab === "active" ? "gold-gradient text-primary-foreground shadow-gold" : "text-muted-foreground"}`}
            >
              <Clock className="h-4 w-4 mr-2" /> Ativos
            </Button>
            <Button 
              variant="ghost" size="sm" 
              onClick={() => setActiveTab("completed")}
              className={`rounded-xl px-6 ${activeTab === "completed" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
            >
              <History className="h-4 w-4 mr-2" /> Histórico
            </Button>
          </div>

          <div className="h-8 w-[1px] bg-border mx-2 hidden xl:block" />

          <div className="flex bg-card border border-border p-1 rounded-2xl">
            <Button variant="ghost" size="sm" onClick={() => setViewMode("calendar")} className={`rounded-xl ${viewMode === "calendar" ? "bg-secondary text-primary" : "text-muted-foreground"}`}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setViewMode("list")} className={`rounded-xl ${viewMode === "list" ? "bg-secondary text-primary" : "text-muted-foreground"}`}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          <QuickBooking 
            barbershopId={barbershop?.id} 
            services={services} 
            onBooked={() => queryClient.invalidateQueries({ queryKey: ["appointments"] })} 
          />
        </div>
      </div>

      {/* BUSCA */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground h-5 w-5" />
        <input 
          value={search} 
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Pesquisar por cliente, serviço ou barbeiro..." 
          className="w-full bg-card border border-border h-14 pl-12 rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
        />
      </div>

      {/* TABLE VIEW */}
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
                {filtered.map((a: any) => (
                  <tr key={a.id} className="hover:bg-secondary/30 transition-colors group">
                    <td className="px-8 py-5 text-primary font-black text-lg">{format(parseISO(a.scheduled_at), "HH:mm")}</td>
                    <td className="px-8 py-5">
                      <p className="text-foreground font-bold">{a.client_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{a.client_phone}</p>
                    </td>
                    <td className="px-8 py-5">
                      <p className="text-foreground/80 text-sm font-medium">{a.service_name}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground uppercase font-black">
                        <User className="h-3 w-3" /> {a.barber_name || "Geral"}
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
                          onClick={() => setEditModal({ open: true, appt: { ...a } })}
                          className="h-10 w-10 rounded-xl hover:bg-secondary text-muted-foreground hover:text-primary"
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
        />
      )}

      {/* MODAL DE EDIÇÃO */}
      <Dialog open={editModal.open} onOpenChange={(o) => !o && setEditModal({ open: false, appt: null })}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black flex items-center gap-2 font-display">
              <Pencil className="text-primary h-6 w-6" /> Editar Agendamento
            </DialogTitle>
          </DialogHeader>
          
          {editModal.appt && (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase">Nome do Cliente</label>
                <Input 
                  defaultValue={editModal.appt.client_name} 
                  onChange={(e) => editModal.appt.client_name = e.target.value}
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase">Preço (R$)</label>
                <Input 
                  type="number"
                  defaultValue={editModal.appt.price} 
                  onChange={(e) => editModal.appt.price = Number(e.target.value)}
                  className="bg-background border-border text-emerald-500 font-bold"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase">Status</label>
                <select 
                  defaultValue={editModal.appt.status}
                  onChange={(e) => editModal.appt.status = e.target.value}
                  className="w-full bg-background border border-border rounded-md h-10 px-3 text-sm text-foreground"
                >
                  <option value="pending">Pendente</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <Button 
                className="col-span-2 mt-4 gold-gradient text-primary-foreground font-black h-12 rounded-xl shadow-gold"
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
