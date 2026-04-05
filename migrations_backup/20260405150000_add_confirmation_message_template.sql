-- Add confirmation_message_template column to barbershops.settings
-- Stored as JSONB field inside the settings column (already exists)
-- This is a no-OP migration: the settings JSONB column already supports arbitrary keys

-- If you prefer a dedicated column on barbershops:
ALTER TABLE public.barbershops
  ADD COLUMN IF NOT EXISTS confirmation_message_template text;

-- Set default for existing tenants
UPDATE public.barbershops
  SET confirmation_message_template = COALESCE(
    settings->>'confirmation_message_template',
    'Olá {{cliente}}, seu agendamento para {{servico}} no dia {{data}} às {{horario}} está confirmado!'
  )
  WHERE confirmation_message_template IS NULL;
