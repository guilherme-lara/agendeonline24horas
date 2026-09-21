$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw

$find = '(?s)    onSuccess: \(res\) => \{.*?      if \(res\.url\) \{.*?      \}'
$replace = @'
    onSuccess: (res) => {
      clearCart();
      setCartUpdateTick((t) => t + 1);
      queryClient.invalidateQueries({ queryKey: ['customers', shop?.id] });
      
      if (res.url) {
        const expires = Date.now() + PAYMENT_LOCK_MS;
        try {
          sessionStorage.setItem("payment_expires_at", String(expires));
          sessionStorage.setItem("pending_appt_id", res.apptId);
        } catch { /* */ }
        setPaymentExpiresAt(expires);
        setPendingApptId(res.apptId);
        window.location.href = res.url;
      } else {
        navigate(`/agendamentos/${slug}?success=true`);
      }
'@

$content = $content -replace $find, $replace
$content | Set-Content -Path "src\pages\PublicBooking.tsx"
