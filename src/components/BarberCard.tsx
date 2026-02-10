import { Star, Check } from "lucide-react";
import { Barber } from "@/data/mock-data";

interface BarberCardProps {
  barber: Barber;
  selected: boolean;
  onSelect: () => void;
}

const BarberCard = ({ barber, selected, onSelect }: BarberCardProps) => {
  return (
    <button
      onClick={onSelect}
      className={`w-full p-4 rounded-lg border transition-all duration-200 ${
        selected
          ? "border-primary bg-primary/10 shadow-gold"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={barber.avatar}
            alt={barber.name}
            className="h-16 w-16 rounded-full object-cover border-2 border-border"
          />
          {selected && (
            <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full gold-gradient">
              <Check className="h-3 w-3 text-primary-foreground" />
            </div>
          )}
        </div>
        <div className="text-left flex-1">
          <h3 className="font-semibold text-foreground">{barber.name}</h3>
          <p className="text-xs text-muted-foreground mb-1">{barber.specialty}</p>
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            <span className="text-sm font-medium text-primary">{barber.rating}</span>
            <span className="text-xs text-muted-foreground">({barber.reviewCount})</span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default BarberCard;
