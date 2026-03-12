export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      user_favorites: {
        Row: {
          id: string;
          user_id: string;
          listing_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          listing_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          listing_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      user_saved_searches: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          filters: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          filters: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          filters?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
      price_alerts: {
        Row: {
          id: string;
          user_id: string | null;
          client_id: string | null;
          listing_id: string;
          target_price: number;
          is_active: boolean;
          notified_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          client_id?: string | null;
          listing_id: string;
          target_price: number;
          is_active?: boolean;
          notified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          client_id?: string | null;
          listing_id?: string;
          target_price?: number;
          is_active?: boolean;
          notified_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      price_history: {
        Row: {
          id: string;
          listing_id: string;
          price: number;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          price: number;
          recorded_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          price?: number;
          recorded_at?: string;
        };
        Relationships: [];
      };
      api_rate_limits: {
        Row: {
          id: string;
          client_key: string;
          action: string;
          request_count: number;
          window_start: string;
          last_request: string;
        };
        Insert: {
          id?: string;
          client_key: string;
          action: string;
          request_count?: number;
          window_start?: string;
          last_request?: string;
        };
        Update: {
          id?: string;
          client_key?: string;
          action?: string;
          request_count?: number;
          window_start?: string;
          last_request?: string;
        };
        Relationships: [];
      };
      car_listings: {
        Row: {
          body_type: string | null;
          brand: string;
          color: string | null;
          condition: string | null;
          created_at: string;
          description: string | null;
          detail_scraped: boolean | null;
          doors: number | null;
          extra_data: Record<string, unknown> | null;
          emission_class: string | null;
          fuel: string | null;
          id: string;
          image_url: string | null;
          image_urls: string[] | null;
          is_best_deal: boolean | null;
          is_new: boolean | null;
          km: number;
          location: string | null;
          model: string;
          power: string | null;
          price: number;
          price_rating: string | null;
          scraped_at: string;
          seats: number | null;
          source: string;
          source_url: string | null;
          title: string;
          transmission: string | null;
          trim: string | null;
          version: string | null;
          year: number;
        };
        Insert: {
          body_type?: string | null;
          brand: string;
          color?: string | null;
          condition?: string | null;
          created_at?: string;
          description?: string | null;
          detail_scraped?: boolean | null;
          doors?: number | null;
          emission_class?: string | null;
          extra_data?: Record<string, unknown> | null;
          fuel?: string | null;
          id?: string;
          image_url?: string | null;
          image_urls?: string[] | null;
          is_best_deal?: boolean | null;
          is_new?: boolean | null;
          km: number;
          location?: string | null;
          model: string;
          power?: string | null;
          price: number;
          price_rating?: string | null;
          scraped_at?: string;
          seats?: number | null;
          source: string;
          source_url?: string | null;
          title: string;
          transmission?: string | null;
          trim?: string | null;
          version?: string | null;
          year: number;
        };
        Update: {
          body_type?: string | null;
          brand?: string;
          color?: string | null;
          condition?: string | null;
          created_at?: string;
          description?: string | null;
          detail_scraped?: boolean | null;
          doors?: number | null;
          emission_class?: string | null;
          extra_data?: Record<string, unknown> | null;
          fuel?: string | null;
          id?: string;
          image_url?: string | null;
          image_urls?: string[] | null;
          is_best_deal?: boolean | null;
          is_new?: boolean | null;
          km?: number;
          location?: string | null;
          model?: string;
          power?: string | null;
          price?: number;
          price_rating?: string | null;
          scraped_at?: string;
          seats?: number | null;
          source?: string;
          source_url?: string | null;
          title?: string;
          transmission?: string | null;
          trim?: string | null;
          version?: string | null;
          year?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
