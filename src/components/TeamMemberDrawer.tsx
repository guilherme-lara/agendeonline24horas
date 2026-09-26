import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, KeyRound, CalendarClock, Palmtree, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

export default function TeamMemberDrawer({
  open,
  onClose,
  barber,
  barbershopId,
}: {
  open: boolean;
  onClose: () => void;
  barber: any;
  barbershopId: string;
}) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [timeOffs, setTimeOffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Password reset state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const fetchSchedules = async () => {
    if (!barber?.id) return;
    setLoading(true);
    const { data: schedData } = await supabase
      .from("professional_schedules")
      .select("*")
      .eq("barber_id", barber.id)
      .order("day_of_week");
    
    // Fill missing days with default
    const filledSchedules = Array.from({ length: 7 }).map((_, i) => {
      const existing = schedData?.find((s) => s.day_of_week === i);
      return existing || { day_of_week: i, is_working: false, start_time: "08:00", end_time: "18:00" };
    });
    setSchedules(filledSchedules);

    const { data: offData } = await supabase
      .from("professional_time_offs")
      .select("*")
      .eq("barber_id", barber.id)
      .order("start_date", { ascending: false });
    
    setTimeOffs(offData || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open && barber) {
      fetchSchedules();
    }
  }, [open, barber]);

  const updateSchedule = async (dayOfWeek: number, field: string, value: any) => {
    const updated = schedules.map(s => s.day_of_week === dayOfWeek ? { ...s, [field]: value } : s);
    setSchedules(updated);
    
    // Save to DB
    const sched = updated.find(s => s.day_of_week === dayOfWeek);
    await supabase.from("professional_schedules").upsert({
      barber_id: barber.id,
      day_of_week: dayOfWeek,
      is_working: sched.is_working,
      start_time: sched.start_time,
      end_time: sched.end_time,
    }, { onConflict: 'barber_id, day_of_week' });
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: {
          user_id: barber.user_id,
          new_password: newPassword,
          barbershop_id: barbershopId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Senha redefinida com sucesso!");
      setResetModalOpen(false);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir a senha");
    } finally {
      setResetting(false);
    }
  };

  const addTimeOff = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const startDate = formData.get("start_date") as string;
    const endDate = formData.get("end_date") as string;
    const reason = formData.get("reason") as string;

    if (!startDate || !endDate) return;

    const { error } = await supabase.from("professional_time_offs").insert({
      barber_id: barber.id,
      start_date: startDate,
      end_date: endDate,
      reason,
    });

    if (error) {
      toast.error("Erro ao adicionar folga");
    } else {
      toast.success("Folga adicionada");
      fetchSchedules();
      (e.target as HTMLFormElement).reset();
    }
  };

  const removeTimeOff = async (id: string) => {
    await supabase.from("professional_time_offs").delete().eq("id", id);
    fetchSchedules();
  };

  const daysOfWeek = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

  if (!barber) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Gerenciar Profissional</DialogTitle>
            <DialogDescription>{barber.name}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Tabs defaultValue="schedule">
              <TabsList className="w-full grid grid-cols-3 mb-4">
                <TabsTrigger value="schedule"><CalendarClock className="h-4 w-4 mr-2" /> Escala</TabsTrigger>
                <TabsTrigger value="timeoff"><Palmtree className="h-4 w-4 mr-2" /> Folgas</TabsTrigger>
                <TabsTrigger value="security"><KeyRound className="h-4 w-4 mr-2" /> Acesso</TabsTrigger>
              </TabsList>

              <TabsContent value="schedule" className="space-y-4">
                {loading ? <Loader2 className="mx-auto animate-spin" /> : (
                  <div className="space-y-3">
                    {schedules.map((s) => (
                      <div key={s.day_of_week} className="flex items-center justify-between p-3 border rounded-xl bg-card">
                        <div className="flex items-center gap-3 w-1/3">
                          <Switch 
                            checked={s.is_working} 
                            onCheckedChange={(c) => updateSchedule(s.day_of_week, 'is_working', c)} 
                          />
                          <Label className="font-bold">{daysOfWeek[s.day_of_week]}</Label>
                        </div>
                        {s.is_working ? (
                          <div className="flex items-center gap-2">
                            <Input 
                              type="time" 
                              value={s.start_time.slice(0,5)} 
                              onChange={(e) => updateSchedule(s.day_of_week, 'start_time', e.target.value)}
                              className="h-8 w-24 text-xs" 
                            />
                            <span>até</span>
                            <Input 
                              type="time" 
                              value={s.end_time.slice(0,5)} 
                              onChange={(e) => updateSchedule(s.day_of_week, 'end_time', e.target.value)}
                              className="h-8 w-24 text-xs" 
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic mr-4">Folga</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timeoff" className="space-y-6">
                <form onSubmit={addTimeOff} className="space-y-3 border p-4 rounded-xl bg-secondary/20">
                  <h3 className="text-sm font-bold">Registrar Nova Exceção (Férias/Atestado)</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Data Início</Label>
                      <Input type="date" name="start_date" required className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data Fim</Label>
                      <Input type="date" name="end_date" required className="h-9" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Motivo</Label>
                    <Input name="reason" placeholder="Ex: Férias, Atestado Médico..." className="h-9" />
                  </div>
                  <Button type="submit" size="sm" className="w-full">Adicionar Exceção</Button>
                </form>

                <div className="space-y-2">
                  <h3 className="text-sm font-bold">Histórico de Folgas</h3>
                  {timeOffs.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma folga registrada.</p>}
                  {timeOffs.map(off => (
                    <div key={off.id} className="flex items-center justify-between p-3 border rounded-xl">
                      <div>
                        <p className="text-sm font-bold">{format(new Date(off.start_date), "dd/MM/yyyy")} a {format(new Date(off.end_date), "dd/MM/yyyy")}</p>
                        <p className="text-xs text-muted-foreground">{off.reason || "Sem motivo informado"}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeTimeOff(off.id)} className="text-red-500 hover:text-red-600">Remover</Button>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <div className="border border-red-500/20 bg-red-500/5 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-red-500 font-bold">
                    <ShieldAlert className="h-5 w-5" />
                    <h3>Segurança da Conta</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Caso o profissional tenha esquecido a senha, você pode forçar uma redefinição aqui. Isso desconectará todos os dispositivos atuais.
                  </p>
                  <Button 
                    variant="destructive" 
                    className="w-full" 
                    disabled={!barber.user_id}
                    onClick={() => setResetModalOpen(true)}
                  >
                    <KeyRound className="h-4 w-4 mr-2" />
                    Redefinir Senha de Acesso
                  </Button>
                  {!barber.user_id && (
                    <p className="text-[10px] text-red-400 text-center mt-1">Este profissional ainda não possui acesso ao sistema vinculado.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
           <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Digite a nova senha temporária para <strong>{barber.name}</strong>. O profissional poderá alterá-la depois.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Nova Senha (Mínimo 6 caracteres)</Label>
            <Input 
              type="password" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
              placeholder="******"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleResetPassword} disabled={resetting || newPassword.length < 6}>
              {resetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Redefinição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
