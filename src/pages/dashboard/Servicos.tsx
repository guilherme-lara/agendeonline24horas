import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scissors, Loader2, Plus, Trash2, GripVertical, Settings, AlertTriangle, RefreshCw, Check, ShieldCheck, Users, Info, Tag
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  active: boolean;
  sort_order: number;
  requires_advance_payment: boolean;
  advance_payment_value: number;
  category_id: string | null;
  price_is_starting_at: boolean;
}

interface Barber {
    id: string;
    name: string;
}

interface BarberCommission {
    barber_id: string;
    commission_pct: number | string;
}

interface Category {
    id: string;
    name: string;
    active: boolean;
}

const Servicos = () => {
  const { clinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [advanceValue, setAdvanceValue] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [priceIsStartingAt, setPriceIsStartingAt] = useState(false);
  const [barberCommissions, setBarberCommissions] = useState<BarberCommission[]>([]);

  // Categories management
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");

  const queryEnabled = !!clinic?.id;

  const { data: services = [], isLoading, isError, refetch } = useQuery<Service[]>({
    queryKey: ["services", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", clinic.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: queryEnabled,
  });

  const { data: barbers = [] } = useQuery<Barber[]>({
    queryKey: ["barbers", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data, error } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("barbershop_id", clinic.id);
      if (error) throw error;
      return data;
    },
    enabled: queryEnabled,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, active")
        .eq("active", true)
        .eq("barbershop_id", clinic.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: queryEnabled,
  });

  const { data: allCategories = [] } = useQuery<Category[]>({
    queryKey: ["categories-admin", clinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, active")
        .eq("barbershop_id", clinic?.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: queryEnabled,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!clinic?.id) throw new Error("Estabelecimento nÃ£o encontrado.");

      const isPaymentConfigured = !!(clinic as any)?.infinitepay_tag;
      const numericPrice = Number(price) || 0;
      const numericAdvanceValue = isPaymentConfigured ? (Number(advanceValue) || 0) : 0;

      if (numericAdvanceValue > numericPrice) {
        throw new Error(
          "O valor do adiantamento nÃ£o pode ser maior que o preÃ§o final.",
        );
      }
      if (numericAdvanceValue < 0) {
        throw new Error("O valor do adiantamento nÃ£o pode ser negativo.");
      }

      const servicePayload = {
        name: name.trim(),
        price: numericPrice,
        duration: Number(duration) || 30,
        requires_advance_payment: true,
        advance_payment_value: numericAdvanceValue,
        category_id: categoryId || null,
        price_is_starting_at: priceIsStartingAt,
      };

      let serviceId = editing?.id;

      if (editing) {
        const { data, error } = await supabase
          .from("services")
          .update(servicePayload)
          .eq("id", editing.id)
          .select("id")
          .single();
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("services")
          .insert({
            ...servicePayload,
            barbershop_id: clinic?.id,
            sort_order: services.length,
          })
          .select("id")
          .single();
        if (error) throw error;
        serviceId = data.id;
      }

      if (!serviceId)
        throw new Error("ID do serviÃ§o nÃ£o encontrado apÃ³s salvar.");

      // REGRA DE NEGÃ“CIO: Atualizar `barber_services`
      // 1. Deletar vÃ­nculos antigos para este serviÃ§o
      const { error: deleteError } = await supabase
        .from("barber_services")
        .delete()
        .eq("service_id", serviceId);
      if (deleteError)
        throw new Error(
          `Falha ao remover vÃ­nculos antigos: ${deleteError.message}`,
        );

      if (!clinic)
        throw new Error("SessÃ£o expirada. FaÃ§a login novamente.");
      const tenantId = clinic.id;

      // 2. Inserir novos vÃ­nculos (apenas os que tÃªm comissÃ£o definida)
      const validCommissions = barberCommissions
        .filter(
          (bc) => bc.commission_pct !== "" && Number(bc.commission_pct) >= 0,
        )
        .map((bc) => ({
          barbershop_id: tenantId,
          service_id: serviceId,
          barber_id: bc.barber_id,
          commission_pct: Number(bc.commission_pct),
        }));

      if (validCommissions.length > 0) {
        const { error: insertError } = await supabase
          .from("barber_services")
          .insert(validCommissions);
        if (insertError)
          throw new Error(`Falha ao salvar comissÃµes: ${insertError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      // TambÃ©m invalidar a query de recursos da loja para o PublicBooking
      queryClient.invalidateQueries({ queryKey: ["shopResources"] });
      toast({
        title: editing
          ? "ServiÃ§o Atualizado com Sucesso!"
          : "ServiÃ§o Cadastrado com Sucesso!",
        description: "As comissÃµes dos profissionais foram vinculadas.",
      });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao salvar",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("services")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) {
        if (error.code === "23503")
          throw new Error(
            "Este serviÃ§o possui agendamentos. Desative-o em vez de deletar.",
          );
        throw new Error(`Erro ao deletar: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["shopResources"] });
      toast({ title: "ServiÃ§o removido com sucesso." });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao remover",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const openNew = () => {
    setEditing(null);
    resetForm();
    setIsDialogOpen(true);
  };

  const openEdit = async (s: Service) => {
    setEditing(s);
    setName(s.name);
    setPrice(String(s.price));
    setDuration(String(s.duration));
    setAdvanceValue(String(s.advance_payment_value || 0));
    setCategoryId(s.category_id || "");
    setPriceIsStartingAt(s.price_is_starting_at || false);

    // Fetch e preenche as comissÃµes existentes
    const { data, error } = await supabase
      .from("barber_services")
      .select("barber_id, commission_pct")
      .eq("service_id", s.id);
    if (error) {
      toast({
        title: "Erro ao buscar comissÃµes",
        description: error.message,
        variant: "destructive",
      });
      setBarberCommissions([]);
    } else {
      setBarberCommissions(
        data.map((d) => ({ ...d, commission_pct: d.commission_pct || "" })),
      );
    }

    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setName("");
    setPrice("");
    setDuration("30");
    setAdvanceValue("");
    setCategoryId("");
    setPriceIsStartingAt(false);
    setBarberCommissions([]);
  };

  const handleCommissionToggle = (barberId: string, checked: boolean) => {
    if (checked) {
      setBarberCommissions([
        ...barberCommissions,
        { barber_id: barberId, commission_pct: "" },
      ]);
    } else {
      setBarberCommissions(
        barberCommissions.filter((bc) => bc.barber_id !== barberId),
      );
    }
  };

  const handleCommissionChange = (barberId: string, value: string) => {
    setBarberCommissions(
      barberCommissions.map((bc) =>
        bc.barber_id === barberId ? { ...bc, commission_pct: value } : bc,
      ),
    );
  };

  // Category management mutations
  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!categoryName.trim())
        throw new Error("Nome da categoria Ã© obrigatÃ³rio.");
      if (!clinic?.id) throw new Error("Estabelecimento nÃ£o encontrado.");


      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update({ name: categoryName.trim() })
          .eq("id", editingCategory.id)
          .eq("barbershop_id", clinic.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({ name: categoryName.trim(), barbershop_id: clinic.id});
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-admin"] });
      toast({
        title: editingCategory ? "Categoria atualizada!" : "Categoria criada!",
      });
      setCategoryDialogOpen(false);
      setEditingCategory(null);
      setCategoryName("");
    },
    onError: (err: any) =>
      toast({
        title: "Erro",
        description: err.message,
        variant: "destructive",
      }),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-admin"] });
      toast({ title: "Categoria removida." });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openNewCategory = () => { setEditingCategory(null); setCategoryName(""); setCategoryDialogOpen(true); };
  const openEditCategory = (cat: Category) => { setEditingCategory(cat); setCategoryName(cat.name); setCategoryDialogOpen(true); };

  if (isLoading && queryEnabled && !services.length && !isError) {
    return <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Afiando as tesouras...</p></div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronizaÃ§Ã£o</h2>
        <p className="text-sm text-muted-foreground mb-8">NÃ£o conseguimos carregar seu catÃ¡logo de serviÃ§os.</p>
        <Button onClick={() => refetch()} className="bg-primary text-primary-foreground px-8 font-bold"><RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente</Button>
      </div>
    );
  }

  if (!clinic) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3 tracking-tight font-display"><Scissors className="h-8 w-8 text-foreground" /> CatÃ¡logo de ServiÃ§os</h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">Defina os preÃ§os, tempos e quais profissionais realizam cada serviÃ§o.</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground font-medium h-10 px-4 rounded-md shadow-sm transition-all"><Plus className="h-5 w-5 mr-2" /> Novo ServiÃ§o</Button>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="mb-6 bg-card border border-border p-1 rounded-xl">
          <TabsTrigger value="services" className="data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-900 rounded-lg">ServiÃ§os</TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-zinc-100 data-[state=active]:text-zinc-900 rounded-lg">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="services">

      {services.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center shadow-sm">
            <div className="bg-secondary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-border/50"><Scissors className="h-10 w-10 text-zinc-300" /></div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">CatÃ¡logo Vazio</h3>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto mb-6">Comece cadastrando seu serviÃ§o principal para liberar a agenda online.</p>
            <Button onClick={openNew} variant="outline" className="border-border text-zinc-500 hover:text-zinc-900">Cadastrar Primeiro ServiÃ§o</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {services.map((s) => (
            <div key={s.id} className={`group flex items-center gap-4 rounded-xl border transition-all duration-300 p-5 shadow-sm ${!s.active ? "bg-secondary border-border/50 opacity-60" : "bg-card border-border hover:border-muted-foreground/30"}`}>
              <GripVertical className="h-5 w-5 text-muted-foreground/30 flex-shrink-0 cursor-grab group-hover:text-muted-foreground transition-colors" />
              <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-lg tracking-tight truncate">{s.name}</p>
                  <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1">
                      {s.category_id && categories.find(c => c.id === s.category_id) && (
                        <Badge variant="secondary" className="text-[10px] font-medium bg-secondary text-secondary-foreground border-none">{categories.find(c => c.id === s.category_id)?.name}</Badge>
                      )}
                      <span className="text-foreground">R$ {Number(s.price).toFixed(2).replace(".", ",")}</span>
                      <span>&bull;</span>
                      <span>{s.duration} Minutos</span>
                      {s.requires_advance_payment && s.advance_payment_value > 0 && <><span className="text-muted-foreground">&bull; Sinal: R$ {Number(s.advance_payment_value).toFixed(2).replace(".", ",")}</span></>}
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-2 pr-4 border-r border-border">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter hidden sm:block">Ativo</span>
                      <Switch checked={s.active} onCheckedChange={() => toggleMutation.mutate({ id: s.id, active: !s.active })} disabled={toggleMutation.isPending} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl" onClick={() => openEdit(s)}><Settings className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl" onClick={() => { if(confirm("Deletar este serviÃ§o? A aÃ§Ã£o nÃ£o pode ser desfeita.")) deleteMutation.mutate(s.id); }} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground shadow-elev-3 p-6 w-full max-w-full sm:max-w-lg fixed sm:relative top-auto bottom-0 sm:top-[50%] translate-y-0 sm:-translate-y-1/2 rounded-t-3xl rounded-b-none sm:rounded-2xl m-0">
          <DialogHeader className="border-b border-border/50 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black font-display"><Scissors className="text-primary h-6 w-6" /> {editing ? "Ajustar ServiÃ§o" : "Novo ServiÃ§o"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-4">
              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome do ServiÃ§o</label>
                  <Input placeholder="Ex: Corte DegradÃª" value={name} onChange={(e) => setName(e.target.value)} className="bg-background border-border h-12 text-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">PreÃ§o (R$)</label>
                      <Input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} className="bg-background border-border h-12 font-mono text-primary font-bold" />
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tempo (Min)</label>
                      <Input type="number" placeholder="30" value={duration} onChange={(e) => setDuration(e.target.value)} className="bg-background border-border h-12 text-foreground font-bold" />
                  </div>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5"><Tag className="h-3 w-3" /> Categoria</label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger className="bg-background border-border h-12 text-foreground">
                          <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                          {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                      </SelectContent>
                  </Select>
              </div>
              <div className="space-y-2 flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input
                          type="checkbox"
                          checked={priceIsStartingAt}
                          onChange={(e) => setPriceIsStartingAt(e.target.checked)}
                          className="rounded border-border"
                      />
                      <span className="text-sm font-bold text-foreground">PreÃ§o "A partir de"</span>
                  </label>
              </div>
              {/* Payment Gateway Configuration Check */}
              {(() => {
                  const isPaymentConfigured = !!(clinic as any)?.infinitepay_tag;
                  return isPaymentConfigured ? (
                      <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2 md:col-span-2">
                          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" /><p className="text-xs font-bold text-emerald-300 uppercase tracking-tight">Sinal ObrigatÃ³rio (Pagamento Online)</p></div>
                          <p className="text-[10px] text-emerald-500/80 font-medium -mt-1">O cliente paga um adiantamento online para garantir o horÃ¡rio.</p>
                          <div className="pt-2">
                              <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 block">Valor do Sinal (R$)</label>
                              <Input type="number" placeholder="0.00" value={advanceValue} onChange={(e) => setAdvanceValue(e.target.value)} className="bg-background border-emerald-500/30 h-11 font-mono text-emerald-400 font-bold" />
                          </div>
                      </div>
                  ) : (
                      <div className="bg-zinc-100 border border-border rounded-2xl p-4 space-y-2 md:col-span-2 opacity-70">
                          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-zinc-400 flex-shrink-0" /><p className="text-xs font-bold text-zinc-500 uppercase tracking-tight">Sinal ObrigatÃ³rio (IndisponÃ­vel)</p></div>
                          <p className="text-[10px] text-zinc-500 font-medium -mt-1">Configure o recebimento via InfinitePay nas configuraÃ§Ãµes para habilitar o adiantamento online.</p>
                          <div className="pt-2">
                              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Valor do Sinal (R$)</label>
                              <Input type="number" placeholder="0.00" disabled value="" className="bg-secondary border-border h-11 font-mono text-zinc-400 font-bold cursor-not-allowed" />
                          </div>
                      </div>
                  );
              })()}

              {/* NOVA SEÃ‡ÃƒO DE PROFISSIONAIS E COMISSÃ•ES */}
              <div className="md:col-span-2 space-y-4 pt-4 border-t border-border/50">
                  <div className="space-y-1">
                      <label className="text-sm font-bold text-foreground flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Profissionais & ComissÃµes</label>
                      <p className="text-xs text-muted-foreground">Selecione quem realiza este serviÃ§o e defina a comissÃ£o individual.</p>
                  </div>
                  {barbers.length > 0 ? (
                    <div className="max-h-[210px] overflow-y-auto space-y-3 pr-2 -mr-2">
                        {barbers.map((barber) => {
                            const isLinked = barberCommissions.some(bc => bc.barber_id === barber.id);
                            const commission = barberCommissions.find(bc => bc.barber_id === barber.id)?.commission_pct ?? '';
                            return (
                                <div key={barber.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isLinked ? 'bg-secondary border-primary/20' : 'bg-background border-border'}`}>
                                    <Switch id={`barber-${barber.id}`} checked={isLinked} onCheckedChange={(c) => handleCommissionToggle(barber.id, c)} />
                                    <label htmlFor={`barber-${barber.id}`} className="flex-1 text-sm font-medium text-foreground truncate cursor-pointer">{barber.name}</label>
                                    {isLinked && (
                                        <div className="relative w-28">
                                            <Input type="number" placeholder="0" value={commission} onChange={(e) => handleCommissionChange(barber.id, e.target.value)} className="h-9 text-right pr-7 font-mono bg-card border-border" />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                   ) : (
                    <div className="flex items-center gap-3 bg-amber-900/20 text-amber-400 text-xs p-4 rounded-xl border border-amber-500/30">
                        <Info className="h-6 w-6" />
                        <span>VocÃª precisa cadastrar seus profissionais na aba "Profissionais" antes de vinculÃ¡-los a um serviÃ§o.</span>
                    </div>
                   )}
              </div>
          </div>
          <div className="pt-6">
            <Button
              className="w-full bg-primary text-primary-foreground font-black h-14 rounded-2xl shadow-sm transition-all active:scale-95"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim() || !price}
            >
              {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
              {editing ? "Salvar AlteraÃ§Ãµes" : "Ativar Novo ServiÃ§o"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
        </TabsContent>

        {/* TABA: Categorias */}
        <TabsContent value="categories">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-foreground flex items-center gap-2 font-display">Gerencie suas Categorias</h2>
              <p className="text-sm text-muted-foreground mt-1">Organize seus serviÃ§os em grupos para facilitar a navegaÃ§Ã£o do cliente.</p>
            </div>
            <Button onClick={openNewCategory} className="bg-primary text-primary-foreground font-bold h-12 px-6 rounded-xl shadow-sm transition-all active:scale-95"><Plus className="h-5 w-5 mr-2" /> Nova Categoria</Button>
          </div>

          {allCategories.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-16 text-center shadow-card">
                <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-border"><Tag className="h-10 w-10 text-muted-foreground/30" /></div>
                <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma Categoria</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">Crie categorias como "Cabelo", "Barba", "Combo" para organizar seus serviÃ§os.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {allCategories.map((cat) => (
                <div key={cat.id} className={`group flex items-center gap-4 rounded-2xl border transition-all p-5 bg-card border-border hover:border-primary/30`}>
                    <Tag className="h-5 w-5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground text-lg tracking-tight truncate">{cat.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cat.active ? <span className="text-emerald-500 font-bold">Ativa</span> : <span className="text-muted-foreground/60">Inativa</span>}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl" onClick={() => openEditCategory(cat)}><Settings className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl" onClick={() => { if(confirm("Deletar esta categoria?")) deleteCategoryMutation.mutate(cat.id); }} disabled={deleteCategoryMutation.isPending}>{deleteCategoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>
                    </div>
                </div>
              ))}
            </div>
          )}

          <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
            <DialogContent className="bg-card border-border text-foreground shadow-elev-3 p-6 w-full max-w-full sm:max-w-md fixed sm:relative top-auto bottom-0 sm:top-[50%] translate-y-0 sm:-translate-y-1/2 rounded-t-3xl rounded-b-none sm:rounded-2xl m-0">
              <DialogHeader className="border-b border-border/50 pb-4">
                <DialogTitle className="flex items-center gap-2 text-lg font-black font-display"><Tag className="text-primary h-5 w-5" /> {editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
              </DialogHeader>
              <div className="pt-4 space-y-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome da Categoria</label>
                      <Input placeholder="Ex: Tratamentos, Consultas, Exames..." value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="bg-background border-border h-12 text-foreground font-bold" />
                  </div>
                  <Button
                    className="w-full bg-primary text-primary-foreground font-black h-12 rounded-xl shadow-sm transition-all active:scale-95"
                    onClick={() => saveCategoryMutation.mutate()}
                    disabled={saveCategoryMutation.isPending || !categoryName.trim()}
                  >
                    {saveCategoryMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
                    {editingCategory ? "Salvar" : "Criar Categoria"}
                  </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Servicos;

