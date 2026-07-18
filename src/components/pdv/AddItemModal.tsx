import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/hooks/useClinic";

interface AddItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: {
    item_type: "product" | "service";
    name: string;
    quantity: number;
    unit_price: number;
    barber_id?: string;
    barber_name?: string;
  }) => void;
}

export function AddItemModal({ open, onOpenChange, onAdd }: AddItemModalProps) {
  const { clinic } = useClinic() as any;
  const [type, setType] = useState<"product" | "service">("service");
  
  // selectedItemId holds the ID of the selected service or product
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [barberId, setBarberId] = useState<string>("none");

  const { data: professionals } = useQuery({
    queryKey: ["professionals", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("barbershop_id", clinic.id);
      return data || [];
    },
    enabled: !!clinic?.id
  });

  const { data: catalog, isLoading: loadingCatalog } = useQuery({
    queryKey: ["pdv-catalog", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return { services: [], products: [] };
      
      const [servicesRes, inventoryRes] = await Promise.all([
        supabase
          .from("services")
          .select("id, name, price")
          .eq("barbershop_id", clinic.id)
          .eq("active", true)
          .order("name"),
        (supabase.from("inventory") as any)
          .select("id, name, sell_price, quantity")
          .eq("barbershop_id", clinic.id)
          .eq("active", true)
          .order("name")
      ]);

      return {
        services: servicesRes.data || [],
        products: inventoryRes.data || []
      };
    },
    enabled: !!clinic?.id
  });

  const currentList = useMemo(() => {
    if (!catalog) return [];
    return type === "service" ? catalog.services : catalog.products;
  }, [catalog, type]);

  const selectedItemData = useMemo(() => {
    return currentList.find((i: any) => i.id === selectedItemId);
  }, [currentList, selectedItemId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(quantity, 10);
    
    if (!selectedItemData || isNaN(q) || q <= 0) return;

    // Price depends on the table structure (price for services, sell_price for products)
    const unitPrice = type === "service" ? selectedItemData.price : selectedItemData.sell_price;

    let barber_name;
    if (barberId !== "none" && professionals) {
      barber_name = professionals.find(p => p.id === barberId)?.name;
    }

    onAdd({
      item_type: type,
      name: selectedItemData.name,
      unit_price: Number(unitPrice) || 0,
      quantity: q,
      barber_id: barberId !== "none" ? barberId : undefined,
      barber_name
    });

    // reset
    setSelectedItemId("");
    setQuantity("1");
    setBarberId("none");
    onOpenChange(false);
  };

  const handleTypeChange = (newType: "product" | "service") => {
    setType(newType);
    setSelectedItemId("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Item Avulso</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Serviço</SelectItem>
                  <SelectItem value="product">Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Profissional (Opcional)</label>
              <Select value={barberId} onValueChange={setBarberId} disabled={type === "product"}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum / Não aplicável</SelectItem>
                  {professionals?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Selecionar {type === "service" ? "Serviço" : "Produto"}</label>
            <Select value={selectedItemId} onValueChange={setSelectedItemId} required>
              <SelectTrigger>
                <SelectValue placeholder={loadingCatalog ? "Carregando..." : `Escolha um ${type === "service" ? "serviço" : "produto"}`} />
              </SelectTrigger>
              <SelectContent>
                {currentList.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">Nenhum item encontrado.</div>
                ) : (
                    currentList.map((item: any) => (
                        <SelectItem key={item.id} value={item.id}>
                            {item.name} - R$ {Number(type === "service" ? item.price : item.sell_price).toFixed(2).replace(".", ",")}
                        </SelectItem>
                    ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 opacity-60">
              <label className="text-sm font-medium">Preço Unitário (R$)</label>
              <Input 
                disabled 
                value={selectedItemData ? Number(type === "service" ? selectedItemData.price : selectedItemData.sell_price).toFixed(2).replace(".", ",") : "0,00"} 
                className="bg-secondary/50 font-mono font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Quantidade</label>
              <Input 
                required 
                type="number" 
                min="1" 
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
              />
            </div>
          </div>

          <Button type="submit" className="w-full mt-2" disabled={!selectedItemId}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar à Comanda
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
