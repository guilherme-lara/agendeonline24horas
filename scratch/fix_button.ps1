$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw

$findButton = 'cartTotalAdvance > 0 \? `R\$ \$\{cartTotalAdvance\.toFixed\(2\)\} \(Sinal\)` : "Confirmar"'
$replaceButton = '{cartTotalAdvance > 0 ? `R$ ${cartTotalAdvance.toFixed(2)} (Sinal)` : "Confirmar"}'
$content = $content -replace $findButton, $replaceButton

$content | Set-Content -Path "src\pages\PublicBooking.tsx"
