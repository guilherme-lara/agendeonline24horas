import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Tag } from "lucide-react";
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
  
  // Category filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");

  // Selected item ID
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
          .select("id, name, price, category")
          .eq("barbershop_id", clinic.id)
          .eq("active", true)
          .order("name"),
        (supabase.from("inventory") as any)
          .select("id, name, sell_price, quantity, category")
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

  // Base list of items based on selected type
  const availableItems = useMemo(() => {
    if (!catalog) return [];
    return type === "service" ? catalog.services : catalog.products;
  }, [catalog, type]);

  // Unique categories extracted dynamically
  const categories = useMemo(() => {
    const rawCategories = availableItems.map((i: any) => (i.category ? String(i.category).trim() : "Geral"));
    const uniqueSorted = Array.from(new Set(rawCategories)).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return ["Todas", ...uniqueSorted];
  }, [availableItems]);

  // Items filtered by category
  const filteredItems = useMemo(() => {
    if (selectedCategory === "Todas") {
      return availableItems;
    }
    return availableItems.filter((i: any) => {
      const itemCat = i.category ? String(i.category).trim() : "Geral";
      return itemCat === selectedCategory;
    });
    
  }, [availableItems, selectedCategory]);

  const selectedItemData = useMemo(() => {
    return availableItems.find((i: any) => i.id === selectedItemId);
  }, [availableItems, selectedItemId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = parseInt(quantity, 10);
    
    if (!selectedItemData || isNaN(q) || q <= 0) return;

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

    // Reset form
    setSelectedItemId("");
    setSelectedCategory("Todas");
    setQuantity("1");
    setBarberId("none");
    onOpenChange(false);
  };

  // Rule 6: Changing Type resets category to "Todas" and clears selected item
  const handleTypeChange = (newType: "product" | "service") => {
    setType(newType);
    setSelectedCategory("Todas");
    setSelectedItemId("");
  };

  // Changing Category updates filter and clears item if it does not belong
  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    if (cat !== "Todas") {
      const itemBelongs = availableItems.some((i: any) => {
        const itemCat = i.category ? String(i.category).trim() : "Geral";
        return i.id === selectedItemId && itemCat === cat;
      });
      if (!itemBelongs) {
        setSelectedItemId("");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        setSelectedItemId("");
        setSelectedCategory("Todas");
        setQuantity("1");
        setBarberId("none");
      }
      onOpenChange(v);
    }}>
      <DialogContent className="sm:max-w-lg border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Adicionar Item Avulso</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Row 1: Tipo & Profissional */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tipo</label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger className="bg-background h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Serviço</SelectItem>
                  <SelectItem value="product">Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profissional</label>
              <Select value={barberId} onValueChange={setBarberId} disabled={type === "product"}>
                <SelectTrigger className="bg-background h-10">
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

          {/* Row 2: Filtrar por Categoria (Cascade Filter) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-primary" />
                Filtrar por Categoria
              </label>
              <span className="text-[11px] text-muted-foreground">
                {categories.length > 1 ? `${categories.length - 1} categoria(s)` : "Geral"}
              </span>
            </div>
            <Select value={selectedCategory} onValueChange={handleCategoryChange}>
              <SelectTrigger className="bg-background h-10">
                <SelectValue placeholder="Todas as Categorias" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "Todas" ? `Todas as Categorias (${availableItems.length})` : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 3: Selecionar Item (Filtered by category) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Selecionar {type === "service" ? "Serviço" : "Produto"}
              </label>
              <span className="text-[11px] text-muted-foreground">
                {filteredItems.length} {filteredItems.length === 1 ? "disponível" : "disponíveis"}
              </span>
            </div>
            <Select value={selectedItemId} onValueChange={setSelectedItemId} required>
              <SelectTrigger className="bg-background h-10">
                <SelectValue placeholder={loadingCatalog ? "Carregando catálogo..." : `Escolha um ${type === "service" ? "serviço" : "produto"}...`} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {filteredItems.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum {type === "service" ? "serviço" : "produto"} encontrado nesta categoria.
                  </div>
                ) : (
                  filteredItems.map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} - R$ {Number(type === "service" ? item.price : item.sell_price).toFixed(2).replace(".", ",")}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Row 4: Preço Unitário & Quantidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 opacity-80">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preço Unitário (R$)</label>
              <Input 
                disabled 
                value={selectedItemData ? Number(type === "service" ? selectedItemData.price : selectedItemData.sell_price).toFixed(2).replace(".", ",") : "0,00"} 
                className="bg-muted/50 font-mono font-bold h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quantidade</label>
              <Input 
                required 
                type="number" 
                min="1" 
                value={quantity} 
                onChange={e => setQuantity(e.target.value)} 
                className="h-10 font-bold bg-background"
              />
            </div>
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full h-11 text-sm font-bold shadow-xs gap-2 mt-2" 
            disabled={!selectedItemId}
          >
            <Plus className="w-4 h-4" />
            Adicionar à Comanda
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
