import { TimeSlot } from "@/data/mock-data";

interface TimeSlotPickerProps {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelect: (time: string) => void;
}

const TimeSlotPicker = ({ slots, selectedTime, onSelect }: TimeSlotPickerProps) => {
  if (slots.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        Não há horários disponíveis neste dia.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {slots.map((slot) => (
        <button
          key={slot.time}
          disabled={!slot.available}
          onClick={() => onSelect(slot.time)}
          className={`rounded-lg py-2.5 px-3 text-sm font-medium transition-all duration-150 ${
            !slot.available
              ? "bg-secondary/50 text-muted-foreground/40 cursor-not-allowed line-through"
              : selectedTime === slot.time
              ? "gold-gradient text-primary-foreground shadow-gold"
              : "bg-secondary text-secondary-foreground hover:border-primary hover:bg-primary/10 border border-transparent"
          }`}
        >
          {slot.time}
        </button>
      ))}
    </div>
  );
};

export default TimeSlotPicker;
