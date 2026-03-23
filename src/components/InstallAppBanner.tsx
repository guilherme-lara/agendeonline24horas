import { Download, X, Share, Plus, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

const isStandalone = () => {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
};

const InstallAppBanner = () => {
  const { isInstallable, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isiOSDevice, setIsiOSDevice] = useState(false);

  useEffect(() => {
    setIsiOSDevice(isIOS() && !isStandalone());
  }, []);

  if (dismissed || isStandalone()) return null;
  if (!isInstallable && !isiOSDevice) return null;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-2xl mb-4 animate-in slide-in-from-top duration-500">
        <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground">Instale o App</p>
          <p className="text-[10px] text-muted-foreground">Acesso rápido direto da tela inicial</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            if (isiOSDevice) {
              setShowIOSGuide(true);
            } else {
              promptInstall();
            }
          }}
          className="gold-gradient text-primary-foreground font-bold text-xs rounded-xl h-9 px-4"
        >
          {isiOSDevice ? "Como Instalar" : "Instalar"}
        </Button>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* iOS Step-by-Step Guide */}
      <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
        <DialogContent className="bg-card border-border text-foreground rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-center">Instalar no iPhone</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Share className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">1. Toque em "Compartilhar"</p>
                <p className="text-xs text-muted-foreground">O ícone de compartilhar fica na barra inferior do Safari</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">2. "Adicionar à Tela de Início"</p>
                <p className="text-xs text-muted-foreground">Role as opções e toque nessa opção</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ArrowDown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">3. Toque em "Adicionar"</p>
                <p className="text-xs text-muted-foreground">Pronto! O app aparecerá na sua tela inicial</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppBanner;
