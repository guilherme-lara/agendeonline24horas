$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw
$find = '(?s)const infiniteTag = shop\?\.settings\?\.infinitepay_tag;\s*if \(\!infiniteTag\) throw new Error\("Este estabelecimento.*?pagamentos online\."\);'
$replace = @'
if (totalToCharge === 0) {
        return { url: null, apptId };
      }

      const infiniteTag = shop?.settings?.infinitepay_tag;
      if (!infiniteTag) throw new Error("Este estabelecimento não está configurado para receber pagamentos online.");
'@
$content = $content -replace $find, $replace
$content | Set-Content -Path "src\pages\PublicBooking.tsx"
