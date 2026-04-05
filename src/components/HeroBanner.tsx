import { useNavigate } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-barbershop.jpg";

const HeroBanner = () => {
  const navigate = useNavigate();

  return (
    <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
      <img
        src={heroImage}
        alt="Interior premium de um salão de beleza"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />

      <div className="relative z-10 container flex h-full flex-col justify-end pb-16">
        <div className="max-w-lg animate-slide-up">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-primary">
            Beleza & Bem-Estar
          </p>
          <h1 className="mb-4 font-display text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Estilo que{" "}
            <span className="text-gold-gradient">define</span>{" "}
            você
          </h1>
          <p className="mb-8 text-base text-muted-foreground sm:text-lg">
            Experiência premium em serviços de beleza, estética e cuidados pessoais. Agende agora com os melhores profissionais.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/booking")}
            className="gold-gradient text-primary-foreground font-semibold shadow-gold hover:opacity-90 transition-all text-base px-8 py-6"
          >
            <CalendarDays className="mr-2 h-5 w-5" />
            Agendar Agora
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HeroBanner;
