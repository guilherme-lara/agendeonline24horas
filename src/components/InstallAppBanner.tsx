import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useState } from "react";

const InstallAppBanner = () => {
  const { isInstallable, promptInstall } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!isInstallable || dismissed) return null;

  return (
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
        onClick={promptInstall}
        className="gold-gradient text-primary-foreground font-bold text-xs rounded-xl h-9 px-4"
      >
        Instalar
      </Button>
      <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground p-1">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default InstallAppBanner;
