import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBarbershop } from "@/hooks/useBarbershop";
import { Loader2, AlertTriangle, UserSearch, RefreshCw, MessageSquare, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Customer {
  id: string;
  name: string;
  phone: string;
  birth_date: string | null;
  last_seen: string | null;
  appointment_count: number;
}

const PAGE_SIZE = 10;

const Clientes = () => {
  const { barbershop } = useBarbershop();
  const queryClient = useQueryClient();
  const queryEnabled = !!barbershop?.id;

  const [currentPage, setCurrentPage] = useState(1);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirth, setEditBirth] = useState("");

  const {
    data: customers = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<Customer[]>({
    queryKey: ["customers", barbershop?.id],
    queryFn: async () => {
      if (!barbershop?.id) return [];
      const { data, error } = await supabase.rpc("get_customers_with_stats", {
        _barbershop_id: barbershop.id,
      });
      if (error) {
        console.error("Erro ao buscar clientes com estatísticas:", error);
        throw new Error(error.message);
      }
      return data || [];
    },
    enabled: queryEnabled,
  });

  const totalPages = Math.ceil(customers.length / PAGE_SIZE);
  const paginated = customers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  const handleEditOpen = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditName(customer.name);
    setEditPhone(customer.phone);
    setEditBirth(customer.birth_date ? customer.birth_date.slice(0, 10) : "");
  };

  const handleEditClose = () => {
    setEditingCustomer(null);
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, phone, birth_date }: { id: string; name: string; phone: string; birth_date: string | null }) => {
      const { error } = await supabase
        .from("customers")
        .update({ name, phone, birth_date: birth_date || null })
        .eq("id", id)
        .eq("barbershop_id", barbershop!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", barbershop?.id] });
      setEditingCustomer(null);
    },
    onError: (err) => {
      console.error("Erro ao atualizar cliente:", err);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id)
        .eq("barbershop_id", barbershop!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers", barbershop?.id] });
      setDeleteCustomerId(null);
      if (paginated.length === 1 && currentPage > 1) {
        setCurrentPage((p) => p - 1);
      }
    },
    onError: (err) => {
      console.error("Erro ao excluir cliente:", err);
    },
  });

  if (isLoading && queryEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground animate-pulse uppercase tracking-widest font-bold">Buscando Clientes...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in px-6">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <h2 className="text-xl font-bold text-foreground mb-2">Erro de Sincronização</h2>
        <p className="text-sm text-muted-foreground mb-8">Não conseguimos carregar sua lista de clientes.</p>
        <Button onClick={() => refetch()} className="gold-gradient text-primary-foreground px-8 font-bold">
          <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-foreground flex items-center gap-3 tracking-tight font-display">
          <UserSearch className="h-8 w-8 text-primary" /> Carteira de Clientes
        </h1>
        <p className="text-muted-foreground text-sm mt-1 font-medium">Gerencie seus clientes e veja o histórico de agendamentos.</p>
      </div>

      {customers.length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-16 text-center shadow-card">
          <div className="bg-background w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-border">
            <UserSearch className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Nenhum cliente cadastrado</h3>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Sua carteira de clientes será preenchida automaticamente a cada novo agendamento online.</p>
        </div>
      ) : (
        <div className="bg-card border-border rounded-3xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/30">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Cliente</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Contagem</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">Última Visita</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated.map((customer) => (
                  <tr key={customer.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-foreground">{customer.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{formatPhoneNumber(customer.phone)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant="outline" className="font-mono text-xs">
                        {customer.appointment_count} {customer.appointment_count === 1 ? 'agendamento' : 'agendamentos'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {customer.last_seen ? (
                        <>
                          <div className="text-foreground text-xs font-medium capitalize">
                            {formatDistanceToNow(new Date(customer.last_seen), { addSuffix: true, locale: ptBR })}
                          </div>
                          <div className="text-muted-foreground text-[10px] uppercase tracking-tighter">
                            {format(new Date(customer.last_seen), 'dd/MM/yyyy')}
                          </div>
                        </>
                      ) : (
                        <div className="text-muted-foreground text-xs">Sem agendamentos</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-blue-500/30 bg-blue-900/40 text-blue-400 hover:bg-blue-900/80 hover:text-blue-300"
                          onClick={() => handleEditOpen(customer)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 border-red-500/30 bg-red-900/40 text-red-400 hover:bg-red-900/80 hover:text-red-300"
                          onClick={() => setDeleteCustomerId(customer.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="border-emerald-500/30 bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/80 hover:text-emerald-300"
                        >
                          <a href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">
                            <MessageSquare className="h-4 w-4 mr-2" /> Conversar
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-secondary/20">
              <p className="text-xs text-muted-foreground">
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, customers.length)} de {customers.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                {(() => {
                  let pagesToShow: number[];
                  if (totalPages <= 5) {
                    pagesToShow = Array.from({ length: totalPages }, (_, idx) => idx + 1);
                  } else if (currentPage <= 3) {
                    pagesToShow = [1, 2, 3, 4, 5];
                  } else if (currentPage >= totalPages - 2) {
                    pagesToShow = [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
                  } else {
                    pagesToShow = [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
                  }
                  return pagesToShow.map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={currentPage === page ? "border-primary text-primary font-bold" : ""}
                    >
                      {page}
                    </Button>
                  ));
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && handleEditClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Telefone</Label>
              <Input
                id="edit-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-birth">Data de Nascimento</Label>
              <Input
                id="edit-birth"
                type="date"
                value={editBirth}
                onChange={(e) => setEditBirth(e.target.value)}
                disabled={updateMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleEditClose} disabled={updateMutation.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (!editingCustomer) return;
                updateMutation.mutate({ id: editingCustomer.id, name: editName, phone: editPhone, birth_date: editBirth || null });
              }}
              disabled={updateMutation.isPending || !editName.trim()}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCustomerId} onOpenChange={(open) => !open && setDeleteCustomerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteCustomerId) deleteMutation.mutate(deleteCustomerId);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Clientes;
