$content = Get-Content -Path "src\hooks\useLiveAppointments.ts" -Raw
$find = '(?s)\(payload\) => \{\s*if \(payload.eventType === "INSERT"\) \{\s*const newAppt = payload.new;\s*if \(Notification.permission === "granted"\) \{\s*const dateStr = new Date\(newAppt.scheduled_at\).*?icon: "/icon-192.png"\s*\}\);\s*\}\s*\}\s*queryClient\.invalidateQueries\(\{ queryKey: \["orders"\] \}\);'
$replace = '(payload) => { queryClient.invalidateQueries({ queryKey: ["orders"] });'
$content = $content -replace $find, $replace
$content | Set-Content -Path "src\hooks\useLiveAppointments.ts"
