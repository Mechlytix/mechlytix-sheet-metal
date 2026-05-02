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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contact_submissions: {
        Row: {
          company: string | null
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          status: string | null
          subject: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          status?: string | null
          subject?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          billing_address: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          shipping_address: string | null
          tax_id: string | null
          user_id: string
        }
        Insert: {
          billing_address?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          shipping_address?: string | null
          tax_id?: string | null
          user_id: string
        }
        Update: {
          billing_address?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          shipping_address?: string | null
          tax_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      machine_profiles: {
        Row: {
          cost_per_bend: number | null
          created_at: string | null
          feed_rates: Json | null
          hourly_rate: number
          id: string
          is_default: boolean | null
          is_system: boolean | null
          machine_type: string | null
          name: string
          pierce_time_seconds: number | null
          power_kw: number | null
          setup_time_minutes: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cost_per_bend?: number | null
          created_at?: string | null
          feed_rates?: Json | null
          hourly_rate?: number
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          machine_type?: string | null
          name: string
          pierce_time_seconds?: number | null
          power_kw?: number | null
          setup_time_minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cost_per_bend?: number | null
          created_at?: string | null
          feed_rates?: Json | null
          hourly_rate?: number
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          machine_type?: string | null
          name?: string
          pierce_time_seconds?: number | null
          power_kw?: number | null
          setup_time_minutes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      materials: {
        Row: {
          category: string
          color_hex: string | null
          cost_per_kg: number
          created_at: string | null
          density_kg_m3: number
          grade: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          k_factor: number | null
          metalness: number | null
          name: string
          notes: string | null
          roughness: number | null
          scrap_value_per_kg: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          color_hex?: string | null
          cost_per_kg: number
          created_at?: string | null
          density_kg_m3: number
          grade?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          k_factor?: number | null
          metalness?: number | null
          name: string
          notes?: string | null
          roughness?: number | null
          scrap_value_per_kg?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          color_hex?: string | null
          cost_per_kg?: number
          created_at?: string | null
          density_kg_m3?: number
          grade?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          k_factor?: number | null
          metalness?: number | null
          name?: string
          notes?: string | null
          roughness?: number | null
          scrap_value_per_kg?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          avatar_url: string | null
          company: string | null
          created_at: string | null
          full_name: string | null
          id: string
          logo_url: string | null
          phone: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      quote_attachments: {
        Row: {
          created_at: string | null
          filename: string
          id: string
          quote_id: string
          upload_id: string
        }
        Insert: {
          created_at?: string | null
          filename: string
          id?: string
          quote_id: string
          upload_id: string
        }
        Update: {
          created_at?: string | null
          filename?: string
          id?: string
          quote_id?: string
          upload_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_attachments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_attachments_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          bend_count: number | null
          bending_cost: number | null
          bounding_height_mm: number | null
          bounding_width_mm: number | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_ref: string | null
          cutting_cost: number | null
          expires_at: string | null
          filename: string
          id: string
          input_type: string
          machine_id: string | null
          markup_percent: number | null
          material_cost: number | null
          material_id: string | null
          notes: string | null
          part_area_mm2: number | null
          perimeter_mm: number | null
          pierce_count: number | null
          quantity: number | null
          quote_number: string | null
          setup_cost: number | null
          share_enabled: boolean
          share_token: string | null
          status: string | null
          thickness_mm: number | null
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
          upload_id: string | null
          user_id: string
        }
        Insert: {
          bend_count?: number | null
          bending_cost?: number | null
          bounding_height_mm?: number | null
          bounding_width_mm?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_ref?: string | null
          cutting_cost?: number | null
          expires_at?: string | null
          filename: string
          id?: string
          input_type: string
          machine_id?: string | null
          markup_percent?: number | null
          material_cost?: number | null
          material_id?: string | null
          notes?: string | null
          part_area_mm2?: number | null
          perimeter_mm?: number | null
          pierce_count?: number | null
          quantity?: number | null
          quote_number?: string | null
          setup_cost?: number | null
          share_enabled?: boolean
          share_token?: string | null
          status?: string | null
          thickness_mm?: number | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
          upload_id?: string | null
          user_id: string
        }
        Update: {
          bend_count?: number | null
          bending_cost?: number | null
          bounding_height_mm?: number | null
          bounding_width_mm?: number | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_ref?: string | null
          cutting_cost?: number | null
          expires_at?: string | null
          filename?: string
          id?: string
          input_type?: string
          machine_id?: string | null
          markup_percent?: number | null
          material_cost?: number | null
          material_id?: string | null
          notes?: string | null
          part_area_mm2?: number | null
          perimeter_mm?: number | null
          pierce_count?: number | null
          quantity?: number | null
          quote_number?: string | null
          setup_cost?: number | null
          share_enabled?: boolean
          share_token?: string | null
          status?: string | null
          thickness_mm?: number | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
          upload_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machine_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      remnants: {
        Row: {
          created_at: string | null
          height_mm: number
          id: string
          location: string | null
          material_id: string | null
          notes: string | null
          qr_code_data: string | null
          source_quote_id: string | null
          status: string | null
          thickness_mm: number
          updated_at: string | null
          user_id: string
          width_mm: number
        }
        Insert: {
          created_at?: string | null
          height_mm: number
          id?: string
          location?: string | null
          material_id?: string | null
          notes?: string | null
          qr_code_data?: string | null
          source_quote_id?: string | null
          status?: string | null
          thickness_mm: number
          updated_at?: string | null
          user_id: string
          width_mm: number
        }
        Update: {
          created_at?: string | null
          height_mm?: number
          id?: string
          location?: string | null
          material_id?: string | null
          notes?: string | null
          qr_code_data?: string | null
          source_quote_id?: string | null
          status?: string | null
          thickness_mm?: number
          updated_at?: string | null
          user_id?: string
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "remnants_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remnants_source_quote_id_fkey"
            columns: ["source_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      sheet_sizes: {
        Row: {
          cost_per_sheet: number | null
          created_at: string | null
          height_mm: number
          id: string
          in_stock: boolean | null
          material_id: string
          quantity: number | null
          supplier: string | null
          thickness_mm: number
          width_mm: number
        }
        Insert: {
          cost_per_sheet?: number | null
          created_at?: string | null
          height_mm: number
          id?: string
          in_stock?: boolean | null
          material_id: string
          quantity?: number | null
          supplier?: string | null
          thickness_mm: number
          width_mm: number
        }
        Update: {
          cost_per_sheet?: number | null
          created_at?: string | null
          height_mm?: number
          id?: string
          in_stock?: boolean | null
          material_id?: string
          quantity?: number | null
          supplier?: string | null
          thickness_mm?: number
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "sheet_sizes_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string | null
          file_size_bytes: number | null
          file_type: string | null
          filename: string
          id: string
          metadata: Json | null
          status: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          filename: string
          id?: string
          metadata?: Json | null
          status?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          metadata?: Json | null
          status?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          brand_color: string
          created_at: string | null
          currency: string
          default_markup_percent: number
          next_quote_number: number
          quote_expiry_days: number
          quote_prefix: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          brand_color?: string
          created_at?: string | null
          currency?: string
          default_markup_percent?: number
          next_quote_number?: number
          quote_expiry_days?: number
          quote_prefix?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          brand_color?: string
          created_at?: string | null
          currency?: string
          default_markup_percent?: number
          next_quote_number?: number
          quote_expiry_days?: number
          quote_prefix?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      waitlist_submissions: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const


export type MaterialCategory =
  | "stainless"
  | "mild_steel"
  | "aluminum"
  | "copper"
  | "brass"
  | "other";

export type MachineType = "laser" | "waterjet" | "plasma" | "router" | "pressbrake" | "punch" | "other";

export type Currency = "USD" | "EUR" | "GBP" | "CAD" | "AUD";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
};

export type MachineProfile = Database["public"]["Tables"]["machine_profiles"]["Row"];
export type Material = Database["public"]["Tables"]["materials"]["Row"];
export type Quote = Database["public"]["Tables"]["quotes"]["Row"];
export type QuoteAttachment = Database["public"]["Tables"]["quote_attachments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];
export type Customer = Database["public"]["Tables"]["customers"]["Row"];
