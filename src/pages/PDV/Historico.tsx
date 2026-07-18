import { useClinic } from "@/hooks/useClinic";

export default function PDVHistorico() {
  const { clinic, loading } = useClinic();

  if (loading) {
    return <div className="p-8 text-center">Carregando histórico...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Histórico de Caixas</h1>
      <p className="text-muted-foreground">Em breve: listagem de sessões de caixa.</p>
    </div>
  );
}
