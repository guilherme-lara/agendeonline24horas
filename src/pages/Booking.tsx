import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useBooking } from "@/contexts/BookingContext";
import { services, barbers, generateTimeSlots } from "@/data/mock-data";
import StepIndicator from "@/components/StepIndicator";
import ServiceCard from "@/components/ServiceCard";
import BarberCard from "@/components/BarberCard";
import TimeSlotPicker from "@/components/TimeSlotPicker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";

const Booking = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const booking = useBooking();
  const [loading, setLoading] = useState(false);

  const timeSlots = useMemo(
    () => (booking.selectedDate ? generateTimeSlots(booking.selectedDate) : []),
    [booking.selectedDate]
  );

  const canProceed = () => {
    switch (booking.currentStep) {
      case 1: return booking.selectedServices.length > 0;
      case 2: return booking.selectedBarber !== null;
      case 3: return booking.selectedDate !== null && booking.selectedTime !== null;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (booking.currentStep < 4) {
      booking.setStep(booking.currentStep + 1);
    }
  };

  const handleBack = () => {
    if (booking.currentStep > 1) {
      booking.setStep(booking.currentStep - 1);
    }
  };

  const handleConfirm = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      booking.reset();
      navigate("/booking/success");
    }, 1500);
  };

  return (
    <div className="container max-w-2xl py-8 pb-24">
      <StepIndicator currentStep={booking.currentStep} />

      {/* Step 1 - Services */}
      {booking.currentStep === 1 && (
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-bold mb-1">Escolha os Serviços</h2>
          <p className="text-sm text-muted-foreground mb-6">Selecione um ou mais serviços</p>
          <div className="space-y-3">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                selected={booking.selectedServices.some((s) => s.id === service.id)}
                onToggle={() => booking.toggleService(service)}
              />
            ))}
          </div>
          {booking.selectedServices.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-secondary flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {booking.selectedServices.length} serviço(s) · {booking.totalDuration}min
              </span>
              <span className="font-display font-bold text-primary">R$ {booking.totalPrice}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2 - Barber */}
      {booking.currentStep === 2 && (
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-bold mb-1">Escolha o Profissional</h2>
          <p className="text-sm text-muted-foreground mb-6">Selecione o barbeiro de sua preferência</p>
          <div className="space-y-3">
            {barbers.map((barber) => (
              <BarberCard
                key={barber.id}
                barber={barber}
                selected={booking.selectedBarber?.id === barber.id}
                onSelect={() => booking.setBarber(barber)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 3 - Date & Time */}
      {booking.currentStep === 3 && (
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-bold mb-1">Data e Horário</h2>
          <p className="text-sm text-muted-foreground mb-6">Escolha o melhor dia e horário</p>
          <div className="flex justify-center mb-6">
            <Calendar
              mode="single"
              selected={booking.selectedDate || undefined}
              onSelect={(date) => date && booking.setDate(date)}
              disabled={(date) => date < new Date() || date.getDay() === 0}
              locale={ptBR}
              className="rounded-lg border border-border bg-card p-3 pointer-events-auto"
            />
          </div>
          {booking.selectedDate && (
            <div>
              <p className="text-sm font-medium mb-3">
                Horários para{" "}
                <span className="text-primary">
                  {format(booking.selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                </span>
              </p>
              <TimeSlotPicker
                slots={timeSlots}
                selectedTime={booking.selectedTime}
                onSelect={(time) => booking.setTime(time)}
              />
            </div>
          )}
        </div>
      )}

      {/* Step 4 - Summary */}
      {booking.currentStep === 4 && (
        <div className="animate-fade-in">
          <h2 className="font-display text-xl font-bold mb-6">Resumo do Agendamento</h2>
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Serviços</p>
              {booking.selectedServices.map((s) => (
                <div key={s.id} className="flex justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="text-muted-foreground">R$ {s.price}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-1">Profissional</p>
              <div className="flex items-center gap-3">
                <img
                  src={booking.selectedBarber?.avatar}
                  alt={booking.selectedBarber?.name}
                  className="h-10 w-10 rounded-full object-cover border border-border"
                />
                <span className="font-medium text-sm">{booking.selectedBarber?.name}</span>
              </div>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground mb-1">Data e Hora</p>
              <p className="text-sm">
                {booking.selectedDate && format(booking.selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}{" "}
                às <span className="text-primary font-medium">{booking.selectedTime}</span>
              </p>
            </div>
            <div className="border-t border-border pt-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="font-display text-2xl font-bold text-primary">R$ {booking.totalPrice}</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border p-4">
        <div className="container max-w-2xl flex gap-3">
          {booking.currentStep > 1 && (
            <Button variant="outline" onClick={handleBack} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
          )}
          {booking.currentStep < 4 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex-1 gold-gradient text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-40"
            >
              Continuar <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 gold-gradient text-primary-foreground font-semibold hover:opacity-90"
            >
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Agendando...</>
              ) : (
                "Confirmar Agendamento"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
