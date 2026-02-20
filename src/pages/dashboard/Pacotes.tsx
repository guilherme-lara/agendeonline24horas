import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { PackageCheck, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Package {
  id: string;
  name: string;
  price: number;
  quantity: number;
  service_id: string | null;
  description: string;
  active: boolean;
}

interface Service {
  id: string;
  name: string;
}

const Pacotes = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const [packages, setPackages] = useState<Package[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [serviceId, setServiceId] = useState("none");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    if (!barbershop) return;
    const [pkgRes, svcRes] = await Promise.all([
      supabase.from("packages").select("*").eq("barbershop_id", barbershop.id).order("name"),
      supabase.from("services").select("id, name").eq("barbershop_id", barbershop.id).eq("active", true),
    ]);
    setPackages((pkgRes.data as Package[]) || []);
    setServices((svcRes.data as Service[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [barbershop]);

  const openNew = () => {
    setEditing(null);
    setName(""); setPrice(""); setQuantity("1"); setServiceId("none"); setDescription("");
    setOpen(true);
  };

  const openEdit = (p: Package) => {
    setEditing(p);
    setName(p.name); setPrice(String(p.price)); setQuantity(String(p.quantity));
    setServiceId(p.service_id || "none"); setDescription(p.description || "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!barbershop || !name.trim()) return;
    setSaving(true);
    const payload = {
      name, price: Number(price), quantity: Number(quantity),
      service_id: serviceId === "none" ? null : serviceId,
      description,
    };
    if (editing) {
      const { error } = await supabase.from("packages").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Pacote atualizado!" }); setOpen(false); fetch(); }
    } else {
      const { error } = await supabase.from("packages").insert({ ...payload, barbershop_id: barbershop.id });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Pacote criado!" }); setOpen(false); fetch(); }
    }
    setSaving(false);
  };

  const toggleActive = async (p: Package) => {
    await supabase.from("packages").update({ active: !p.active }).eq("id", p.id);
    setPackages((prev) => prev.map((pk) => pk.id === p.id ? { ...pk, active: !pk.active } : pk));
  };

  const handleDelete = async (id: string) => {
    await supabase.from("packages").delete().eq("id", id);
    setPackages((prev) => prev.filter((p) => p.id !== id));
    toast({ title: "Pacote removido" });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-primary" /> Pacotes
          </h1>
          <p className="text-sm text-muted-foreground">Combos e pacotes de serviços</p>
        </div>
        <Button onClick={openNew} className="gold-gradient text-primary-foreground font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo Pacote
        </Button>
      </div>

      {packages.length === 0 ? (
        <div className="text-center py-16">
          <PackageCheck className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">Nenhum pacote cadastrado</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie combos atrativos para fidelizar seus clientes.</p>
          <Button onClick={openNew} variant="outline">Criar Pacote</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((p) => {
            const svc = services.find((s) => s.id === p.service_id);
            return (
              <div key={p.id} className={`rounded-xl border bg-card p-4 space-y-3 ${!p.active ? "opacity-60" : "border-border"}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                    {svc && <p className="text-xs text-primary mt-1">Serviço: {svc.name}</p>}
                  </div>
                  <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "Ativo" : "Inativo"}</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Quantidade</p>
                    <p className="font-medium">{p.quantity}×</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Valor</p>
                    <p className="font-bold text-primary">R$ {Number(p.price).toFixed(2).replace(".", ",")}</p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(p)}>
                    {p.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Pacote" : "Novo Pacote"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome do pacote" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input type="number" placeholder="Valor (R$)" value={price} onChange={(e) => setPrice(e.target.value)} />
              <Input type="number" placeholder="Quantidade" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <Select value={serviceId} onValueChange={setServiceId}>
              <SelectTrigger><SelectValue placeholder="Serviço vinculado (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              className="w-full gold-gradient text-primary-foreground font-semibold"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Salvar Alterações" : "Criar Pacote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pacotes;
