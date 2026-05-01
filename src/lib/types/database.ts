// Auto-generated from Supabase — DO NOT EDIT MANUALLY
// Run `mcp_supabase_generate_typescript_types` to regenerate

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.5" };
  public: {
    Tables: {
      machine_profiles: {
        Row: {
          cost_per_bend: number | null;
          created_at: string | null;
          feed_rates: Json | null;
          hourly_rate: number;
          id: string;
          is_default: boolean | null;
          is_system: boolean | null;
          machine_type: string | null;
          name: string;
          pierce_time_seconds: number | null;
          power_kw: number | null;
          setup_time_minutes: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          cost_per_bend?: number | null;
          feed_rates?: Json | null;
          hourly_rate?: number;
          id?: string;
          is_default?: boolean | null;
          is_system?: boolean | null;
          machine_type?: string | null;
          name: string;
          pierce_time_seconds?: number | null;
          power_kw?: number | null;
          setup_time_minutes?: number | null;
          user_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["machine_profiles"]["Insert"]>;
        Relationships: [];
      };
      quote_attachments: {
        Row: {
          id: string;
          quote_id: string;
          upload_id: string;
          filename: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          quote_id: string;
          upload_id: string;
          filename: string;
          created_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["quote_attachments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "quote_attachments_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quote_attachments_upload_id_fkey";
            columns: ["upload_id"];
            isOneToOne: false;
            referencedRelation: "uploads";
            referencedColumns: ["id"];
          }
        ];
      };
      materials: {
        Row: {
          category: string;
          color_hex: string | null;
          cost_per_kg: number;
          created_at: string | null;
          density_kg_m3: number;
          grade: string | null;
          id: string;
          is_active: boolean | null;
          is_system: boolean | null;
          k_factor: number | null;
          metalness: number | null;
          name: string;
          notes: string | null;
          roughness: number | null;
          scrap_value_per_kg: number | null;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          category: string;
          color_hex?: string | null;
          cost_per_kg: number;
          density_kg_m3: number;
          grade?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_system?: boolean | null;
          k_factor?: number | null;
          metalness?: number | null;
          name: string;
          notes?: string | null;
          roughness?: number | null;
          scrap_value_per_kg?: number | null;
          user_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["materials"]["Insert"]>;
        Relationships: [];
      };
      quotes: {
        Row: {
          bend_count: number | null;
          bending_cost: number | null;
          bounding_height_mm: number | null;
          bounding_width_mm: number | null;
          created_at: string | null;
          customer_email: string | null;
          customer_name: string | null;
          customer_ref: string | null;
          cutting_cost: number | null;
          expires_at: string | null;
          filename: string;
          id: string;
          input_type: string;
          machine_id: string | null;
          markup_percent: number | null;
          material_cost: number | null;
          material_id: string | null;
          notes: string | null;
          part_area_mm2: number | null;
          perimeter_mm: number | null;
          pierce_count: number | null;
          quantity: number | null;
          setup_cost: number | null;
          share_token: string | null;
          share_enabled: boolean | null;
          status: string | null;
          thickness_mm: number | null;
          total_price: number | null;
          unit_price: number | null;
          updated_at: string | null;
          upload_id: string | null;
          user_id: string;
        };
        Insert: {
          bend_count?: number | null;
          bounding_height_mm?: number | null;
          bounding_width_mm?: number | null;
          filename: string;
          id?: string;
          input_type: string;
          machine_id?: string | null;
          markup_percent?: number | null;
          material_id?: string | null;
          part_area_mm2?: number | null;
          perimeter_mm?: number | null;
          pierce_count?: number | null;
          quantity?: number | null;
          status?: string | null;
          thickness_mm?: number | null;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
        Relationships: [];
      };
      remnants: {
        Row: {
          created_at: string | null;
          height_mm: number;
          id: string;
          location: string | null;
          material_id: string | null;
          notes: string | null;
          qr_code_data: string | null;
          source_quote_id: string | null;
          status: string | null;
          thickness_mm: number;
          updated_at: string | null;
          user_id: string;
          width_mm: number;
        };
        Insert: {
          height_mm: number;
          id?: string;
          location?: string | null;
          material_id?: string | null;
          status?: string | null;
          thickness_mm: number;
          user_id: string;
          width_mm: number;
        };
        Update: Partial<Database["public"]["Tables"]["remnants"]["Insert"]>;
        Relationships: [];
      };
      sheet_sizes: {
        Row: {
          cost_per_sheet: number | null;
          created_at: string | null;
          height_mm: number;
          id: string;
          in_stock: boolean | null;
          material_id: string;
          quantity: number | null;
          supplier: string | null;
          thickness_mm: number;
          width_mm: number;
        };
        Insert: {
          cost_per_sheet?: number | null;
          height_mm: number;
          id?: string;
          in_stock?: boolean | null;
          material_id: string;
          quantity?: number | null;
          supplier?: string | null;
          thickness_mm: number;
          width_mm: number;
        };
        Update: Partial<Database["public"]["Tables"]["sheet_sizes"]["Insert"]>;
        Relationships: [];
      };
      uploads: {
        Row: {
          created_at: string | null;
          file_size_bytes: number | null;
          file_type: string | null;
          filename: string;
          id: string;
          metadata: Json | null;
          status: string | null;
          storage_path: string;
          user_id: string;
        };
        Insert: {
          filename: string;
          id?: string;
          storage_path: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["uploads"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          address_line1: string | null;
          address_line2: string | null;
          avatar_url: string | null;
          company: string | null;
          created_at: string | null;
          full_name: string | null;
          id: string;
          logo_url: string | null;
          phone: string | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          company?: string | null;
          address_line1?: string | null;
          address_line2?: string | null;
          logo_url?: string | null;
          phone?: string | null;
          website?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          user_id: string;
          default_markup_percent: number;
          quote_expiry_days: number;
          currency: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          default_markup_percent?: number;
          quote_expiry_days?: number;
          currency?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { is_admin: { Args: never; Returns: boolean } };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// Convenience row types
export type Material = Database["public"]["Tables"]["materials"]["Row"];
export type MaterialInsert = Database["public"]["Tables"]["materials"]["Insert"];
export type SheetSize = Database["public"]["Tables"]["sheet_sizes"]["Row"];
export type MachineProfile = Database["public"]["Tables"]["machine_profiles"]["Row"];
export type Quote = Database["public"]["Tables"]["quotes"]["Row"];
export type Remnant = Database["public"]["Tables"]["remnants"]["Row"];
export type Upload = Database["public"]["Tables"]["uploads"]["Row"];
export type QuoteAttachment = Database["public"]["Tables"]["quote_attachments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"];

export type MaterialCategory =
  | "stainless"
  | "aluminum"
  | "mild_steel"
  | "copper"
  | "brass"
  | "other";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type RemnantStatus = "available" | "reserved" | "consumed" | "scrapped";
export type MachineType = "laser" | "waterjet" | "plasma" | "punch";
export type Currency = "GBP" | "EUR" | "USD";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};
