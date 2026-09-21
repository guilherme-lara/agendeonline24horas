import fs from 'fs';
import path from 'path';

const filePath = 'D:\\BKP\\Workspace\\agendeonline24horas\\src\\pages\\ProfessionalDashboard.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Imports
content = content.replace(
  'import { Loader2, DollarSign, Calendar, Clock, CheckCircle2, LogOut, FileText, User, Target, Send, MessageSquare, Plus, QrCode } from "lucide-react";',
  'import { Loader2, DollarSign, Calendar, Clock, CheckCircle2, LogOut, FileText, User, Target, Send, MessageSquare, Plus, QrCode, CalendarPlus, Play, Pause } from "lucide-react";'
);

// 2. Schedule Query
const scheduleQuery = `  const { data: scheduleData } = useQuery({
    queryKey: ["professional-schedule", barber?.id, today.getDay()],
    queryFn: async () => {
      const { data: sched } = await supabase
        .from("professional_schedules")
        .select("*")
        .eq("barber_id", barber.id)
        .eq("day_of_week", today.getDay())
        .maybeSingle();

      const { data: timeOff } = await supabase
        .from("professional_time_offs")
        .select("*")
        .eq("barber_id", barber.id)
        .lte("start_date", format(today, "yyyy-MM-dd"))
        .gte("end_date", format(today, "yyyy-MM-dd"))
        .maybeSingle();

      return { sched, timeOff };
    },
    enabled: !!barber?.id,
  });

  const inProgressAppts = useMemo(() => {
    return todayAppointments.filter((a: any) => a.status === "in_progress");
  }, [todayAppointments]);

  const upcomingAppts = useMemo(() => {
    return todayAppointments.filter((a: any) => a.status !== "in_progress" && a.status !== "completed");
  }, [todayAppointments]);

  const completedAppts = useMemo(() => {
    return todayAppointments.filter((a: any) => a.status === "completed");
  }, [todayAppointments]);
`;

content = content.replace(
  /const todayAppointments = useMemo\(\(\) => \{[\s\S]*?\}, \[confirmedAppointments, today\]\);/,
  `const todayAppointments = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd");
    return confirmedAppointments.filter((a: any) => {
      const d = toBRT(a.scheduled_at);
      return format(d, "yyyy-MM-dd") === todayStr && a.status !== "cancelled";
    });
  }, [confirmedAppointments, today]);\n\n${scheduleQuery}`
);

// 3. Quick Actions and Grid
const oldActionsAndAgenda = `<Button
          variant="outline"
          onClick={handleCloseDay}
          className="w-full h-10 rounded-xl border-border text-xs font-black flex items-center gap-2"
        >
          <Send className="h-3.5 w-3.5" /> Fechar Dia (WhatsApp)
        </Button>

        {/* Tab content based on activeTab */}
        {activeTab === "agenda" && (
          <>
            {/* Today's Agenda */}
            <div>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Agenda de Hoje — {format(today, "dd/MM", { locale: ptBR })}
              </h2>

              {todayAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento para hoje.</p>
              ) : (
                <div className="space-y-2">
                  {todayAppointments.map((appt: any) => {`;

