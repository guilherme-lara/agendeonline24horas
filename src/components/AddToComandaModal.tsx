import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Scissors, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface AddToComandaModalProps {
  open: boolean;
  onClose: () => void;
  appointment: any;
  professional: any;
}

interface ComandaItemRow {
  id: string;
  service_name: string;
  price: number;
  duration: number | null;
  product_type: boolean | null;
}

const AddToComandaModal = ({ open, onClose, appointment, professional }: AddToComandaModalProps) => {
  const queryClient = useQueryClient();
  const clinicId = professional?.barbershop_id;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"procedimentos" | "produtos">("procedimentos");
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["comanda-items", appointment?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointment_items")
        .select("id, service_name, price, duration, product_type")
        .eq("appointment_id", appointment.id)
        .order("created_at", { ascending: true } as any);
      if (error) throw error;
      return (data || []) as ComandaItemRow[];
    },
    enabled: open && !!appointment?.id,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["comanda-services", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, price, duration")
        .eq("barbershop_id", clinicId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clinicId,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["comanda-products", clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("id, name, price")
        .eq("barbershop_id", clinicId)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clinicId,
  });

  const filteredList = useMemo(() => {
    const source: any[] = tab === "procedimentos" ? services : products;
    if (!search.trim()) return source;
    const q = search.toLowerCase();
    return source.filter((s) => String(s.name).toLowerCase().includes(q));
  }, [tab, services, products, search]);

  const total = useMemo(
    () => items.reduce((sum, it) => sum + Number(it.price || 0), 0),
    [items]
  );

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["comanda-items", appointment?.id] });
    queryClient.invalidateQueries({ queryKey: ["professional-appointments"] });
    queryClient.invalidateQueries({ queryKey: ["barber-appointments"] });
  };

  const handleAdd = async (item: any, isProduct: boolean) => {
    try {
      setBusyId(item.id);
      const payload = {
        appointment_id: appointment.id,
        service_name: item.name,
        price: Number(item.price || 0),
        duration: isProduct ? 0 : Number(item.duration || 0),
        barber_id: professional?.id,
        barber_name: professional?.name,
        product_type: isProduct,
      };
      const { error } = await (supabase.from("appointment_items") as any).insert(payload);
      if (error) throw error;
      toast.success(`${isProduct ? "Produto" : "Procedimento"} adicionado à comanda`);
      refreshAll();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível adicionar à comanda");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    try {
      setBusyId(itemId);
      const { error } = await supabase.from("appointment_items").delete().eq("id", itemId);
      if (error) throw error;
      toast.success("Item removido");
      refreshAll();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível remover o item");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-primary" />
            Comanda de {appointment?.client_name}
          </DialogTitle>
        </DialogHeader>

        {/* Itens já na comanda */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
            Itens na comanda
          </p>
          {itemsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nenhum item ainda.</p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {it.product_type ? (
                      <ShoppingBag className="h-3.5 w-3.5 text-primary shrink-0" />
                    ) : (
                      <Scissors className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate">{it.service_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold">R$ {Number(it.price).toFixed(2)}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      disabled={busyId === it.id}
                      onClick={() => handleRemove(it.id)}
                    >
                      {busyId === it.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="text-xs font-black uppercase text-muted-foreground">Total</span>
            <span className="text-sm font-black text-primary">R$ {total.toFixed(2)}</span>
          </div>
        </div>

        {/* Catálogo */}
        <div className="border-t border-border pt-3 space-y-2 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
            <button
              type="button"
              onClick={() => setTab("procedimentos")}
              className={`flex-1 text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
                tab === "procedimentos"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Procedimentos
            </button>
            <button
              type="button"
              onClick={() => setTab("produtos")}
              className={`flex-1 text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
                tab === "produtos"
                  ? "bg-background text-primary shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              Produtos
            </button>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="h-8 text-xs"
          />
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {filteredList.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">
                Nada encontrado.
              </p>
            ) : (
              filteredList.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  disabled={busyId === it.id}
                  onClick={() => handleAdd(it, tab === "produtos")}
                  className="w-full flex items-center justify-between rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 px-3 py-2 transition-colors disabled:opacity-60"
                >
                  <span className="text-xs font-medium text-left truncate">{it.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold">R$ {Number(it.price).toFixed(2)}</span>
                    {busyId === it.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-primary" />
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full">
            <X className="h-3.5 w-3.5 mr-1" /> Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddToComandaModal;
