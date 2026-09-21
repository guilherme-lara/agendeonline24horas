$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw
$find = '(?s)\{bookingMutation\.isPending \? <Loader2 className="animate-spin mr-2" /> : <><QrCode className="mr-2 h-5 w-5" /> Pagar e Agendar</>\}'
$replace = '{bookingMutation.isPending ? <Loader2 className="animate-spin mr-2" /> : (cartTotalAdvance > 0 || paymentOption === "online" ? <><QrCode className="mr-2 h-5 w-5" /> Pagar e Agendar</> : <><CalendarDays className="mr-2 h-5 w-5" /> Confirmar Agendamento</>)}'
$content = $content -replace $find, $replace
$content | Set-Content -Path "src\pages\PublicBooking.tsx"
