$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw

# Replace the totalToCharge calculation to use actualCartTotalAdvance
$find1 = '(?s)const totalToCharge = cartTotalAdvance > 0 \? cartTotalAdvance : \(paymentOption === "online" \? cartTotalPrice : 0\);'
$replace1 = @'
const actualCartTotalAdvance = shop?.settings?.infinitepay_tag ? cartTotalAdvance : 0;
      const totalToCharge = actualCartTotalAdvance > 0 ? actualCartTotalAdvance : (paymentOption === "online" ? cartTotalPrice : 0);
'@
$content = $content -replace $find1, $replace1

# Replace all UI occurrences of cartTotalAdvance with actualCartTotalAdvance
$content = $content -replace '\{cartTotalAdvance > 0 \? `R\$ \$\{cartTotalAdvance\.toFixed\(2\)\} \(Sinal\)`', '{actualCartTotalAdvance > 0 ? `R$ ${actualCartTotalAdvance.toFixed(2)} (Sinal)`'
$content = $content -replace 'cartTotalAdvance > 0 \? "Pagar Agora \(Sinal\)"', 'actualCartTotalAdvance > 0 ? "Pagar Agora (Sinal)"'
$content = $content -replace 'cartTotalAdvance > 0 \? "grid-cols-1"', 'actualCartTotalAdvance > 0 ? "grid-cols-1"'
$content = $content -replace 'cartTotalAdvance > 0 \|\| paymentOption === "online"', 'actualCartTotalAdvance > 0 || paymentOption === "online"'
$content = $content -replace 'paymentOption === "online" \|\| cartTotalAdvance > 0', 'paymentOption === "online" || actualCartTotalAdvance > 0'
$content = $content -replace 'cartTotalAdvance === 0 && \(', 'actualCartTotalAdvance === 0 && ('

# Also need to define actualCartTotalAdvance in the main component body so the UI can use it!
$find2 = '(?s)const \[paymentOption, setPaymentOption\] = useState<"online" \| "local">.*?;'
$replace2 = @'
const [paymentOption, setPaymentOption] = useState<"online" | "local">("local");
  const actualCartTotalAdvance = shop?.settings?.infinitepay_tag ? cartTotalAdvance : 0;
'@
$content = $content -replace $find2, $replace2

$content | Set-Content -Path "src\pages\PublicBooking.tsx"
