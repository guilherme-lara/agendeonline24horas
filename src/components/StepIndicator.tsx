import { Check } from "lucide-react";

const steps = ["Serviços", "Profissional", "Data & Hora", "Confirmação"];

interface StepIndicatorProps {
  currentStep: number;
}

const StepIndicator = ({ currentStep }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isDone = stepNum < currentStep;

        return (
          <div key={label} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                  isDone
                    ? "gold-gradient text-primary-foreground"
                    : isActive
                    ? "border-2 border-primary text-primary"
                    : "border border-border text-muted-foreground"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span
                className={`hidden sm:block text-[10px] font-medium ${
                  isActive ? "text-primary" : isDone ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 mx-2 h-px ${isDone ? "bg-primary" : "bg-border"}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
