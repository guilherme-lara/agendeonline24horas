$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw
$find = '(?s)if \(\!shop\?\.settings\?\.infinitepay_tag\) \{.*?\}'
$replace = @'
const totalToCharge = cartTotalAdvance > 0 ? cartTotalAdvance : (paymentOption === "online" ? cartTotalPrice : 0);
        if (totalToCharge > 0 && !shop?.settings?.infinitepay_tag) {
          throw new Error("Erro: O estabelecimento ainda não configurou o método de pagamento.");
        }
'@
$content = $content -replace $find, $replace

$findDuplicate = '(?s)const totalToCharge = cartTotalAdvance > 0 \? cartTotalAdvance : \(paymentOption === "online" \? cartTotalPrice : 0\);\s*const \{ data: apptId'
$replaceDuplicate = 'const { data: apptId'
$content = $content -replace $findDuplicate, $replaceDuplicate

$content | Set-Content -Path "src\pages\PublicBooking.tsx"
