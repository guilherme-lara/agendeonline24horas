import { useState, useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface LogoUploadProps {
  barbershopId: string;
  currentUrl?: string;
  onUploaded: (url: string) => void;
}

const LogoUpload = ({ barbershopId, currentUrl, onUploaded }: LogoUploadProps) => {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Formato inválido", description: "Envie uma imagem (PNG, JPG).", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 2MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${barbershopId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    const publicUrl = urlData.publicUrl + "?t=" + Date.now();

    const { error: updateError } = await (supabase
      .from("barbershops") as any)
      .update({ logo_url: publicUrl })
      .eq("id", barbershopId);

    if (updateError) {
      toast({ title: "Erro", description: updateError.message, variant: "destructive" });
    } else {
      toast({ title: "Logo atualizada!" });
      onUploaded(publicUrl);
    }
    setUploading(false);
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative h-14 w-14 rounded-full border-2 border-dashed border-border hover:border-primary/50 transition-all flex items-center justify-center overflow-hidden bg-secondary"
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : currentUrl ? (
          <img src={currentUrl} alt="Logo" className="h-full w-full object-cover rounded-full" />
        ) : (
          <Camera className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
      <div>
        <p className="text-sm font-medium">Logo do Estabelecimento</p>
        <p className="text-xs text-muted-foreground">Clique para {currentUrl ? "alterar" : "enviar"}</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
    </div>
  );
};

export default LogoUpload;
