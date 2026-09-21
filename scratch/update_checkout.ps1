$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw

# Replace the totalToCharge in bookingMutation
$findCharge = '(?s)const totalToCharge = cartTotalAdvance > 0 \? cartTotalAdvance : cartTotalPrice;'
$replaceCharge = 'const totalToCharge = cartTotalAdvance;'
$content = $content -replace $findCharge, $replaceCharge

# Replace the button text in checkout
$findButton = '(?s)R\$ \{Number\(\(cartTotalAdvance > 0 \? cartTotalAdvance : cartTotalPrice\)\.toFixed\(2\)\)\}'
$replaceButton = 'cartTotalAdvance > 0 ? `R$ ${cartTotalAdvance.toFixed(2)} (Sinal)` : "Confirmar"'
$content = $content -replace $findButton, $replaceButton

$content | Set-Content -Path "src\pages\PublicBooking.tsx"
