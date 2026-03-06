import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Loader2, Check, XCircle, Phone, MessageCircle, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingSignal {
  id: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  barber_name: string;
  price: number;
  scheduled_at: string;
  status: string;
  created_at: string;
}

const AprovacaoSinais = () => {
  const { barbershop } = useBarbershop() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Proteção contra loading infinito
  const queryEnabled = !!barbershop?.id;

  // --- BUSCA DE DADOS (TANSTACK QUERY) ---
  const { data: appointments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["pending-signals", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];

      const { data, error } = await supabase
        .from("appointments")
        .select("id, client_name, client_phone, service_name, barber_name, price, scheduled_at, status, created_at")
        .eq("barbershop_id", barbershop.id)
        .eq("status", "pendente_sinal")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as PendingSignal[];
    },
    enabled: !!barbershop?.id,
  });

  // --- MUTAÇÕES DE AÇÃO ---
  const signalMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string, newStatus: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Faça login novamente.");

      const { error } = await supabase
        .from("appointments")
        .update({ status: newStatus })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pending-signals"] });
      // Invalida a agenda e o dashboard para o agendamento brotar lá na hora
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-appointments"] });
      
      const isApproved = variables.newStatus === "confirmed";
      toast({ 
        title: isApproved ? "Sinal Confirmado!" : "Agendamento Rejeitado",
        description: isApproved ? "O agendamento agora está visível na Agenda principal." : "O horário foi liberado."
      });
    },
    onError: (err: any) => {
      toast({ title: "Erro na operação", description: err.message, variant: "destructive" });
    }
  });

  const openWhatsApp = (phone: string, clientName: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const msg = encodeURIComponent(`Olá ${clientName}! Recebemos sua solicitação de agendamento na ${barbershop?.name}. Poderia enviar o comprovante do sinal para confirmarmos? 😊`);
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  // --- TELAS DE PROTEÇÃO ---
  if (isLoading && queryEnabled && !appointments.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        <p className="text-xs text-slate-500 animate-pulse uppercase tracking-widest font-bold">Buscando comprovantes...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Erro de conexão</h2>
        <p className="text-sm text-slate-400 mb-8">Não conseguimos carregar as aprovações pendentes.</p>
        <Button onClick={() => refetch()} className="gold-gradient px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
          <AlertTriangle className="h-8 w-8 text-amber-400" /> Aprovação de Sinais
        </h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">
          {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""} aguardando sua validação manual.
        </p>
      </div>

      {appointments.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-16 text-center backdrop-blur-sm shadow-xl">
          <div className="bg-slate-950 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-800">
            <Check className="h-10 w-10 text-emerald-500/40" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Tudo em dia!</h3>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Não há novas solicitações de sinal pendentes no momento.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {appointments.map((a) => (
            <div key={a.id} className="group rounded-2xl border border-slate-800 bg-slate-900/40 p-6 backdrop-blur-md transition-all hover:border-slate-700 shadow-lg">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-lg font-bold text-cyan-400">
                      {a.client_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-lg text-white leading-tight">{a.client_name}</p>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{a.client_phone || "Sem telefone"}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Serviço</p>
                      <p className="text-xs font-bold text-white">{a.service_name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Barbeiro</p>
                      <p className="text-xs font-bold text-white">{a.barber_name || "Geral"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Data/Hora</p>
                      <p className="text-xs font-bold text-cyan-400">{format(parseISO(a.scheduled_at), "dd/MM 'às' HH:mm")}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-tighter mb-1">Valor</p>
                      <p className="text-xs font-bold text-emerald-400">R$ {Number(a.price).toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col gap-2 min-w-[180px]">
                  <Button 
                    onClick={() => signalMutation.mutate({ id: a.id, newStatus: "confirmed" })}
                    disabled={signalMutation.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-10 shadow-lg shadow-emerald-900/20"
                  >
                    {signalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Confirmar
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => signalMutation.mutate({ id: a.id, newStatus: "cancelled" })}
                    disabled={signalMutation.isPending}
                    className="flex-1 text-slate-400 hover:text-red-400 hover:bg-red-500/10 font-bold h-10"
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Rejeitar
                  </Button>
                  {a.client_phone && (
                    <Button 
                        variant="outline" 
                        onClick={() => openWhatsApp(a.client_phone, a.client_name)}
                        className="flex-1 border-slate-800 hover:bg-slate-800 text-slate-400 h-10"
                    >
                      <MessageCircle className="h-4 w-4 mr-2 text-emerald-500" /> WhatsApp
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AprovacaoSinais;
