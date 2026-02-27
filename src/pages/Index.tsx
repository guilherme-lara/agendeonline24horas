import { useNavigate } from "react-router-dom";
import { Star, ArrowRight } from "lucide-react";
import HeroBanner from "@/components/HeroBanner";
import SubscriptionPlans from "@/components/SubscriptionPlans";
import { services, barbers } from "@/data/mock-data";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  
  // Pegamos os 4 serviços mais populares para a Home
  const popularServices = services.slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      {/* Banner Principal - Já blindado pelo componente HeroBanner */}
      <HeroBanner />

      {/* Seção de Serviços Populares */}
      <section className="container py-16 animate-fade-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-primary mb-1 font-semibold">
              Nossos Serviços
            </p>
            <h2 className="font-display text-2xl font-bold sm:text-3xl text-foreground">
              Serviços Populares
            </h2>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/booking")} 
            className="text-primary hover:text-primary hover:bg-primary/10 transition-colors"
          >
            Ver todos <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {popularServices.map((service, i) => (
            <div
              key={service.id}
              className="group rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
              onClick={() => navigate("/booking")}
            >
              <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {service.name}
              </h3>
              <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                {service.description}
              </p>
              <div className="flex items-center justify-between mt-auto">
                <span className="font-display font-bold text-primary">
                  R$ {service.price}
                </span>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                  {service.duration}min
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Seção de Planos de Assinatura */}
      <div className="bg-secondary/30">
        <SubscriptionPlans />
      </div>

      {/* Seção de Equipe / Profissionais */}
      <section className="container py-20 animate-fade-in">
        <div className="mb-8 text-center sm:text-left">
          <p className="text-xs uppercase tracking-[0.15em] text-primary mb-1 font-semibold">
            Nossa Equipe
          </p>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Profissionais em Destaque
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {barbers.map((barber, i) => (
            <div
              key={barber.id}
              className="group rounded-lg border border-border bg-card p-6 text-center hover:border-primary/40 hover:shadow-md transition-all animate-fade-in"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="relative mx-auto mb-4 h-24 w-24">
                <img
                  src={barber.avatar}
                  alt={barber.name}
                  className="h-full w-full rounded-full object-cover border-2 border-border group-hover:border-primary transition-all duration-300"
                />
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 shadow-sm">
                  <div className="flex items-center justify-center gap-0.5 bg-primary/10 px-1.5 py-0.5 rounded-full">
                    <Star className="h-3 w-3 fill-primary text-primary" />
                    <span className="text-[10px] font-bold text-primary">{barber.rating}</span>
                  </div>
                </div>
              </div>
              
              <h3 className="font-semibold text-sm text-foreground mb-1">
                {barber.name}
              </h3>
              <p className="text-[11px] text-muted-foreground mb-4 uppercase tracking-wider">
                {barber.specialty}
              </p>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-xs h-8 group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                onClick={() => navigate("/booking")}
              >
                Agendar
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;
