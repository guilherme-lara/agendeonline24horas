import { useState, useMemo, useEffect } from "react";
import {
  Phone, Search, Loader2, Calendar, Clock, User,
  CalendarX2, Gift, AlertTriangle, RefreshCw, CheckCircle2, Scissors
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface AppointmentResult {
  id: string;
  service_name: string;
  barber_name: string | null;
  scheduled_at: string;
  status: string | null;
  price: number;
  total_price: number | null;
  amount_paid: number | null;
  has_signal: boolean | null;
  signal_value: number | null;
  payment_status: string | null;
  payment_url: string | null;
  expires_at: string | null;
}

const STORAGE_KEY = "techbarber_client_phone";
const LOYALTY_GOAL = 10;

// Sanitiza telefone: remove tudo que nao é digito
const sanitizePhone = (val: string) => val.replace(/\D/g, "");

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-slate-800 text-slate-400 border-slate-700" },
  confirmed: { label: "Confirmado ✓", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
  completed: { label: "Concluído", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  cancelled: { label: "Cancelado", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  pending_payment: { label: "Aguardando Pagamento", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  pendente_pagamento: { label: "⏳ Aguardando Pagamento - Expira em breve", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse" },
  flagged: { label: "Verificação de Valor", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  amount_mismatch: { label: "Valor Divergente", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

const MyAppointments = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [searchInput, setSearchInput] = useState(phone);

  // --- BUSCA VIA RPC (bypass RLS com SECURITY DEFINER) ---
  const { data: appointments = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["client-appointments", phone],
    queryFn: async () => {
      const cleanPhone = sanitizePhone(phone);
      if (cleanPhone.length < 10) return [];

      const { data, error } = await supabase
        .rpc("get_client_appointments", { p_phone: cleanPhone });

      if (error) throw error;
      return (data || []) as AppointmentResult[];
    },
    enabled: sanitizePhone(phone).length >= 10,
    refetchOnWindowFocus: false,
  });

  // --- LÓGICA DE FILTROS E FIDELIDADE ---
  const { upcoming, past, loyalty } = useMemo(() => {
    const now = new Date();
    const completed = appointments.filter(a => a.status === "completed").length;

    return {
      upcoming: appointments.filter(a =>
        parseISO(a.scheduled_at) >= now &&
        !["cancelled", "flagged"].includes(a.status ?? "")
      ),
      past: appointments.filter(a =>
        parseISO(a.scheduled_at) < now || a.status === "cancelled"
      ),
      loyalty: {
        count: completed,
        percent: Math.min((completed / LOYALTY_GOAL) * 100, 100),
        remaining: Math.max(LOYALTY_GOAL - completed, 0)
      }
    };
  }, [appointments]);

  const handleSearch = () => {
    const digits = sanitizePhone(searchInput);
    if (digits.length < 10) {
      toast({
        title: "Número incompleto",
        description: "Informe o DDD e o número.",
        variant: "destructive",
      });
      return;
    }
    const formatted = formatPhoneDisplay(digits);
    localStorage.setItem(STORAGE_KEY, formatted);
    setPhone(formatted);
  };

  const formatPhoneDisplay = (v: string) => {
    const d = sanitizePhone(v).slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  return (
    <div className="container max-w-xl py-10 pb-24 animate-in fade-in duration-500">
      <header className="mb-10 text-center">
        <div className="mx-auto mb-6 relative group inline-block">
          <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" />
          <div className="relative h-16 w-16 flex items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl">
            <Scissors className="h-8 w-8 text-cyan-400" />
          </div>
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight">Meus Horários</h1>
        <p className="text-slate-500 text-sm mt-1 font-medium">Acompanhe seus agendamentos e prêmios.</p>
      </header>

      {/* BOX DE BUSCA PREMIUM */}
      <div className="bg-slate-900/40 border border-slate-800 p-2 rounded-[2rem] flex gap-2 mb-10 shadow-2xl backdrop-blur-sm focus-within:border-cyan-500/30 transition-all">
        <div className="relative flex-1">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(formatPhoneDisplay(e.target.value))}
            placeholder="(00) 00000-0000"
            className="bg-transparent border-none h-12 pl-11 text-white focus-visible:ring-0 placeholder:text-slate-700"
            maxLength={15}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={isLoading}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-black rounded-[1.5rem] h-12 px-6 shadow-lg shadow-cyan-900/20"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* TELA DE ERRO */}
      {isError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-8 text-center mb-8">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-4" />
          <h3 className="text-white font-bold mb-2">Erro na Sincronia</h3>
          <p className="text-slate-400 text-xs mb-6">Não conseguimos conectar à sua conta.</p>
          <Button onClick={() => refetch()} variant="outline" className="border-slate-800 text-slate-400 font-bold h-10 rounded-xl">
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
          </Button>
        </div>
      )}

      {/* RESULTADOS */}
      {phone && !isLoading && !isError && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">

          {/* CARTÃO FIDELIDADE MASTER */}
          <div className="relative rounded-[2.5rem] border border-cyan-500/20 bg-slate-900/60 p-8 shadow-2xl overflow-hidden backdrop-blur-md">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Gift className="h-16 w-16 text-cyan-400" />
            </div>

            <div className="flex items-center gap-3 mb-6">
              <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-black text-[10px] tracking-widest uppercase">Loyalty Program</Badge>
            </div>

            <h2 className="text-white font-black text-xl mb-2">Seu Progresso</h2>

            <div className="space-y-4">
              <Progress value={loyalty.percent} className="h-3 bg-slate-950 border border-slate-800" />
              <div className="flex justify-between items-center">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  {loyalty.count} de {LOYALTY_GOAL} atendimentos
                </p>
                {loyalty.remaining > 0 ? (
                  <p className="text-xs font-black text-cyan-400 uppercase tracking-tighter">Faltam {loyalty.remaining} cortes</p>
                ) : (
                  <p className="text-xs font-black text-emerald-400 uppercase flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Brinde Liberado!
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* LISTAGEM DE AGENDAMENTOS */}
          {appointments.length === 0 ? (
            <div className="text-center py-20">
              <CalendarX2 className="h-12 w-12 text-slate-800 mx-auto mb-4" />
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="space-y-6">
              {upcoming.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-2">Próximos</h3>
                  {upcoming.map(a => <AppointmentItem key={a.id} a={a} />)}
                </div>
              )}

              {past.length > 0 && (
                <div className="space-y-4 pt-4">
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.3em] ml-2">Histórico</h3>
                  <div className="opacity-60 grayscale-[0.5]">
                    {past.slice(0, 5).map(a => <AppointmentItem key={a.id} a={a} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="space-y-4 py-10">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mx-auto" />
          <p className="text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest">Acessando base de dados...</p>
        </div>
      )}
    </div>
  );
};

const AppointmentItem = ({ a }: { a: AppointmentResult }) => {
  const config = statusConfig[a.status || "pending"] || statusConfig.pending;
  const hasPaid = a.payment_status === "paid";
  const hasSignal = a.has_signal && a.signal_value && a.total_price;
  const remaining = hasSignal && a.amount_paid != null && a.total_price != null
    ? Math.max(0, a.total_price - a.amount_paid)
    : null;

  // Countdown for pending_payment with expires_at
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  
  useEffect(() => {
    if (a.status !== "pendente_pagamento" || !a.expires_at) {
      setTimeLeft(null);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(a.expires_at!).getTime() - Date.now()) / 1000));
      if (diff <= 0) {
        setTimeLeft("Expirado");
        return;
      }
      const mm = Math.floor(diff / 60);
      const ss = String(diff % 60).padStart(2, "0");
      setTimeLeft(`${mm}:${ss}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [a.status, a.expires_at]);

  return (
    <div className={`group rounded-3xl border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-all shadow-lg backdrop-blur-sm ${a.status === "pendente_pagamento" ? "border-amber-500/30" : ""}`}>
      <div className="flex items-start justify-between mb-4">
        
        {/* Esquerda: Info do Agendamento */}
        <div>
          <h4 className="font-bold text-white text-lg leading-tight">{a.service_name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`${config.cls} border text-[9px] font-black uppercase px-2 py-0.5`}>{config.label}</Badge>
            {remaining != null && remaining > 0 && !hasPaid && (
              <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">
                Falta R$ {remaining.toFixed(2).replace(".", ",")} no local
              </span>
            )}
          </div>
        </div>

        {/* Direita: Timer e Ícone */}
        <div className="flex flex-col items-end gap-2">
          {a.status === "pendente_pagamento" && timeLeft && (
            <div className={`text-xs font-black tabular-nums ${timeLeft === "Expirado" ? "text-red-500" : "text-amber-400"}`}>
              {timeLeft === "Expirado" ? "⚠️ Expirado" : `Expira em ${timeLeft}`}
            </div>
          )}
          <div className="h-10 w-10 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-cyan-400">
            <Calendar className="h-5 w-5" />
          </div>
        </div>

      </div>

      {/* Rodapé do Card: Data, Hora e Profissional */}
      <div className="grid grid-cols-2 gap-4 bg-slate-950/50 rounded-2xl p-3 border border-slate-800/50">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <p className="text-xs font-bold text-slate-300">
            {format(parseISO(a.scheduled_at), "dd/MM 'às' HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
          <User className="h-3.5 w-3.5 text-slate-500" />
          <p className="text-xs font-bold text-slate-300 truncate">{a.barber_name || 'Geral'}</p>
        </div>
      </div>
    </div>
  );
};

export default MyAppointments;