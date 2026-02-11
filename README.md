# TechBarber — SaaS Multi-Tenant para Barbearias

Sistema completo de gestão para barbearias com agendamento online, dashboard inteligente e painel administrativo multi-tenant.

## 🚀 Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Estilização | Tailwind CSS, shadcn/ui |
| Ícones | Lucide React |
| Gráficos | Recharts |
| Backend | Supabase (Auth, Database, RLS) |
| Roteamento | React Router v6 |

## 📐 Arquitetura Multi-Tenant

Cada barbearia é um **tenant** isolado por `barbershop_id`. As políticas de **Row Level Security (RLS)** garantem que cada dono acessa apenas os dados de sua barbearia.

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│  Landing /  │────▶│  Auth /auth  │────▶│  Onboarding   │
│  SaaS Page  │     │  Login/Signup│     │  (1ª config)  │
└─────────────┘     └──────────────┘     └──────┬────────┘
                                                │
                    ┌──────────────┐     ┌───────▼────────┐
                    │ Super Admin  │     │   Dashboard    │
                    │ /super-admin │     │  /dashboard    │
                    └──────────────┘     └───────┬────────┘
                                                │
                                        ┌───────▼────────┐
                                        │ Public Booking │
                                        │ /book/:slug    │
                                        └────────────────┘
```

## 🗂️ Estrutura de Rotas

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/` | Landing Page (venda SaaS) | Público |
| `/auth` | Login e Cadastro unificado | Público |
| `/onboarding` | Configuração inicial da barbearia | Autenticado (sem barbershop) |
| `/dashboard` | Painel do barbeiro (admin local) | Dono da barbearia |
| `/super-admin` | Painel Master (gestão global) | Admin (role `admin`) |
| `/book/:slug` | Página pública de agendamento | Público |

## 🔐 Níveis de Acesso

### 1. Cliente (Público)
- Acessa `/book/:slug` para agendar
- Não requer autenticação

### 2. Dono de Barbearia (Autenticado)
- Cria conta em `/auth`
- Configura barbearia em `/onboarding`
- Gerencia agendamentos em `/dashboard`
- Visualiza métricas e faturamento

### 3. Super Admin (Role `admin`)
- Acessa `/super-admin`
- Visualiza KPIs globais (MRR, total de barbearias, assinantes)
- Gerencia planos SaaS de todos os tenants
- Suspende/reativa acessos

## 🗄️ Configuração do Supabase

### Tabelas necessárias

```sql
-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela de roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Função de verificação de role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Barbearias
CREATE TABLE public.barbershops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;

-- Perfis
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  barbershop_id UUID REFERENCES public.barbershops(id),
  name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Trigger para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Agendamentos
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id),
  client_id UUID,
  client_name TEXT NOT NULL,
  client_phone TEXT DEFAULT '',
  service_name TEXT NOT NULL,
  barber_name TEXT DEFAULT '',
  price NUMERIC DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending',
  payment_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Planos SaaS
CREATE TABLE public.saas_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id UUID NOT NULL REFERENCES public.barbershops(id),
  plan_name TEXT DEFAULT 'essential',
  price NUMERIC DEFAULT 97.00,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;
```

### Conceder acesso admin

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<UUID_DO_USUARIO>', 'admin');
```

## 🛠️ Desenvolvimento Local

```bash
git clone <URL_DO_REPOSITORIO>
cd <PASTA_DO_PROJETO>
npm install
npm run dev
```


## 📄 Licença

Projeto privado — TechBarber © 2026
