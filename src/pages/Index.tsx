import { useNavigate } from "react-router-dom";
import { Star, ArrowRight } from "lucide-react";
import HeroBanner from "@/components/HeroBanner";
import SubscriptionPlans from "@/components/SubscriptionPlans";
import { services, barbers } from "@/data/mock-data";
import { Button } from "@/components/ui/button";

const Index = () => {
  const navigate = useNavigate();
  const popularServices = services.slice(0, 4);

  return (
    <div className="min-h-screen">
      <HeroBanner />

      {/* Popular Services */}
      <section className="container py-16">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-primary mb-1">Nossos Serviços</p>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Serviços Populares</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/booking")} className="text-primary hover:text-primary">
            Ver todos <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {popularServices.map((service, i) => (
            <div
              key={service.id}
              className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 transition-all cursor-pointer animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
              onClick={() => navigate("/booking")}
            >
              <h3 className="font-semibold text-foreground mb-1">{service.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">{service.description}</p>
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-primary">R$ {service.price}</span>
                <span className="text-xs text-muted-foreground">{service.duration}min</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Subscription Plans */}
      <SubscriptionPlans />

      {/* Featured Barbers */}
      <section className="container pb-20">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.15em] text-primary mb-1">Nossa Equipe</p>
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Profissionais em Destaque</h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {barbers.map((barber, i) => (
            <div
              key={barber.id}
              className="group rounded-lg border border-border bg-card p-4 text-center hover:border-primary/40 transition-all animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <img
                src={barber.avatar}
                alt={barber.name}
                className="mx-auto mb-3 h-20 w-20 rounded-full object-cover border-2 border-border group-hover:border-primary transition-colors"
              />
              <h3 className="font-semibold text-sm text-foreground">{barber.name}</h3>
              <p className="text-xs text-muted-foreground mb-2">{barber.specialty}</p>
              <div className="flex items-center justify-center gap-1">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                <span className="text-sm font-medium text-primary">{barber.rating}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Index;
