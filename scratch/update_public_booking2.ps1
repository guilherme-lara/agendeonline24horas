$content = Get-Content -Path "src\pages\PublicBooking.tsx" -Raw

$findState = 'const \[clientData, setClientData\] = useState\(\{ name: "", phone: "" \}\);'
$replaceState = 'const [clientData, setClientData] = useState({ name: "", phone: "" });
  const [paymentOption, setPaymentOption] = useState<"online" | "local">("online");'
$content = $content -replace $findState, $replaceState

$findCharge = '(?s)const totalToCharge = cartTotalAdvance;'
$replaceCharge = 'const totalToCharge = paymentOption === "online" ? cartTotalAdvance : 0;'
$content = $content -replace $findCharge, $replaceCharge

$findUI = '(?s)<div className="bg-secondary/50 rounded-3xl p-6 border border-border space-y-3">.*?</div>'
$replaceUI = @'
                        {cartTotalAdvance > 0 && shop?.settings?.infinitepay_tag && (
                          <div className="bg-secondary/50 rounded-3xl p-6 border border-border space-y-4">
                              <h4 className="text-sm font-black uppercase text-muted-foreground text-center mb-2">Forma de Pagamento</h4>
                              <div className="grid grid-cols-2 gap-3">
                                <button
                                  onClick={() => setPaymentOption("online")}
                                  className={`p-4 rounded-2xl border text-center transition-all ${paymentOption === "online" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                                >
                                  <QrCode className={`h-6 w-6 mx-auto mb-2 ${paymentOption === "online" ? "text-primary" : "text-muted-foreground"}`} />
                                  <span className={`text-xs font-bold ${paymentOption === "online" ? "text-primary" : "text-muted-foreground"}`}>Pagar Agora (Sinal)</span>
                                </button>
                                <button
                                  onClick={() => setPaymentOption("local")}
                                  className={`p-4 rounded-2xl border text-center transition-all ${paymentOption === "local" ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                                >
                                  <ShoppingBag className={`h-6 w-6 mx-auto mb-2 ${paymentOption === "local" ? "text-primary" : "text-muted-foreground"}`} />
                                  <span className={`text-xs font-bold ${paymentOption === "local" ? "text-primary" : "text-muted-foreground"}`}>Pagar no Local</span>
                                </button>
                              </div>
                          </div>
                        )}

                        <div className="bg-secondary/50 rounded-3xl p-6 border border-border space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-black uppercase text-muted-foreground">
                                {cartItems.length > 0
                                  ? `Total a Pagar (${cartItems.length} ${cartItems.length === 1 ? 'item' : 'itens'})`
                                  : "Valor do Agendamento"
                                }
                              </span>
                              <div className="text-right">
                                <span className="text-2xl font-black text-primary">
                                  {paymentOption === "online" && cartTotalAdvance > 0 ? `R$ ${cartTotalAdvance.toFixed(2)} (Sinal)` : "No local"}
                                </span>
                                {cartItems.length > 0 && totalCartDuration > 0 && (
                                  <p className="text-[10px] text-muted-foreground font-bold">{totalCartDuration} min total</p>
                                )}
                              </div>
                            </div>
                        </div>
'@
$content = $content -replace $findUI, $replaceUI

$findSuccess = '(?s)Agendamento Confirmado!</h1>.*?te esperamos no hor.*?marcado.</p>'
$replaceSuccess = @'
Agendamento Finalizado!</h1>
                
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 mb-8 text-left">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                    <h3 className="font-bold text-amber-500">Atenção: Confirmação Obrigatória!</h3>
                  </div>
                  <p className="text-sm text-foreground/80 mb-4">
                    Para garantir sua vaga, você <strong>DEVE confirmar</strong> o agendamento pelo WhatsApp até <strong>2 horas antes</strong> do horário marcado (ou seja, se marcou às 10h, confirme até às 08h).
                  </p>
                  <Button
                    onClick={() => {
                      const msg = encodeURIComponent(`Olá, gostaria de confirmar meu agendamento para o dia ${format(selectedDate || new Date(), 'dd/MM/yyyy')} às ${selectedTime} com ${selectedBarber?.name || 'o profissional'}.`);
                      window.open(`https://wa.me/55${shop?.phone?.replace(/\D/g, '')}?text=${msg}`, '_blank');
                    }}
                    className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-bold h-12 rounded-xl"
                  >
                    Confirmar agora no WhatsApp
                  </Button>
                </div>
                
                <p className="text-muted-foreground mb-6 max-w-xs mx-auto">Te esperamos no dia {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : ''} às {selectedTime}.</p>
'@
$content = $content -replace $findSuccess, $replaceSuccess

$content | Set-Content -Path "src\pages\PublicBooking.tsx"
