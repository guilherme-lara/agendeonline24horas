import { useState, useEffect, useMemo } from "react";
import { Package, Plus, Minus, Loader2, AlertTriangle, CheckCircle2, XCircle, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  min_quantity: number;
  cost_price: number;
  sell_price: number;
  category: string;
  active: boolean;
}

interface InventoryTabProps {
  barbershopId: string;
}

const statusIcon = (item: InventoryItem) => {
  if (item.quantity <= 0) return <XCircle className="h-4 w-4 text-destructive" />;
  if (item.quantity <= item.min_quantity) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
};

const statusLabel = (item: InventoryItem) => {
  if (item.quantity <= 0) return "Esgotado";
  if (item.quantity <= item.min_quantity) return "Estoque Baixo";
  return "OK";
};

const statusBg = (item: InventoryItem) => {
  if (item.quantity <= 0) return "border-destructive/20 bg-destructive/5";
  if (item.quantity <= item.min_quantity) return "border-yellow-500/20 bg-yellow-500/5";
  return "border-border bg-card hover:border-border/80 transition-colors";
};

const InventoryTab = ({ barbershopId }: InventoryTabProps) => {
  const { toast } = useToast();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<"entry" | "exit">("entry");
  const [movementQty, setMovementQty] = useState("1");
  const [movementNotes, setMovementNotes] = useState("");
  const [saving, setSaving] = useState(false);
  
  // States para Filtro e Busca
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [searchQuery, setSearchQuery] = useState("");

  // Add form states
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("10");
  const [newMin, setNewMin] = useState("5");
  const [newCost, setNewCost] = useState("0");
  const [newSell, setNewSell] = useState("0");
  const [newCategory, setNewCategory] = useState("Geral");

  const fetchItems = async () => {
    const { data } = await supabase
      .from("inventory")
      .select("*")
      .eq("barbershop_id", barbershopId)
      .eq("active", true)
      .order("name");
    
    setItems((data as InventoryItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [barbershopId]);

  // Extração dinâmica de categorias únicas do banco
  const categories = useMemo(() => {
    const uniqueCats = new Set(items.map(item => item.category || "Geral"));
    return ["Todas", ...Array.from(uniqueCats).sort()];
  }, [items]);

  // Aplicação do Filtro e Busca
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesCategory = selectedCategory === "Todas" || item.category === selectedCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  const handleAddItem = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("inventory").insert({
      barbershop_id: barbershopId,
      name: newName.trim(),
      quantity: parseInt(newQty) || 0,
      min_quantity: parseInt(newMin) || 5,
      cost_price: parseFloat(newCost) || 0,
      sell_price: parseFloat(newSell) || 0,
      category: newCategory.trim() || "Geral",
    });
    
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Produto adicionado com sucesso!" });
      setNewName(""); setNewQty("10"); setNewMin("5"); setNewCost("0"); setNewSell("0"); setNewCategory("Geral");
      setShowAdd(false);
      fetchItems();
    }
    setSaving(false);
  };

  const handleMovement = async () => {
    if (!movementItem) return;
    const qty = parseInt(movementQty) || 0;
    if (qty <= 0) return;
    if (movementType === "exit" && qty > movementItem.quantity) {
      toast({ title: "Erro", description: "Quantidade de saída maior que o estoque disponível.", variant: "destructive" });
      return;
    }
    
    setSaving(true);
    const newQuantity = movementType === "entry" ? movementItem.quantity + qty : movementItem.quantity - qty;

    const [movRes, updRes] = await Promise.all([
      supabase.from("stock_movements").insert({
        barbershop_id: barbershopId,
        inventory_id: movementItem.id,
        type: movementType,
        quantity: qty,
        notes: movementNotes.trim(),
      }),
      supabase.from("inventory")
        .update({ quantity: newQuantity })
        .eq("id", movementItem.id)
        .eq("barbershop_id", barbershopId),
    ]);

    if (movRes.error || updRes.error) {
      toast({ title: "Erro na movimentação", description: (movRes.error || updRes.error)?.message, variant: "destructive" });
    } else {
      toast({ title: movementType === "entry" ? "Entrada registrada!" : "Saída registrada!" });
      setMovementItem(null);
      setMovementQty("1");
      setMovementNotes("");
      fetchItems();
    }
    setSaving(false);
  };

  const lowStockCount = items.filter((i) => i.quantity <= i.min_quantity).length;

  return (
    <div className="space-y-6">
      
      {/* HEADER E AÇÕES */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Estoque de Produtos</h2>
            {lowStockCount > 0 ? (
              <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-600 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {lowStockCount} item(s) com alerta
              </span>
            ) : (
              <p className="text-xs text-muted-foreground">Gerencie suas mercadorias</p>
            )}
          </div>
        </div>
        <Button size="sm" className="h-10 rounded-xl font-semibold w-full sm:w-auto shadow-sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Produto
        </Button>
      </div>

      {/* BARRA DE FILTROS E BUSCA */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-secondary/30 p-3 rounded-2xl border border-border/50">
        
        {/* Input de Busca */}
        <div className="relative w-full md:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar produto..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-background border-border rounded-xl text-sm"
          />
        </div>

        {/* Scroll Horizontal de Categorias */}
        <div className="w-full overflow-x-auto no-scrollbar pb-1">
          <div className="flex items-center gap-2 min-w-max">
            {categories.map((cat) => (
              <Badge 
                key={cat} 
                variant={selectedCategory === cat ? "default" : "secondary"}
                className={`cursor-pointer px-4 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
                  selectedCategory === cat 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "bg-background text-muted-foreground border border-border/60 hover:border-primary/30 hover:text-foreground"
                }`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* LISTAGEM DE PRODUTOS */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Carregando estoque...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16 bg-secondary/20 rounded-2xl border border-dashed border-border/60">
          <Package className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-base font-semibold text-foreground">Nenhum produto encontrado.</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1">
            {searchQuery || selectedCategory !== "Todas" 
              ? "Tente limpar os filtros de busca ou categoria."
              : "Você ainda não possui itens no estoque."}
          </p>
          {(!searchQuery && selectedCategory === "Todas") && (
            <Button variant="outline" className="mt-6 rounded-xl font-semibold" onClick={() => setShowAdd(true)}>
              Cadastrar Primeiro Produto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredItems.map((item) => (
            <div key={item.id} className={`flex flex-col justify-between rounded-xl border p-4 shadow-sm ${statusBg(item)}`}>
              
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 pr-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold mb-2 bg-background/50">
                    {item.category || "Geral"}
                  </Badge>
                  <p className="font-bold text-sm text-foreground truncate" title={item.name}>{item.name}</p>
                </div>
                {statusIcon(item)}
              </div>

              <div className="flex items-end justify-between mt-auto pt-4 border-t border-border/40">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Estoque</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-black text-foreground">{item.quantity}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold">/ Mín {item.min_quantity}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-lg border border-border/50">
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/15"
                    onClick={() => { setMovementItem(item); setMovementType("entry"); }}
                    title="Adicionar Estoque"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <div className="h-4 w-px bg-border/60 mx-0.5"></div>
                  <Button
                    variant="ghost" size="icon"
                    className="h-8 w-8 rounded-md text-destructive hover:text-destructive hover:bg-destructive/15"
                    onClick={() => { setMovementItem(item); setMovementType("exit"); }}
                    title="Baixar Estoque"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DIALOG DE NOVO PRODUTO */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-card border-border shadow-elev-3 rounded-2xl p-6 sm:max-w-md">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold font-display">Cadastrar Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Nome do Produto</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Shampoo Revitalizante 300ml" className="bg-background border-border h-11" maxLength={100} />
            </div>
            
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Categoria</label>
              <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Ex: Capilar, Skincare, Bebidas" className="bg-background border-border h-11" maxLength={50} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Qtd. Inicial</label>
                <Input type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} className="bg-background border-border h-11" min="0" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Alerta (Qtd. Mínima)</label>
                <Input type="number" value={newMin} onChange={(e) => setNewMin(e.target.value)} className="bg-background border-border h-11" min="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Preço de Custo (R$)</label>
                <Input type="number" value={newCost} onChange={(e) => setNewCost(e.target.value)} className="bg-background border-border h-11" min="0" step="0.01" />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Preço de Venda (R$)</label>
                <Input type="number" value={newSell} onChange={(e) => setNewSell(e.target.value)} className="bg-background border-border h-11" min="0" step="0.01" />
              </div>
            </div>

            <Button onClick={handleAddItem} disabled={saving || !newName.trim()} className="w-full h-12 mt-2 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 shadow-sm">
              {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
              Salvar Produto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG DE MOVIMENTAÇÃO (ENTRADA/SAÍDA) */}
      <Dialog open={!!movementItem} onOpenChange={() => setMovementItem(null)}>
        <DialogContent className="bg-card border-border shadow-elev-3 rounded-2xl p-6 sm:max-w-sm">
          <DialogHeader className="mb-2">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold font-display">
              {movementType === "entry" ? (
                <><Plus className="h-5 w-5 text-emerald-500" /> Entrada de Estoque</>
              ) : (
                <><Minus className="h-5 w-5 text-destructive" /> Saída de Estoque</>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mb-6 p-3 bg-secondary/40 rounded-xl border border-border/50">
            <p className="text-sm font-semibold text-foreground truncate">{movementItem?.name}</p>
            <p className="text-xs text-muted-foreground mt-1">Saldo atual: <strong className="text-foreground">{movementItem?.quantity} un.</strong></p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Quantidade a movimentar</label>
              <Input type="number" value={movementQty} onChange={(e) => setMovementQty(e.target.value)} className="bg-background border-border h-12 text-lg font-bold text-center" min="1" />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Motivo (Opcional)</label>
              <Input value={movementNotes} onChange={(e) => setMovementNotes(e.target.value)} placeholder="Ex: Ajuste, Quebra, Compra NFe" className="bg-background border-border h-11 text-sm" maxLength={200} />
            </div>
            
            <Button
              onClick={handleMovement}
              disabled={saving || !movementQty}
              className={`w-full h-12 font-bold rounded-xl shadow-sm ${
                movementType === "entry"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }`}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Confirmar {movementType === "entry" ? "Entrada" : "Saída"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryTab;