$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw

$findCharge = '(?s)const totalToCharge = paymentOption === "online" \? cartTotalAdvance : 0;'
$replaceCharge = 'const totalToCharge = cartTotalAdvance > 0 ? cartTotalAdvance : (paymentOption === "online" ? cartTotalPrice : 0);'
$content = $content -replace $findCharge, $replaceCharge

$findUI = '(?s)\{cartTotalAdvance > 0 && shop\?\.settings\?\.infinitepay_tag && \(\s*<div className="bg-secondary/50.*?<div className="bg-secondary/50 rounded-3xl p-6 border border-border space-y-3">'
$replaceUI = @'
                        {shop?.settings?.infinitepay_tag && (
                          <div className="bg-secondary/50 rounded-3xl p-6 border border-border space-y-4 mb-2">
                              <h4 className="text-sm font-black uppercase text-muted-foreground text-center mb-2">Forma de Pagamento</h4>
                              <div className={`grid ${cartTotalAdvance > 0 ? "grid-cols-1" : "grid-cols-2"} gap-3`}>
                                <button
                                  onClick={() => setPaymentOption("online")}
                                  className={`p-4 rounded-2xl border text-center transition-all ${paymentOption === "online" || cartTotalAdvance > 0 ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                                >
                                  <QrCode className={`h-6 w-6 mx-auto mb-2 ${paymentOption === "online" || cartTotalAdvance > 0 ? "text-primary" : "text-muted-foreground"}`} />
                                  <span className={`text-xs font-bold ${paymentOption === "online" || cartTotalAdvance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                                    {cartTotalAdvance > 0 ? "Pagar Agora (Sinal)" : "Pagar Agora (Online)"}
                                  </span>
                                </button>
                                {cartTotalAdvance === 0 && (
                                  <button
                                    onClick={() => setPaymentOption("local")}
                                    className={`p-4 rounded-2xl border text-center transition-all ${paymentOption === "local" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                                  >
                                    <ShoppingBag className={`h-6 w-6 mx-auto mb-2 ${paymentOption === "local" ? "text-primary" : "text-muted-foreground"}`} />
                                    <span className={`text-xs font-bold ${paymentOption === "local" ? "text-primary" : "text-muted-foreground"}`}>Pagar no Local</span>
                                  </button>
                                )}
                              </div>
                          </div>
                        )}

                        <div className="bg-secondary/50 rounded-3xl p-6 border border-border space-y-3">
'@
$content = $content -replace $findUI, $replaceUI

$findTotal = '(?s)\{paymentOption === "online" && cartTotalAdvance > 0 \? `R\$ \$\{cartTotalAdvance\.toFixed\(2\)\} \(Sinal\)` : "No local"\}'
$replaceTotal = '{cartTotalAdvance > 0 ? `R$ ${cartTotalAdvance.toFixed(2)} (Sinal)` : (paymentOption === "online" ? `R$ ${cartTotalPrice.toFixed(2)}` : "No local")}'
$content = $content -replace $findTotal, $replaceTotal

$findWA = '(?s)window\.open\(`https://wa\.me/55\$\{shop\?\.phone\?\.replace\(/\\D/g, ''''\)\}\?text=\$\{msg\}`.*?;\s*\}\}'
$replaceWA = @'
let cleanPhone = shop?.phone?.replace(/\D/g, '') || '';
                      if (cleanPhone && !cleanPhone.startsWith('55')) {
                        cleanPhone = '55' + cleanPhone;
                      }
                      window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
                    }}
'@
$content = $content -replace $findWA, $replaceWA

$content | Set-Content -Path "src\pages\PublicBooking.tsx"
