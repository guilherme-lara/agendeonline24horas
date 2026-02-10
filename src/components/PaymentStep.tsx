import { CreditCard, QrCode, Check } from "lucide-react";
import { useBooking } from "@/contexts/BookingContext";

const PaymentStep = () => {
  const { paymentMethod, setPaymentMethod, totalPrice } = useBooking();

  const options = [
    {
      id: "pix" as const,
      label: "PIX",
      description: "Pagamento instantâneo via QR Code",
      icon: QrCode,
    },
    {
      id: "card" as const,
      label: "Cartão de Crédito/Débito",
      description: "Visa, Mastercard, Elo e outros",
      icon: CreditCard,
    },
  ];

  return (
    <div className="animate-fade-in">
      <h2 className="font-display text-xl font-bold mb-1">Pagamento</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Escolha a forma de pagamento — Total:{" "}
        <span className="text-primary font-bold">R$ {totalPrice}</span>
      </p>
      <div className="space-y-3">
        {options.map((opt) => {
          const selected = paymentMethod === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setPaymentMethod(opt.id)}
              className={`w-full flex items-center gap-4 rounded-lg border p-4 text-left transition-all ${
                selected
                  ? "border-primary bg-primary/10 shadow-gold"
                  : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                  selected ? "gold-gradient text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                <opt.icon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.description}</p>
              </div>
              {selected && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full gold-gradient">
                  <Check className="h-3.5 w-3.5 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {paymentMethod === "pix" && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5 text-center">
          <div className="mx-auto mb-3 flex h-40 w-40 items-center justify-center rounded-lg bg-white">
            <QrCode className="h-28 w-28 text-gray-900" />
          </div>
          <p className="text-xs text-muted-foreground">
            QR Code simulado — escaneie para pagar (demonstração)
          </p>
        </div>
      )}
      {paymentMethod === "card" && (
        <div className="mt-6 rounded-lg border border-border bg-card p-5 space-y-3">
          <p className="text-xs text-muted-foreground text-center">
            💳 Simulação — o pagamento será processado ao confirmar
          </p>
          <div className="space-y-2">
            <input
              placeholder="Número do cartão"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              disabled
              value="•••• •••• •••• 4242"
            />
            <div className="flex gap-2">
              <input
                placeholder="MM/AA"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                disabled
                value="12/28"
              />
              <input
                placeholder="CVV"
                className="w-20 rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                disabled
                value="•••"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentStep;
