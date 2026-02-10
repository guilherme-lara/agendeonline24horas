import { Check, Clock, Scissors, User, Eye, Star, Palette } from "lucide-react";
import { Service } from "@/data/mock-data";

const iconMap: Record<string, React.ElementType> = {
  scissors: Scissors,
  user: User,
  eye: Eye,
  star: Star,
  palette: Palette,
};

interface ServiceCardProps {
  service: Service;
  selected: boolean;
  onToggle: () => void;
}

const ServiceCard = ({ service, selected, onToggle }: ServiceCardProps) => {
  const Icon = iconMap[service.icon] || Scissors;

  return (
    <button
      onClick={onToggle}
      className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
        selected
          ? "border-primary bg-primary/10 shadow-gold"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
              selected ? "gold-gradient" : "bg-secondary"
            }`}
          >
            <Icon className={`h-5 w-5 ${selected ? "text-primary-foreground" : "text-primary"}`} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{service.name}</h3>
            <p className="text-xs text-muted-foreground">{service.description}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-display font-bold text-primary">R$ {service.price}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {service.duration}min
          </span>
        </div>
      </div>
      {selected && (
        <div className="mt-2 flex items-center gap-1 text-xs text-primary">
          <Check className="h-3 w-3" /> Selecionado
        </div>
      )}
    </button>
  );
};

export default ServiceCard;
