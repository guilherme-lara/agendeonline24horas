export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          barber_id: string | null
          barber_name: string | null
          barbershop_id: string
          client_id: string | null
          client_name: string
          client_phone: string | null
          created_at: string | null
          has_signal: boolean | null
          id: string
          payment_confirmed_at: string | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          payment_url: string | null
          pix_code: string | null
          price: number
          scheduled_at: string
          service_name: string
          signal_value: number | null
          status: string | null
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          barber_id?: string | null
          barber_name?: string | null
          barbershop_id: string
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string | null
          has_signal?: boolean | null
          id?: string
          payment_confirmed_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_url?: string | null
          pix_code?: string | null
          price?: number
          scheduled_at: string
          service_name: string
          signal_value?: number | null
          status?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          barber_id?: string | null
          barber_name?: string | null
          barbershop_id?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string | null
          has_signal?: boolean | null
          id?: string
          payment_confirmed_at?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payment_url?: string | null
          pix_code?: string | null
          price?: number
          scheduled_at?: string
          service_name?: string
          signal_value?: number | null
          status?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_services: {
        Row: {
          barber_id: string | null
          barbershop_id: string | null
          commission_pct: number
          id: string
          service_id: string | null
        }
        Insert: {
          barber_id?: string | null
          barbershop_id?: string | null
          commission_pct?: number
          id?: string
          service_id?: string | null
        }
        Update: {
          barber_id?: string | null
          barbershop_id?: string | null
          commission_pct?: number
          id?: string
          service_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barber_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          active: boolean
          avatar_url: string | null
          barbershop_id: string
          commission_pct: number
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          barbershop_id: string
          commission_pct?: number
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          barbershop_id?: string
          commission_pct?: number
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershop_secrets: {
        Row: {
          barbershop_id: string
          created_at: string
          id: string
          infinitepay_token: string | null
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          barbershop_id: string
          created_at?: string
          id?: string
          infinitepay_token?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          barbershop_id?: string
          created_at?: string
          id?: string
          infinitepay_token?: string | null
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbershop_secrets_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: true
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbershop_secrets_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: true
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershops: {
        Row: {
          address: string | null
          created_at: string | null
          default_commission: number
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          phone: string | null
          plan_name: string | null
          plan_status: string | null
          settings: Json | null
          setup_completed: boolean
          slug: string
          trial_ends_at: string | null
          trial_used: boolean | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          default_commission?: number
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          phone?: string | null
          plan_name?: string | null
          plan_status?: string | null
          settings?: Json | null
          setup_completed?: boolean
          slug: string
          trial_ends_at?: string | null
          trial_used?: boolean | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          default_commission?: number
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          plan_name?: string | null
          plan_status?: string | null
          settings?: Json | null
          setup_completed?: boolean
          slug?: string
          trial_ends_at?: string | null
          trial_used?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      business_hours: {
        Row: {
          barbershop_id: string
          close_time: string
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string
        }
        Insert: {
          barbershop_id: string
          close_time?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time?: string
        }
        Update: {
          barbershop_id?: string
          close_time?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_hours_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          barbershop_id: string
          created_at: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          barbershop_id: string
          created_at?: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          barbershop_id?: string
          created_at?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          barbershop_id: string
          birth_date: string | null
          created_at: string
          id: string
          last_seen: string | null
          name: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          barbershop_id: string
          birth_date?: string | null
          created_at?: string
          id?: string
          last_seen?: string | null
          name: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Update: {
          barbershop_id?: string
          birth_date?: string | null
          created_at?: string
          id?: string
          last_seen?: string | null
          name?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          barbershop_id: string
          category: string
          created_at: string
          date: string
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          barbershop_id: string
          category?: string
          created_at?: string
          date?: string
          description: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          barbershop_id?: string
          category?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          active: boolean
          barbershop_id: string
          category: string
          cost_price: number
          created_at: string
          id: string
          min_quantity: number
          name: string
          quantity: number
          sell_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          barbershop_id?: string
          category?: string
          cost_price?: number
          created_at?: string
          id?: string
          min_quantity?: number
          name: string
          quantity?: number
          sell_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          barbershop_id?: string
          category?: string
          cost_price?: number
          created_at?: string
          id?: string
          min_quantity?: number
          name?: string
          quantity?: number
          sell_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          appointment_id: string | null
          barber_name: string | null
          barbershop_id: string
          created_at: string
          customer_id: string | null
          id: string
          items: Json
          notes: string | null
          payment_method: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          barber_name?: string | null
          barbershop_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          payment_method?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          barber_name?: string | null
          barbershop_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          items?: Json
          notes?: string | null
          payment_method?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          active: boolean
          barbershop_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          price: number
          quantity: number
          service_id: string | null
          updated_at: string
          validity_days: number
        }
        Insert: {
          active?: boolean
          barbershop_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          quantity?: number
          service_id?: string | null
          updated_at?: string
          validity_days?: number
        }
        Update: {
          active?: boolean
          barbershop_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          quantity?: number
          service_id?: string | null
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "packages_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_logs: {
        Row: {
          barbershop_id: string | null
          created_at: string
          event_type: string
          id: string
          payment_id: string | null
          request_body: Json
          response_body: Json | null
          source: string
          status_code: number | null
        }
        Insert: {
          barbershop_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payment_id?: string | null
          request_body?: Json
          response_body?: Json | null
          source?: string
          status_code?: number | null
        }
        Update: {
          barbershop_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payment_id?: string | null
          request_body?: Json
          response_body?: Json | null
          source?: string
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_logs_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_logs_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          barbershop_id: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          barbershop_id?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          barbershop_id?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_plans: {
        Row: {
          barbershop_id: string
          created_at: string | null
          expires_at: string | null
          id: string
          plan_name: string
          price: number
          started_at: string | null
          status: string
        }
        Insert: {
          barbershop_id: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan_name?: string
          price?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          barbershop_id?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan_name?: string
          price?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "saas_plans_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: true
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saas_plans_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: true
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          advance_payment_value: number | null
          barbershop_id: string
          created_at: string | null
          duration: number
          id: string
          name: string
          price: number
          requires_advance_payment: boolean | null
          sort_order: number
        }
        Insert: {
          active?: boolean
          advance_payment_value?: number | null
          barbershop_id: string
          created_at?: string | null
          duration?: number
          id?: string
          name: string
          price?: number
          requires_advance_payment?: boolean | null
          sort_order?: number
        }
        Update: {
          active?: boolean
          advance_payment_value?: number | null
          barbershop_id?: string
          created_at?: string | null
          duration?: number
          id?: string
          name?: string
          price?: number
          requires_advance_payment?: boolean | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          barbershop_id: string
          created_at: string
          id: string
          inventory_id: string
          notes: string | null
          quantity: number
          type: string
        }
        Insert: {
          barbershop_id: string
          created_at?: string
          id?: string
          inventory_id: string
          notes?: string | null
          quantity: number
          type: string
        }
        Update: {
          barbershop_id?: string
          created_at?: string
          id?: string
          inventory_id?: string
          notes?: string | null
          quantity?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory"
            referencedColumns: ["id"]
          },
        ]
      }
      subscribers: {
        Row: {
          created_at: string
          id: string
          name: string
          phone: string
          plan: string
          plan_price: number
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          phone?: string
          plan: string
          plan_price: number
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          phone?: string
          plan?: string
          plan_price?: number
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      upgrade_requests: {
        Row: {
          barbershop_id: string
          created_at: string | null
          id: string
          requested_plan: string
          status: string | null
          whatsapp: string
        }
        Insert: {
          barbershop_id: string
          created_at?: string | null
          id?: string
          requested_plan: string
          status?: string | null
          whatsapp: string
        }
        Update: {
          barbershop_id?: string
          created_at?: string | null
          id?: string
          requested_plan?: string
          status?: string | null
          whatsapp?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          barbershop_id: string | null
          created_at: string
          event_type: string
          id: string
          payment_id: string | null
          processed: boolean
          raw_payload: Json
        }
        Insert: {
          barbershop_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payment_id?: string | null
          processed?: boolean
          raw_payload?: Json
        }
        Update: {
          barbershop_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          payment_id?: string | null
          processed?: boolean
          raw_payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      appointments_public: {
        Row: {
          barbershop_id: string | null
          id: string | null
          scheduled_at: string | null
          service_name: string | null
          status: string | null
        }
        Insert: {
          barbershop_id?: string | null
          id?: string | null
          scheduled_at?: string | null
          service_name?: string | null
          status?: string | null
        }
        Update: {
          barbershop_id?: string | null
          id?: string | null
          scheduled_at?: string | null
          service_name?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers_public: {
        Row: {
          active: boolean | null
          avatar_url: string | null
          barbershop_id: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          active?: boolean | null
          avatar_url?: string | null
          barbershop_id?: string | null
          id?: string | null
          name?: string | null
        }
        Update: {
          active?: boolean | null
          avatar_url?: string | null
          barbershop_id?: string | null
          id?: string | null
          name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbers_barbershop_id_fkey"
            columns: ["barbershop_id"]
            isOneToOne: false
            referencedRelation: "barbershops_public"
            referencedColumns: ["id"]
          },
        ]
      }
      barbershops_public: {
        Row: {
          address: string | null
          id: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          address?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          address?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_get_user_emails: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      cancel_expired_pix_appointments: { Args: never; Returns: number }
      create_public_appointment: {
        Args: {
          _barbershop_id: string
          _client_name: string
          _client_phone: string
          _payment_method?: string
          _price: number
          _scheduled_at: string
          _service_name: string
        }
        Returns: string
      }
      get_customers_with_stats: {
        Args: { _barbershop_id: string }
        Returns: {
          id: string
          last_appointment_at: string
          name: string
          phone: string
          total_appointments: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "barber"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "barber"],
    },
  },
} as const
