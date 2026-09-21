$content = Get-Content -Path "src\hooks\useLiveAppointments.ts" -Raw

$find = '(?s)\(\) => \{\s*queryClient\.invalidateQueries'
$replace = @'
(payload) => {
          if (payload.eventType === "INSERT") {
            const newAppt = payload.new;
            if (Notification.permission === "granted") {
              const dateStr = new Date(newAppt.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
              new Notification("Novo Agendamento!", {
                body: `${newAppt.client_name || "Cliente"} agendou ${newAppt.service_name} às ${dateStr} com ${newAppt.barber_name || "a equipe"}.`,
                icon: "/icon-192.png"
              });
            }
          }
          queryClient.invalidateQueries
'@

$content = $content -replace $find, $replace

$findPerm = '(?s)const queryClient = useQueryClient\(\);\s*useEffect\(\(\) => \{'
$replacePerm = @'
const queryClient = useQueryClient();

  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
'@

$content = $content -replace $findPerm, $replacePerm

$content | Set-Content -Path "src\hooks\useLiveAppointments.ts"
