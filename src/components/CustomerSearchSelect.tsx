import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type SearchableCustomer = {
  id: string;
  name: string;
  phone: string;
};

interface CustomerSearchSelectProps {
  customers: SearchableCustomer[];
  value: SearchableCustomer | null;
  onChange: (customer: SearchableCustomer) => void;
  disabled?: boolean;
}

const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
};

const CustomerSearchSelect = ({ customers, value, onChange, disabled }: CustomerSearchSelectProps) => {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [customers],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between border-sys-border bg-sys-bg-base font-normal"
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-sys-brand-primary" />
              <span className="truncate text-sys-text-primary">{value.name}</span>
              <span className="truncate font-mono text-[11px] text-sys-text-muted">{formatPhone(value.phone)}</span>
            </span>
          ) : (
            <span className="text-sys-text-muted">Buscar cliente cadastrado...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[80] w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Nome ou telefone..." />
          <CommandList>
            <CommandEmpty>Nenhum cliente cadastrado encontrado.</CommandEmpty>
            <CommandGroup>
              {sorted.map((customer) => (
                <CommandItem
                  key={customer.id}
                  value={`${customer.name} ${customer.phone}`}
                  onSelect={() => {
                    onChange(customer);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value?.id === customer.id ? "opacity-100" : "opacity-0")} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{customer.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">{formatPhone(customer.phone)}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default CustomerSearchSelect;
