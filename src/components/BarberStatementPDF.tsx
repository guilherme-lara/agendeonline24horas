import { useMemo, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { X, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toBRT } from "@/lib/timezone";

interface BarberStatementPDFProps {
  barber: any;
  orders: any[];
  appointments: any[];
  commissionRate: number;
  onClose: () => void;
}

const BarberStatementPDF = ({ barber, orders, appointments, commissionRate, onClose }: BarberStatementPDFProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const completedAppointments = useMemo(() => {
    return appointments
      .filter((a: any) => a.status === "completed")
      .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [appointments]);

  const totals = useMemo(() => {
    const gross = completedAppointments.reduce((sum: number, a: any) => sum + (a.price || 0), 0);
    return {
      gross,
      commission: gross * (commissionRate / 100),
      count: completedAppointments.length,
    };
  }, [completedAppointments, commissionRate]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Extrato - ${barber.name}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1a1a1a; }
        .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #e5e5e5; padding-bottom: 16px; }
        .header h1 { font-size: 18px; margin-bottom: 4px; }
        .header p { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; font-size: 12px; }
        th { background: #f5f5f5; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
        .total-row { font-weight: 700; background: #f0fdf4; }
        .footer { margin-top: 24px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #e5e5e5; padding-top: 12px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.innerHTML}
      <script>window.print();window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const shopName = barber.barbershops?.name || "Barbearia";

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <h2 className="text-sm font-bold">Extrato de Atendimentos</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 text-xs">
            <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir / PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="h-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Statement Preview */}
      <div className="flex-1 overflow-auto p-4">
        <div ref={printRef} className="max-w-2xl mx-auto bg-white text-black rounded-xl p-6 shadow-lg">
          {/* Header */}
          <div className="header text-center border-b-2 border-gray-200 pb-4 mb-4">
            {barber.barbershops?.logo_url && (
              <img src={barber.barbershops.logo_url} alt={shopName} className="h-12 mx-auto mb-2 object-contain" />
            )}
            <h1 className="text-lg font-bold">{shopName}</h1>
            <p className="text-xs text-gray-500">Extrato de Comissões</p>
          </div>

          {/* Barber Info */}
          <div className="flex justify-between items-start mb-4 text-xs">
            <div>
              <p className="font-bold">{barber.name}</p>
              <p className="text-gray-500">Comissão: {commissionRate}%</p>
            </div>
            <div className="text-right">
              <p className="text-gray-500">Período</p>
              <p className="font-bold">{format(new Date(), "MMMM yyyy", { locale: ptBR })}</p>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-2 px-3 text-left font-bold text-[10px] uppercase tracking-wider border-b-2 border-gray-200">Data</th>
                <th className="py-2 px-3 text-left font-bold text-[10px] uppercase tracking-wider border-b-2 border-gray-200">Hora</th>
                <th className="py-2 px-3 text-left font-bold text-[10px] uppercase tracking-wider border-b-2 border-gray-200">Cliente</th>
                <th className="py-2 px-3 text-left font-bold text-[10px] uppercase tracking-wider border-b-2 border-gray-200">Serviço</th>
                <th className="py-2 px-3 text-right font-bold text-[10px] uppercase tracking-wider border-b-2 border-gray-200">Valor</th>
                <th className="py-2 px-3 text-right font-bold text-[10px] uppercase tracking-wider border-b-2 border-gray-200">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {completedAppointments.map((appt: any) => {
                const date = toBRT(appt.scheduled_at);
                const commission = (appt.price || 0) * (commissionRate / 100);
                return (
                  <tr key={appt.id} className="border-b border-gray-100">
                    <td className="py-2 px-3">{format(date, "dd/MM")}</td>
                    <td className="py-2 px-3">{format(date, "HH:mm")}</td>
                    <td className="py-2 px-3">{appt.client_name}</td>
                    <td className="py-2 px-3">{appt.service_name}</td>
                    <td className="py-2 px-3 text-right">R$ {(appt.price || 0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right font-bold text-green-700">R$ {commission.toFixed(2)}</td>
                  </tr>
                );
              })}
              {completedAppointments.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400">Nenhum atendimento finalizado no período.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-green-50 font-bold">
                <td colSpan={4} className="py-3 px-3 text-right">TOTAL ({totals.count} atendimentos)</td>
                <td className="py-3 px-3 text-right">R$ {totals.gross.toFixed(2)}</td>
                <td className="py-3 px-3 text-right text-green-700">R$ {totals.commission.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Footer */}
          <div className="footer text-center text-[10px] text-gray-400 mt-6 pt-4 border-t border-gray-200">
            <p>Documento gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
            <p className="mt-1">Total Líquido a Receber: <strong className="text-green-700 text-xs">R$ {totals.commission.toFixed(2)}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarberStatementPDF;
