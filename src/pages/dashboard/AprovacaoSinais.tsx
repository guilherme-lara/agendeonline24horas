import { useEffect, useState } from "react";
import {
  AlertTriangle, Loader2, Check, XCircle, Phone, MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
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
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<PendingSignal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    if (!barbershop) return;
    const { data } = await supabase
      .from("appointments")
      .select("id, client_name, client_phone, service_name, barber_name, price, scheduled_at, status, created_at")
      .eq("barbershop_id", barbershop.id)
      .eq("status", "pendente_sinal")
      .order("created_at", { ascending: false });
    setAppointments((data as PendingSignal[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [barbershop]);

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sinal confirmado! Agendamento visível na Agenda." });
      fetch();
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Agendamento cancelado." });
      fetch();
    }
  };

  const openWhatsApp = (phone: string, clientName: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
    const msg = encodeURIComponent(`Olá ${clientName}! Recebemos sua solicitação de agendamento. Poderia enviar o comprovante do sinal para confirmarmos? 😊`);
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-yellow-400" /> Aprovação de Sinais
        </h1>
        <p className="text-sm text-muted-foreground">
          {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""} aguardando confirmação de sinal
        </p>
      </div>

      {appointments.length === 0 ? (
        <div className="text-center py-16">
          <Check className="h-12 w-12 text-green-400/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">Tudo em dia!</h3>
          <p className="text-sm text-muted-foreground">Não há sinais pendentes de aprovação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <div key={a.id} className="rounded-xl border border-yellow-500/20 bg-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold">{a.client_name}</p>
                  <p className="text-xs text-muted-foreground">{a.client_phone}</p>
                </div>
                <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30">
                  Pendente Sinal
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Serviço</p>
                  <p className="font-medium">{a.service_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Profissional</p>
                  <p className="font-medium">{a.barber_name || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">{format(new Date(a.scheduled_at), "dd/MM HH:mm")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor</p>
                  <p className="font-medium text-primary">R$ {Number(a.price).toFixed(2).replace(".", ",")}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleApprove(a.id)} className="bg-green-600 hover:bg-green-700 text-white">
                  <Check className="h-3.5 w-3.5 mr-1" /> Confirmar Sinal
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleReject(a.id)} className="text-destructive hover:bg-destructive/10">
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                </Button>
                {a.client_phone && (
                  <Button size="sm" variant="outline" onClick={() => openWhatsApp(a.client_phone, a.client_name)}>
                    <MessageCircle className="h-3.5 w-3.5 mr-1 text-green-500" /> WhatsApp
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AprovacaoSinais;