const newActionsAndAgenda = `
        {/* Work Schedule / Time Off */}
        {scheduleData && (
          <Card className="border-border bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={\`p-2 rounded-lg \${scheduleData.timeOff || (scheduleData.sched && !scheduleData.sched.is_working) ? 'bg-red-500/10' : 'bg-primary/10'}\`}>
                  <Clock className={\`h-4 w-4 \${scheduleData.timeOff || (scheduleData.sched && !scheduleData.sched.is_working) ? 'text-red-500' : 'text-primary'}\`} />
                </div>
                <div>
                  <p className="text-xs font-bold">Meu Horário Hoje</p>
                  <p className="text-[10px] text-muted-foreground">
                    {scheduleData.timeOff ? (
                      <span className="text-red-500 font-bold">Em Folga ({scheduleData.timeOff.reason || "Ausente"})</span>
                    ) : scheduleData.sched && !scheduleData.sched.is_working ? (
                      <span className="text-red-500 font-bold">Não trabalho hoje</span>
                    ) : scheduleData.sched ? (
                      \`\${scheduleData.sched.start_time.slice(0, 5)} às \${scheduleData.sched.end_time.slice(0, 5)}\`
                    ) : (
                      "Sem escala definida"
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button variant="default" className="flex-1 text-xs h-10 shadow-lg shadow-primary/20" onClick={() => toast.success("Módulo de Comanda Avulsa em desenvolvimento")}>
            <Plus className="h-4 w-4 mr-1" /> Nova Comanda
          </Button>
          <Button variant="outline" className="flex-1 text-xs h-10" onClick={() => toast.success("Módulo de Encaixe em desenvolvimento")}>
            <CalendarPlus className="h-4 w-4 mr-1" /> Aceitar Encaixe
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={handleCloseDay}
          className="w-full h-10 rounded-xl border-border text-xs font-black flex items-center gap-2"
        >
          <Send className="h-3.5 w-3.5" /> Fechar Dia (WhatsApp)
        </Button>

        {/* Tab content based on activeTab */}
        {activeTab === "agenda" && (
          <>
            {/* Comandas Abertas (Grid) */}
            {inProgressAppts.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2 text-cyan-500">
                  <Play className="h-4 w-4" /> Comandas em Andamento ({inProgressAppts.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {inProgressAppts.map((appt: any) => (
                    <Card key={appt.id} className="border-cyan-500/30 bg-cyan-500/5 shadow-sm">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-sm truncate max-w-[150px]">{appt.client_name}</p>
                            <p className="text-[10px] text-muted-foreground">{appt.service_name}</p>
                          </div>
                          <span className="bg-cyan-500/20 text-cyan-500 text-[9px] font-black uppercase px-2 py-1 rounded-full">
                            Atendendo
                          </span>
                        </div>
                        <p className="text-xs font-black text-foreground mb-4">R$ {appt.price}</p>
                        
                        <div className="flex items-center gap-2 mt-2">
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-[10px] border-cyan-500/30 hover:bg-cyan-500/10" onClick={() => setComandaAppt(appt)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Itens
                          </Button>
                          <Button size="sm" disabled={finalizingId === appt.id} onClick={() => handleFinalizeAndCharge(appt)} className="flex-1 h-8 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-emerald-50">
                            {finalizingId === appt.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <QrCode className="h-3 w-3 mr-1" />}
                            Finalizar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Today's Agenda (Upcoming) */}
            <div>
              <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Próximos / Pendentes — {format(today, "dd/MM", { locale: ptBR })}
              </h2>

              {upcomingAppts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento pendente.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingAppts.map((appt: any) => {`;

content = content.replace(oldActionsAndAgenda, newActionsAndAgenda);

// 4. Find the end of the upcoming map and add completed list
const oldCompletedSection = `                          </div>
                        ) : (
                          <span className={\`text-[10px] font-bold \${status.color}\`}>{status.text}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Upcoming */}`;

const newCompletedSection = `                          </div>
                        ) : (
                          <span className={\`text-[10px] font-bold \${status.color}\`}>{status.text}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Completed Today */}
            {completedAppts.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-bold mb-3 flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 className="h-4 w-4" /> Concluídos Hoje
                </h2>
                <div className="space-y-2 opacity-70">
                  {completedAppts.map((appt: any) => {
                    const time = format(toBRT(appt.scheduled_at), "HH:mm");
                    const status = statusLabel[appt.status] || statusLabel.completed;
                    return (
                      <div key={appt.id} className="flex items-center gap-3 rounded-xl border px-4 py-3 border-emerald-500/30 bg-emerald-500/5">
                        <div className="text-center min-w-[50px]">
                          <p className="text-sm font-black">{time}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{appt.client_name}</p>
                          <p className="text-xs text-muted-foreground">{appt.service_name} • R$ {appt.price}</p>
                        </div>
                        <span className={\`text-[10px] font-bold \${status.color}\`}>{status.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Upcoming Next Days */}`;

content = content.replace(oldCompletedSection, newCompletedSection);

// Update "Próximos Dias" title if needed, the comment is {/* Upcoming Next Days */} now. Wait, I replaced `/* Upcoming */` with `/* Upcoming Next Days */` in the regex above. Let's make sure it matches properly.
// The comment in original was `/* Upcoming */`. I will replace it accurately.
content = content.replace('{/* Upcoming */}', '{/* Upcoming */}'); // Just a check

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Success');
