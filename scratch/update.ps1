// Update script via PowerShell using Get-Content and Set-Content
$content = Get-Content -Path "D:\BKP\Workspace\agendeonline24horas\src\pages\ProfessionalDashboard.tsx" -Raw

$content = $content -replace 'import \{ Loader2, DollarSign, Calendar, Clock, CheckCircle2, LogOut, FileText, User, Target, Send, MessageSquare, Plus, QrCode \} from "lucide-react";', 'import { Loader2, DollarSign, Calendar, Clock, CheckCircle2, LogOut, FileText, User, Target, Send, MessageSquare, Plus, QrCode, CalendarPlus, Play, Pause } from "lucide-react";'

$findUseMemo = 'const todayAppointments = useMemo\(\(\) => \{[\s\S]*?\}, \[confirmedAppointments, today\]\);'
$replaceUseMemo = @'
  const { data: scheduleData } = useQuery({
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
'@
$content = $content -replace $findUseMemo, "const todayAppointments = useMemo(() => {
    const todayStr = format(today, `"yyyy-MM-dd`");
    return confirmedAppointments.filter((a: any) => {
      const d = toBRT(a.scheduled_at);
      return format(d, `"yyyy-MM-dd`") === todayStr && a.status !== `"cancelled`";
    });
  }, [confirmedAppointments, today]);

$replaceUseMemo"

$content | Set-Content -Path "D:\BKP\Workspace\agendeonline24horas\scratch\test.txt"
