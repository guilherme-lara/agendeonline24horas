import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Smile, Plus, Loader2, Search, Pencil, Trash2, Phone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface Customer {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
  notes: string;
  created_at: string;
}

const Clientes = () => {
  const { barbershop } = useBarbershop();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    if (!barbershop) return;
    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("barbershop_id", barbershop.id)
      .order("name");
    setCustomers((data as Customer[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, [barbershop]);

  const openNew = () => {
    setEditing(null);
    setName("");
    setPhone("");
    setBirthDate("");
    setNotes("");
    setOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone);
    setBirthDate(c.birth_date || "");
    setNotes(c.notes || "");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!barbershop || !name.trim()) return;
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from("customers").update({ name, phone, birth_date: birthDate || null, notes }).eq("id", editing.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Cliente atualizado!" }); setOpen(false); fetchCustomers(); }
    } else {
      const { error } = await supabase.from("customers").insert({ barbershop_id: barbershop.id, name, phone, birth_date: birthDate || null, notes });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Cliente cadastrado!" }); setOpen(false); fetchCustomers(); }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("customers").delete().eq("id", id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Cliente removido" });
  };

  const filtered = customers.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  );

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Smile className="h-6 w-6 text-primary" /> Clientes
          </h1>
          <p className="text-sm text-muted-foreground">{customers.length} clientes cadastrados</p>
        </div>
        <Button onClick={openNew} className="gold-gradient text-primary-foreground font-semibold">
          <Plus className="h-4 w-4 mr-1" /> Novo Cliente
        </Button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Smile className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg mb-1">Nenhum cliente encontrado</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Clientes são cadastrados automaticamente no primeiro agendamento online.
          </p>
          <Button onClick={openNew} variant="outline">Cadastrar Manualmente</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{c.name}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.birth_date && (
                    <span>🎂 {format(new Date(c.birth_date + "T00:00"), "dd/MM", { locale: ptBR })}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome completo" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Telefone (ex: (14) 99999-9999)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data de Aniversário</label>
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <Input placeholder="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button
              className="w-full gold-gradient text-primary-foreground font-semibold"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editing ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clientes;
