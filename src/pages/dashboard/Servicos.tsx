import { useState, useEffect } from "react";
import { Scissors, Loader2, Plus, Trash2, GripVertical, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
  active: boolean;
  sort_order: number;
  requires_advance_payment: boolean;
  advance_payment_value: number;
}

const Servicos = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  const [requiresAdvance, setRequiresAdvance] = useState(false);
  const [advanceValue, setAdvanceValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchServices = async () => {
    if (!barbershop) return;
    const { data } = await supabase
      .from("services")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("sort_order");
    setServices((data as Service[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, [barbershop]);

  const openNew = () => {
    setEditing(null);
    setName(""); setPrice(""); setDuration("30");
    setRequiresAdvance(false); setAdvanceValue("");
    setOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setName(s.name); setPrice(String(s.price)); setDuration(String(s.duration));
    setRequiresAdvance(s.requires_advance_payment || false);
    setAdvanceValue(String(s.advance_payment_value || 0));
    setOpen(true);
  };

  const handleSave = async () => {
    if (!barbershop || !name.trim()) return;
    setSaving(true);
    const payload = {
      name,
      price: Number(price) || 0,
      duration: Number(duration) || 30,
      requires_advance_payment: requiresAdvance,
      advance_payment_value: requiresAdvance ? (Number(advanceValue) || 0) : 0,
    };
    if (editing) {
      const { error } = await supabase.from("services").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Serviço atualizado!" }); setOpen(false); fetchServices(); }
    } else {
      const { error } = await supabase.from("services").insert({ ...payload, barbershop_id: barbershop.id, sort_order: services.length });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Serviço cadastrado!" }); setOpen(false); fetchServices(); }
    }
    setSaving(false);
  };

  const handleToggleActive = async (s: Service) => {
    await supabase.from("services").update({ active: !s.active }).eq("id", s.id);
    fetchServices();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("services").delete().eq("id", id);
    fetchServices();
    toast({ title: "Serviço removido" });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!barbershop) return null;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Scissors className="h-6 w-6 text-primary" /> Serviços
          </h1>
          <p className="text-sm text-muted-foreground">{services.length} serviços cadastrados</p>
        </div>
        <Button onClick={openNew} className="gold-gradient text-primary-foreground font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo Serviço
        </Button>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-16">
          <Scissors className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">Nenhum serviço cadastrado</h3>
          <Button onClick={openNew} variant="outline">Cadastrar Serviço</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((s) => (
            <div key={s.id} className={`flex items-center gap-4 rounded-xl border border-border bg-card p-4 ${!s.active ? "opacity-50" : ""}`}>
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{s.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>R$ {Number(s.price).toFixed(2).replace(".", ",")}</span>
                  <span>{s.duration}min</span>
                  {s.requires_advance_payment && (
                    <span className="text-primary">Sinal: R$ {Number(s.advance_payment_value).toFixed(2).replace(".", ",")}</span>
                  )}
                </div>
              </div>
              <Switch checked={s.active} onCheckedChange={() => handleToggleActive(s)} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(s.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do serviço" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Preço (R$)</label>
                <Input type="number" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Duração (min)</label>
                <Input type="number" placeholder="30" value={duration} onChange={(e) => setDuration(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Exige Sinal/Adiantamento?</p>
                <p className="text-xs text-muted-foreground">Cobra valor antecipado para confirmar</p>
              </div>
              <Switch checked={requiresAdvance} onCheckedChange={setRequiresAdvance} />
            </div>
            {requiresAdvance && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Valor do Sinal (R$)</label>
                <Input type="number" placeholder="50.00" value={advanceValue} onChange={(e) => setAdvanceValue(e.target.value)} />
              </div>
            )}
            <Button className="w-full gold-gradient text-primary-foreground font-semibold" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Salvar Alterações" : "Cadastrar Serviço"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Servicos;
