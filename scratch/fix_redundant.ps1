$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw
$find = '(?s)const items = JSON\.stringify.*?if \(priceInCents === 0\) \{\s*return \{ url: null, apptId \};\s*\}'
$replace = 'const items = JSON.stringify([{ name: itemName, price: priceInCents, quantity: 1 }]);'
$content = $content -replace $find, $replace
$content | Set-Content -Path "src\pages\PublicBooking.tsx"
