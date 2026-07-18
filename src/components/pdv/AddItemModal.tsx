import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
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
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [barberId, setBarberId] = useState<string>("none");

  const { data: professionals } = useQuery({
    queryKey: ["professionals", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      // Assuming a barbers table exists based on previous codebase knowledge
      const { data } = await supabase
        .from("barbers")
        .select("id, name")
        .eq("barbershop_id", clinic.id);
      return data || [];
    },
    enabled: !!clinic?.id
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(price.replace(",", "."));
    const q = parseInt(quantity, 10);
    
    if (!name || isNaN(p) || isNaN(q) || q <= 0 || p < 0) return;

    let barber_name;
    if (barberId !== "none" && professionals) {
      barber_name = professionals.find(p => p.id === barberId)?.name;
    }

    onAdd({
      item_type: type,
      name,
      unit_price: p,
      quantity: q,
      barber_id: barberId !== "none" ? barberId : undefined,
      barber_name
    });

    // reset
    setName("");
    setPrice("");
    setQuantity("1");
    setBarberId("none");
    onOpenChange(false);
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
              <Select value={type} onValueChange={(v: any) => setType(v)}>
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
              <Select value={barberId} onValueChange={setBarberId}>
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
            <label className="text-sm font-medium">Descrição / Nome</label>
            <Input 
              required 
              placeholder={type === "service" ? "Ex: Limpeza de Pele" : "Ex: Creme Hidratante"}
              value={name} 
              onChange={e => setName(e.target.value)} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Preço Unitário (R$)</label>
              <Input 
                required 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={price} 
                onChange={e => setPrice(e.target.value)} 
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

          <Button type="submit" className="w-full mt-2">
            <Plus className="w-4 h-4 mr-2" />
            Adicionar à Comanda
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
