import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Smile, Plus, Loader2, Search, Pencil, Trash2, Phone, Calendar as CalendarIcon, User, Save 
} from "lucide-react";
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
  const { barbershop } = useBarbershop() as any;
  const { toast } = useToast();
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  
  // Form States
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
    
    try {
      if (editing) {
        const { error } = await supabase
          .from("customers")
          .update({ name, phone, birth_date: birthDate || null, notes })
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Cliente atualizado com sucesso!" });
      } else {
        const { error } = await supabase
          .from("customers")
          .insert({ barbershop_id: barbershop.id, name, phone, birth_date: birthDate || null, notes });
        if (error) throw error;
        toast({ title: "Cliente cadastrado com sucesso!" });
      }
      setOpen(false);
      fetchCustomers();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if(!window.confirm("Tem certeza que deseja excluir este cliente? O histórico dele não será perdido.")) return;
    
    try {
      await supabase.from("customers").delete().eq("id", id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Cliente removido do cadastro." });
    } catch (error: any) {
      toast({ title: "Erro", description: "Não foi possível remover o cliente.", variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    return customers.filter(
      (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    );
  }, [customers, search]);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-cyan-500" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      
      {/* HEADER DA TELA */}
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 tracking-tight">
            <Users className="h-8 w-8 text-cyan-400" /> Base de Clientes
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Gerencie sua carteira e fidelize seu público.</p>
        </div>
        <Button onClick={openNew} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-cyan-900/20 transition-all active:scale-95">
          <Plus className="h-5 w-5 mr-2" /> Novo Cliente
        </Button>
      </div>

      {/* DASHBOARD RÁPIDO & BUSCA */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-md mb-8">
        <div className="p-6 md:p-8 border-b border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/20">
              <User className="h-8 w-8 text-cyan-400" />
            </div>
            <div>
              <p className="text-3xl font-black text-white tracking-tighter">{customers.length}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Clientes Registrados</p>
            </div>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              className="bg-slate-950 border-slate-800 pl-11 h-12 text-sm rounded-2xl focus:ring-cyan-500/20 text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* LISTA / TABELA DE CLIENTES */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-950/50 text-slate-500 font-black uppercase tracking-[0.2em] border-b border-slate-800">
              <tr>
                <th className="px-8 py-5 text-left">Cliente</th>
                <th className="px-8 py-5 text-left">Contato</th>
                <th className="px-8 py-5 text-left">Aniversário</th>
                <th className="px-8 py-5 text-left">Observações</th>
                <th className="px-8 py-5 text-right">Gestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="bg-slate-950 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800">
                      <Smile className="h-8 w-8 text-slate-700" />
                    </div>
                    <p className="text-slate-500 font-bold uppercase tracking-[0.2em]">Nenhum cliente encontrado</p>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-cyan-500/[0.02] transition-colors group">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-cyan-400 shadow-inner">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-white text-sm">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      {c.phone ? (
                        <div className="flex items-center gap-2 text-slate-400 font-mono">
                          <Phone className="h-3 w-3 text-slate-600" /> {c.phone}
                        </div>
                      ) : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-8 py-4">
                      {c.birth_date ? (
                        <div className="flex items-center gap-2 text-slate-300 font-medium">
                          <CalendarIcon className="h-3 w-3 text-cyan-500" /> 
                          {format(new Date(c.birth_date + "T00:00"), "dd 'de' MMMM", { locale: ptBR })}
                        </div>
                      ) : <span className="text-[10px] uppercase font-bold text-slate-600 tracking-widest">Não informado</span>}
                    </td>
                    <td className="px-8 py-4">
                      <p className="text-slate-500 max-w-[200px] truncate">{c.notes || "-"}</p>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)} className="h-10 w-10 rounded-xl text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="h-10 w-10 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#0b1224] border-slate-800 text-white max-w-md rounded-[2rem] shadow-2xl">
          <DialogHeader className="border-b border-slate-800/50 pb-4">
            <DialogTitle className="flex items-center gap-3 text-xl font-black">
              <User className="text-cyan-400 h-6 w-6" /> {editing ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
              <Input placeholder="Ex: João da Silva" value={name} onChange={(e) => setName(e.target.value)} className="bg-slate-950 border-slate-800 h-12 text-white font-bold" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
                <Input placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-slate-950 border-slate-800 h-12 font-mono text-slate-300" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Aniversário</label>
                <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="bg-slate-950 border-slate-800 h-12 text-slate-300" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Anotações (Opcional)</label>
              <Input placeholder="Ex: Prefere corte militar, alérgico a gilete..." value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-slate-950 border-slate-800 h-12 text-slate-300" />
            </div>

            <Button
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black h-14 rounded-2xl shadow-xl shadow-cyan-900/20 mt-4 transition-all active:scale-95"
              onClick={handleSave}
              disabled={saving || !name.trim()}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
              {editing ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Clientes;
