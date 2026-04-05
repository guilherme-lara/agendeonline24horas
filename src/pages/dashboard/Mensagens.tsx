import { useState, useEffect } from "react";
import { Loader2, MessageSquare, Save, RefreshCw, AlertTriangle, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AVAILABLE_VARIABLES,
  DEFAULT_CONFIRMATION_TEMPLATE,
  fillMessageTemplate,
} from "@/lib/messageTemplate";

const Mensagens = () => {
  const { barbershop, loading: barberLoading, refetch, isError } =
    useBarbershop() as any;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [template, setTemplate] = useState(DEFAULT_CONFIRMATION_TEMPLATE);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!barbershop) return;

    const loadTemplate = async () => {
      setLoading(true);
      try {
        const { data: shopData } = await supabase
          .from("barbershops")
          .select("settings")
          .eq("id", barbershop.id)
          .single();

        const settings = shopData?.settings as Record<string, any> | null;
        setTemplate(
          settings?.confirmation_message_template || DEFAULT_CONFIRMATION_TEMPLATE
        );
      } catch {
        toast({
          title: "Erro ao carregar template",
          description: "Usando mensagem padrão.",
          variant: "destructive",
        });
      }
      setLoading(false);
    };

    loadTemplate();
  }, [barbershop, toast]);

  // Update preview with sample data
  useEffect(() => {
    const sample = fillMessageTemplate(template, {
      cliente: "João Silva",
      servico: "Corte Masculino",
      data: "15/04/2026",
      horario: "14:30",
      barbeiro: "Roberto",
      preco: 50,
      valor_falta: 30,
    });
    setPreview(sample);
  }, [template]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!barbershop?.id) throw new Error("Barbearia não identificada.");

      const { data: current } = await supabase
        .from("barbershops")
        .select("settings")
        .eq("id", barbershop.id)
        .single();

      const existingSettings = (current?.settings && typeof current.settings === "object")
        ? (current.settings as Record<string, any>)
        : {};

      const newSettings = {
        ...existingSettings,
        confirmation_message_template: template.trim(),
      };

      const { error } = await supabase
        .from("barbershops")
        .update({ settings: newSettings })
        .eq("id", barbershop.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current-barbershop"] });
      toast({
        title: "Mensagem salva!",
        description: "O template de confirmação foi atualizado.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Verifique sua conexão.",
        variant: "destructive",
      });
    },
  });

  const insertVariable = (variable: string) => {
    setTemplate((prev) => {
      const cursorPos = 0;
      return prev.slice(0, cursorPos) + variable + prev.slice(cursorPos);
    });
  };

  if (barberLoading && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">
          Carregando configurações...
        </p>
      </div>
    );
  }

  if (isError && !barbershop) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronização</h2>
        <Button onClick={() => refetch()} className="gold-gradient text-primary-foreground px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  if (!barbershop || loading) {
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
          <MessageSquare className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight font-display">
            Mensagens de Confirmação
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Personalize a mensagem enviada ao cliente após agendar.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* TEMPLATE EDITOR */}
        <div className="bg-card border border-border rounded-3xl p-8 shadow-card space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Template da Mensagem
              </h2>
              <p className="text-xs text-muted-foreground">
                Use as variáveis abaixo para personalizar a mensagem.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTemplate(DEFAULT_CONFIRMATION_TEMPLATE)}
              className="text-xs border-border"
            >
              Restaurar Padrão
            </Button>
          </div>

          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={4}
            className="bg-background border-border text-foreground font-mono text-sm focus-visible:ring-primary/50"
            placeholder="Olá {{cliente}}, seu agendamento para {{servico}} no dia {{data}} está confirmado!"
          />

          {/* VARIABLE CHIPS */}
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-primary/10 hover:text-primary text-xs font-bold transition-colors border border-border"
              >
                {v.key}
                <span className="text-[10px] text-muted-foreground font-normal">{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* LIVE PREVIEW */}
        <div className="bg-card border border-border rounded-3xl p-8 shadow-card space-y-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
            Pré-visualização
          </h2>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-6">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {preview}
            </p>
          </div>
        </div>

        {/* SAVE */}
        <div className="flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !template.trim()}
            className="w-full sm:w-auto gold-gradient text-primary-foreground font-black h-14 px-10 rounded-2xl shadow-gold transition-all active:scale-95"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Save className="h-5 w-5 mr-2" />
            )}
            Salvar Template
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Mensagens;
