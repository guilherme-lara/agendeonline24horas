import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Scissors, Loader2, Plus, Trash2, GripVertical, Settings, AlertTriangle, RefreshCw, Check, ShieldCheck, Users, Info, Tag
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
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
  const { barbershop } = useBarbershop();
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

  const queryEnabled = !!barbershop?.id;

  const { data: services = [], isLoading, isError, refetch } = useQuery<Service[]>({
    queryKey: ["services", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: queryEnabled,
  });

  const { data: barbers = [] } = useQuery<Barber[]>({
    queryKey: ["barbers", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("barbershop_id", barbershop.id);
      if (error) throw error;
      return data;
    },
    enabled: queryEnabled,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, active")
        .eq("active", true)
        .eq("barbershop_id", barbershop.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: queryEnabled,
  });

  const { data: allCategories = [] } = useQuery<Category[]>({
    queryKey: ["categories-admin", barbershop?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, active")
        .eq("barbershop_id", barbershop?.id)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: queryEnabled,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!barbershop?.id) throw new Error("Estabelecimento não encontrado.");

      const numericPrice = Number(price) || 0;
      const numericAdvanceValue = Number(advanceValue) || 0;

      if (numericAdvanceValue > numericPrice) {
        throw new Error(
          "O valor do adiantamento não pode ser maior que o preço final.",
        );
      }
      if (numericAdvanceValue <= 0) {
        throw new Error("O valor do adiantamento deve ser maior que R$ 0,00.");
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
            barbershop_id: barbershop?.id,
            sort_order: services.length,
          })
          .select("id")
          .single();
        if (error) throw error;
        serviceId = data.id;
      }

      if (!serviceId)
        throw new Error("ID do serviço não encontrado após salvar.");

      // REGRA DE NEGÓCIO: Atualizar `barber_services`
      // 1. Deletar vínculos antigos para este serviço
      const { error: deleteError } = await supabase
        .from("barber_services")
        .delete()
        .eq("service_id", serviceId);
      if (deleteError)
        throw new Error(
          `Falha ao remover vínculos antigos: ${deleteError.message}`,
        );

      if (!barbershop)
        throw new Error("Sessão expirada. Faça login novamente.");
      const tenantId = barbershop.id;

      // 2. Inserir novos vínculos (apenas os que têm comissão definida)
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
          throw new Error(`Falha ao salvar comissões: ${insertError.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      // Também invalidar a query de recursos da loja para o PublicBooking
      queryClient.invalidateQueries({ queryKey: ["shopResources"] });
      toast({
        title: editing
          ? "Serviço Atualizado com Sucesso!"
          : "Serviço Cadastrado com Sucesso!",
        description: "As comissões dos profissionais foram vinculadas.",
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
            "Este serviço possui agendamentos. Desative-o em vez de deletar.",
          );
        throw new Error(`Erro ao deletar: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["shopResources"] });
      toast({ title: "Serviço removido com sucesso." });
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

    // Fetch e preenche as comissões existentes
    const { data, error } = await supabase
      .from("barber_services")
      .select("barber_id, commission_pct")
      .eq("service_id", s.id);
    if (error) {
      toast({
        title: "Erro ao buscar comissões",
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
        throw new Error("Nome da categoria é obrigatório.");
      if (!barbershop?.id) throw new Error("Estabelecimento não encontrado.");


      if (editingCategory) {
        const { error } = await supabase
          .from("categories")
          .update({ name: categoryName.trim() })
          .eq("id", editingCategory.id)
          .eq("barbershop_id", barbershop.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categories")
          .insert({ name: categoryName.trim(), barbershop_id: barbershop.id});
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
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de sincronização</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar seu catálogo de serviços.</p>
        <Button onClick={() => refetch()} className="gold-gradient text-primary-foreground px-8 font-bold"><RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente</Button>
      </div>
    );
  }

  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight font-display"><Scissors className="h-8 w-8 text-primary" /> Catálogo de Serviços</h1>
          <p className="text-muted-foreground text-sm mt-1 font-medium">Defina os preços, tempos e quais profissionais realizam cada serviço.</p>
        </div>
        <Button onClick={openNew} className="gold-gradient text-primary-foreground font-bold h-12 px-6 rounded-xl shadow-gold transition-all active:scale-95"><Plus className="h-5 w-5 mr-2" /> Novo Serviço</Button>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="mb-6 bg-card border border-border">
          <TabsTrigger value="services" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Serviços</TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">Categorias</TabsTrigger>
        </TabsList>

        <TabsContent value="services">

      {services.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-16 text-center shadow-card">
            <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-border"><Scissors className="h-10 w-10 text-muted-foreground/30" /></div>
            <h3 className="text-xl font-bold text-foreground mb-2">Catálogo Vazio</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">Comece cadastrando seu serviço principal para liberar a agenda online.</p>
            <Button onClick={openNew} variant="outline" className="border-border text-muted-foreground hover:text-foreground">Cadastrar Primeiro Serviço</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {services.map((s) => (
            <div key={s.id} className={`group flex items-center gap-4 rounded-2xl border transition-all duration-300 p-5 backdrop-blur-md shadow-card ${!s.active ? "bg-background/40 border-border opacity-60" : "bg-card border-border hover:border-primary/30"}`}>
              <GripVertical className="h-5 w-5 text-muted-foreground/30 flex-shrink-0 cursor-grab group-hover:text-muted-foreground transition-colors" />
              <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground text-lg tracking-tight truncate">{s.name}</p>
                  <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                      {s.category_id && categories.find(c => c.id === s.category_id) && (
                        <Badge variant="secondary" className="text-[10px] font-bold">{categories.find(c => c.id === s.category_id)?.name}</Badge>
                      )}
                      <span className="text-primary">R$ {Number(s.price).toFixed(2).replace(".", ",")}</span>
                      <span>&bull;</span>
                      <span>{s.duration} Minutos</span>
                      {s.requires_advance_payment && s.advance_payment_value > 0 && <><span className="text-emerald-500">&bull; Sinal: R$ {Number(s.advance_payment_value).toFixed(2).replace(".", ",")}</span></>}
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 mr-2 pr-4 border-r border-border">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter hidden sm:block">Ativo</span>
                      <Switch checked={s.active} onCheckedChange={() => toggleMutation.mutate({ id: s.id, active: !s.active })} disabled={toggleMutation.isPending} />
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl" onClick={() => openEdit(s)}><Settings className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl" onClick={() => { if(confirm("Deletar este serviço? A ação não pode ser desfeita.")) deleteMutation.mutate(s.id); }} disabled={deleteMutation.isPending}>{deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-lg shadow-2xl">
          <DialogHeader className="border-b border-border/50 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black font-display"><Scissors className="text-primary h-6 w-6" /> {editing ? "Ajustar Serviço" : "Novo Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-4">
              <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome do Serviço</label>
                  <Input placeholder="Ex: Corte Degradê" value={name} onChange={(e) => setName(e.target.value)} className="bg-background border-border h-12 text-foreground" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Preço (R$)</label>
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
                      <span className="text-sm font-bold text-foreground">Preço "A partir de"</span>
                  </label>
              </div>
              <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-2xl p-4 space-y-2 md:col-span-2">
                  <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400 flex-shrink-0" /><p className="text-xs font-bold text-emerald-300 uppercase tracking-tight">Sinal Obrigatório (Pagamento Online)</p></div>
                  <p className="text-[10px] text-emerald-500/80 font-medium -mt-1">O cliente paga um adiantamento online para garantir o horário.</p>
                  <div className="pt-2">
                      <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-1 block">Valor do Sinal (R$)</label>
                      <Input type="number" placeholder="0.00" value={advanceValue} onChange={(e) => setAdvanceValue(e.target.value)} className="bg-background border-emerald-500/30 h-11 font-mono text-emerald-400 font-bold" />
                  </div>
              </div>

              {/* NOVA SEÇÃO DE PROFISSIONAIS E COMISSÕES */}
              <div className="md:col-span-2 space-y-4 pt-4 border-t border-border/50">
                  <div className="space-y-1">
                      <label className="text-sm font-bold text-foreground flex items-center gap-2"><Users className="h-5 w-5 text-primary"/> Profissionais & Comissões</label>
                      <p className="text-xs text-muted-foreground">Selecione quem realiza este serviço e defina a comissão individual.</p>
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
                        <span>Você precisa cadastrar seus profissionais na aba "Profissionais" antes de vinculá-los a um serviço.</span>
                    </div>
                   )}
              </div>
          </div>
          <div className="pt-6">
            <Button
              className="w-full gold-gradient text-primary-foreground font-black h-14 rounded-2xl shadow-gold transition-all active:scale-95"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !name.trim() || !price}
            >
              {saveMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Check className="h-5 w-5 mr-2" />}
              {editing ? "Salvar Alterações" : "Ativar Novo Serviço"}
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
              <p className="text-sm text-muted-foreground mt-1">Organize seus serviços em grupos para facilitar a navegação do cliente.</p>
            </div>
            <Button onClick={openNewCategory} className="gold-gradient text-primary-foreground font-bold h-12 px-6 rounded-xl shadow-gold transition-all active:scale-95"><Plus className="h-5 w-5 mr-2" /> Nova Categoria</Button>
          </div>

          {allCategories.length === 0 ? (
            <div className="bg-card border border-border rounded-3xl p-16 text-center shadow-card">
                <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-border"><Tag className="h-10 w-10 text-muted-foreground/30" /></div>
                <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma Categoria</h3>
                <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">Crie categorias como "Cabelo", "Barba", "Combo" para organizar seus serviços.</p>
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
            <DialogContent className="bg-card border-border text-foreground max-w-md shadow-2xl">
              <DialogHeader className="border-b border-border/50 pb-4">
                <DialogTitle className="flex items-center gap-2 text-lg font-black font-display"><Tag className="text-primary h-5 w-5" /> {editingCategory ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
              </DialogHeader>
              <div className="pt-4 space-y-4">
                  <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome da Categoria</label>
                      <Input placeholder="Ex: Cabelo, Barba, Combo..." value={categoryName} onChange={(e) => setCategoryName(e.target.value)} className="bg-background border-border h-12 text-foreground font-bold" />
                  </div>
                  <Button
                    className="w-full gold-gradient text-primary-foreground font-black h-12 rounded-xl shadow-gold transition-all active:scale-95"
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
