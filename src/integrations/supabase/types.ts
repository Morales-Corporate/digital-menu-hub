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
      categorias: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
          orden?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: []
      }
      cierres_caja: {
        Row: {
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          ordenes_canceladas: number
          ordenes_entregadas: number
          total_efectivo: number
          total_tarjeta: number
          total_ventas: number
          total_yape_plin: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha: string
          id?: string
          ordenes_canceladas?: number
          ordenes_entregadas?: number
          total_efectivo?: number
          total_tarjeta?: number
          total_ventas?: number
          total_yape_plin?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          ordenes_canceladas?: number
          ordenes_entregadas?: number
          total_efectivo?: number
          total_tarjeta?: number
          total_ventas?: number
          total_yape_plin?: number
        }
        Relationships: []
      }
      descuentos_activos: {
        Row: {
          created_at: string | null
          id: string
          orden_id: string | null
          puntos_usados: number
          recompensa_id: string
          usado: boolean | null
          usado_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          orden_id?: string | null
          puntos_usados: number
          recompensa_id: string
          usado?: boolean | null
          usado_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          orden_id?: string | null
          puntos_usados?: number
          recompensa_id?: string
          usado?: boolean | null
          usado_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "descuentos_activos_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "descuentos_activos_recompensa_id_fkey"
            columns: ["recompensa_id"]
            isOneToOne: false
            referencedRelation: "recompensas"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_caja: {
        Row: {
          created_at: string
          created_by: string | null
          fecha: string
          id: string
          monto: number
          motivo: string
          tipo: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          monto: number
          motivo: string
          tipo: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fecha?: string
          id?: string
          monto?: number
          motivo?: string
          tipo?: string
        }
        Relationships: []
      }
      orden_items: {
        Row: {
          cantidad: number
          created_at: string | null
          id: string
          orden_id: string
          precio_unitario: number
          producto_id: string | null
        }
        Insert: {
          cantidad?: number
          created_at?: string | null
          id?: string
          orden_id: string
          precio_unitario: number
          producto_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          id?: string
          orden_id?: string
          precio_unitario?: number
          producto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orden_items_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orden_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      ordenes: {
        Row: {
          comprobante_pago: string | null
          created_at: string | null
          es_invitado: boolean | null
          estado: string
          id: string
          metodo_pago: string | null
          monto_pago: number | null
          motivo_cancelacion: string | null
          nombre_invitado: string | null
          numero_mesa: number | null
          puntos_ganados: number
          telefono_invitado: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          comprobante_pago?: string | null
          created_at?: string | null
          es_invitado?: boolean | null
          estado?: string
          id?: string
          metodo_pago?: string | null
          monto_pago?: number | null
          motivo_cancelacion?: string | null
          nombre_invitado?: string | null
          numero_mesa?: number | null
          puntos_ganados?: number
          telefono_invitado?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
          comprobante_pago?: string | null
          created_at?: string | null
          es_invitado?: boolean | null
          estado?: string
          id?: string
          metodo_pago?: string | null
          monto_pago?: number | null
          motivo_cancelacion?: string | null
          nombre_invitado?: string | null
          numero_mesa?: number | null
          puntos_ganados?: number
          telefono_invitado?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      productos: {
        Row: {
          categoria_id: string | null
          created_at: string | null
          descripcion: string | null
          disponible: boolean | null
          id: string
          imagen_url: string | null
          nombre: string
          precio: number
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          disponible?: boolean | null
          id?: string
          imagen_url?: string | null
          nombre: string
          precio?: number
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          categoria_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          disponible?: boolean | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio?: number
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          direccion: string | null
          dni: string | null
          email: string | null
          fecha_nacimiento: string | null
          full_name: string | null
          id: string
          latitud: number | null
          longitud: number | null
          referencia_direccion: string | null
          telefono: string | null
          tipo_comprobante: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          fecha_nacimiento?: string | null
          full_name?: string | null
          id: string
          latitud?: number | null
          longitud?: number | null
          referencia_direccion?: string | null
          telefono?: string | null
          tipo_comprobante?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          direccion?: string | null
          dni?: string | null
          email?: string | null
          fecha_nacimiento?: string | null
          full_name?: string | null
          id?: string
          latitud?: number | null
          longitud?: number | null
          referencia_direccion?: string | null
          telefono?: string | null
          tipo_comprobante?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      puntos_usuario: {
        Row: {
          created_at: string | null
          id: string
          puntos_totales: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          puntos_totales?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          puntos_totales?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      recompensas: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          nombre: string
          porcentaje_descuento: number
          puntos_requeridos: number
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre: string
          porcentaje_descuento: number
          puntos_requeridos: number
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre?: string
          porcentaje_descuento?: number
          puntos_requeridos?: number
          updated_at?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
