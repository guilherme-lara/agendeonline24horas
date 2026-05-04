import { useState, useEffect } from "react";
import { Loader2, Save, Clock, AlertTriangle, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const DAYS = [
  { index: 0, label: "Domingo" },
  { index: 1, label: "Segunda-feira" },
  { index: 2, label: "Terça-feira" },
  { index: 3, label: "Quarta-feira" },
  { index: 4, label: "Quinta-feira" },
  { index: 5, label: "Sexta-feira" },
  { index: 6, label: "Sábado" },
];

interface HourEntry {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

const Horarios = () => {
  const { barbershop, loading: barberLoading, refetch, isError } =
    useBarbershop() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [hours, setHours] = useState<HourEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barbershop?.id) return;

    const loadHours = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("business_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("barbershop_id", barbershop.id);

      if (error) {
        toast({
          title: "Erro ao carregar horários",
          description: error.message,
          variant: "destructive",
        });
      }

      // Ensure all 7 days are present
      const loaded = data || [];
      const defaults: HourEntry[] = DAYS.map((day) => {
        const existing = loaded.find((h: any) => h.day_of_week === day.index);
        if (existing) {
          return {
            day_of_week: existing.day_of_week,
            open_time: existing.open_time || "09:00",
            close_time: existing.close_time || "18:00",
            is_closed: existing.is_closed ?? false,
          };
        }
        return {
          day_of_week: day.index,
          open_time: day.index === 0 || day.index === 6 ? "09:00" : "09:00",
          close_time: day.index === 6 ? "14:00" : "18:00",
          is_closed: day.index === 0,
        };
      });

      setHours(defaults);
      setLoading(false);
    };

    loadHours();
  }, [barbershop?.id, toast]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!barbershop?.id) throw new Error("Estabelecimento não identificado.");

      const { error } = await supabase.from("business_hours").upsert(
        hours.map((h) => ({
          barbershop_id: barbershop.id,
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          is_closed: h.is_closed,
        })),
        { onConflict: "barbershop_id, day_of_week" }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopResources", barbershop?.id] });
      queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
      toast({
        title: "Horários salvos!",
        description: "Os novos horários já estão ativos.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao salvar horários",
        description: err.message || "Verifique sua conexão.",
        variant: "destructive",
      });
    },
  });

  const updateHour = (
    idx: number,
    field: keyof Pick<HourEntry, "open_time" | "close_time" | "is_closed">,
    value: string | boolean
  ) => {
    setHours((prev) =>
      prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h))
    );
  };

  if (barberLoading && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">
          Carregando horários...
        </p>
      </div>
    );
  }

  if (isError && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">
          Erro de sincronização
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          Não foi possível carregar os horários.
        </p>
        <Button onClick={() => refetch()} className="gold-gradient text-primary-foreground px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop) return null;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex items-center gap-4 border-b border-border pb-8">
        <div className="bg-primary/10 p-3 rounded-2xl border border-primary/20">
          <Clock className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight font-display">
            Horários de Funcionamento
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Configure os dias e horários em que seu negócio está aberto.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-3xl p-8 shadow-card space-y-3">
        {DAYS.map((day, idx) => {
          const entry = hours[idx];
          if (!entry) return null;

          return (
            <div
              key={day.index}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl transition-all ${
                entry.is_closed
                  ? "bg-secondary/40"
                  : "bg-secondary/70 border border-border/50"
              }`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="font-bold text-foreground min-w-[130px]">
                  {day.label}
                </span>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={!entry.is_closed}
                    onCheckedChange={(checked) =>
                      updateHour(idx, "is_closed", !checked)
                    }
                    aria-label={entry.is_closed ? "Abrir" : "Fechar"}
                  />
                  <span className="text-xs font-bold uppercase tracking-wider min-w-[60px]">
                    {entry.is_closed ? (
                      <span className="text-destructive">Fechado</span>
                    ) : (
                      <span className="text-emerald-500">Aberto</span>
                    )}
                  </span>
                </div>
              </div>

              {!entry.is_closed && (
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Input
                    type="time"
                    value={entry.open_time}
                    onChange={(e) => updateHour(idx, "open_time", e.target.value)}
                    className="w-28 bg-background border-border h-10 text-center font-mono"
                  />
                  <span className="text-muted-foreground text-sm">até</span>
                  <Input
                    type="time"
                    value={entry.close_time}
                    onChange={(e) =>
                      updateHour(idx, "close_time", e.target.value)
                    }
                    className="w-28 bg-background border-border h-10 text-center font-mono"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mt-6">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full sm:w-auto gold-gradient text-primary-foreground font-black h-14 px-10 rounded-2xl shadow-gold transition-all active:scale-95"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
          ) : (
            <Save className="h-5 w-5 mr-2" />
          )}
          Salvar Horários
        </Button>
      </div>
    </div>
  );
};

export default Horarios;
