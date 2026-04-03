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
      alertas_stock: {
        Row: {
          created_at: string | null
          id: string
          insumo_id: string
          leida: boolean
          mensaje: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          insumo_id: string
          leida?: boolean
          mensaje: string
        }
        Update: {
          created_at?: string | null
          id?: string
          insumo_id?: string
          leida?: boolean
          mensaje?: string
        }
        Relationships: [
          {
            foreignKeyName: "alertas_stock_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_stock_config: {
        Row: {
          created_at: string | null
          email_destino: string | null
          id: string
          notificar_email: boolean
          notificar_sistema: boolean
          umbral_porcentaje: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email_destino?: string | null
          id?: string
          notificar_email?: boolean
          notificar_sistema?: boolean
          umbral_porcentaje?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email_destino?: string | null
          id?: string
          notificar_email?: boolean
          notificar_sistema?: boolean
          umbral_porcentaje?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      aperturas_caja: {
        Row: {
          created_at: string
          created_by: string | null
          diferencia: number | null
          efectivo_esperado: number
          efectivo_real: number | null
          estado: string
          fecha_apertura: string
          fecha_cierre: string | null
          id: string
          monto_inicial: number
          observacion: string | null
          ordenes_canceladas: number
          ordenes_entregadas: number
          tipo_apertura: string
          tipo_cierre: string | null
          total_efectivo: number
          total_retiros: number
          total_tarjeta: number
          total_ventas: number
          total_yape_plin: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          diferencia?: number | null
          efectivo_esperado?: number
          efectivo_real?: number | null
          estado?: string
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_inicial?: number
          observacion?: string | null
          ordenes_canceladas?: number
          ordenes_entregadas?: number
          tipo_apertura?: string
          tipo_cierre?: string | null
          total_efectivo?: number
          total_retiros?: number
          total_tarjeta?: number
          total_ventas?: number
          total_yape_plin?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          diferencia?: number | null
          efectivo_esperado?: number
          efectivo_real?: number | null
          estado?: string
          fecha_apertura?: string
          fecha_cierre?: string | null
          id?: string
          monto_inicial?: number
          observacion?: string | null
          ordenes_canceladas?: number
          ordenes_entregadas?: number
          tipo_apertura?: string
          tipo_cierre?: string | null
          total_efectivo?: number
          total_retiros?: number
          total_tarjeta?: number
          total_ventas?: number
          total_yape_plin?: number
        }
        Relationships: []
      }
      asignacion_mesas: {
        Row: {
          created_at: string | null
          fecha: string
          id: string
          mesa_fin: number
          mesa_inicio: number
          mesero_id: string
          turno: string
        }
        Insert: {
          created_at?: string | null
          fecha?: string
          id?: string
          mesa_fin: number
          mesa_inicio: number
          mesero_id: string
          turno?: string
        }
        Update: {
          created_at?: string | null
          fecha?: string
          id?: string
          mesa_fin?: number
          mesa_inicio?: number
          mesero_id?: string
          turno?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignacion_mesas_mesero_id_fkey"
            columns: ["mesero_id"]
            isOneToOne: false
            referencedRelation: "meseros"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          created_at: string | null
          id: string
          nombre: string
          orden: number | null
          parent_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          nombre: string
          orden?: number | null
          parent_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
        ]
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
      compras_insumos: {
        Row: {
          cantidad: number
          costo_total: number
          costo_unitario: number
          created_at: string | null
          created_by: string | null
          id: string
          insumo_id: string
          nota: string | null
          proveedor: string | null
        }
        Insert: {
          cantidad: number
          costo_total?: number
          costo_unitario?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          insumo_id: string
          nota?: string | null
          proveedor?: string | null
        }
        Update: {
          cantidad?: number
          costo_total?: number
          costo_unitario?: number
          created_at?: string | null
          created_by?: string | null
          id?: string
          insumo_id?: string
          nota?: string | null
          proveedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_insumos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
        ]
      }
      comprobantes: {
        Row: {
          anulado: boolean | null
          cliente_direccion: string | null
          cliente_documento: string | null
          cliente_nombre: string | null
          cliente_razon_social: string | null
          cliente_ruc: string | null
          created_at: string | null
          created_by: string | null
          id: string
          igv: number
          numero: number
          orden_id: string | null
          serie: string
          subtotal: number
          tipo: string
          total: number
        }
        Insert: {
          anulado?: boolean | null
          cliente_direccion?: string | null
          cliente_documento?: string | null
          cliente_nombre?: string | null
          cliente_razon_social?: string | null
          cliente_ruc?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          igv?: number
          numero: number
          orden_id?: string | null
          serie: string
          subtotal?: number
          tipo: string
          total?: number
        }
        Update: {
          anulado?: boolean | null
          cliente_direccion?: string | null
          cliente_documento?: string | null
          cliente_nombre?: string | null
          cliente_razon_social?: string | null
          cliente_ruc?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          igv?: number
          numero?: number
          orden_id?: string | null
          serie?: string
          subtotal?: number
          tipo?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "comprobantes_orden_id_fkey"
            columns: ["orden_id"]
            isOneToOne: false
            referencedRelation: "ordenes"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracion_empresa: {
        Row: {
          created_at: string | null
          direccion: string | null
          email: string | null
          estados_pedido_visibles: string[]
          id: string
          logo_url: string | null
          mensaje_pie: string | null
          nombre_comercial: string
          numero_boleta: number | null
          numero_factura: number | null
          razon_social: string | null
          ruc: string | null
          serie_boleta: string | null
          serie_factura: string | null
          telefono: string | null
          tipo_negocio: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          estados_pedido_visibles?: string[]
          id?: string
          logo_url?: string | null
          mensaje_pie?: string | null
          nombre_comercial: string
          numero_boleta?: number | null
          numero_factura?: number | null
          razon_social?: string | null
          ruc?: string | null
          serie_boleta?: string | null
          serie_factura?: string | null
          telefono?: string | null
          tipo_negocio?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          direccion?: string | null
          email?: string | null
          estados_pedido_visibles?: string[]
          id?: string
          logo_url?: string | null
          mensaje_pie?: string | null
          nombre_comercial?: string
          numero_boleta?: number | null
          numero_factura?: number | null
          razon_social?: string | null
          ruc?: string | null
          serie_boleta?: string | null
          serie_factura?: string | null
          telefono?: string | null
          tipo_negocio?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      costos_operativos: {
        Row: {
          activo: boolean
          categoria: string
          created_at: string | null
          id: string
          monto: number
          nombre: string
          periodo: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          categoria?: string
          created_at?: string | null
          id?: string
          monto?: number
          nombre: string
          periodo?: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          categoria?: string
          created_at?: string | null
          id?: string
          monto?: number
          nombre?: string
          periodo?: string
          updated_at?: string | null
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
      insumos: {
        Row: {
          costo_por_unidad: number
          created_at: string | null
          id: string
          nombre: string
          stock_actual: number
          stock_inicial_referencia: number | null
          stock_minimo: number
          unidad_medida: string
          updated_at: string | null
        }
        Insert: {
          costo_por_unidad?: number
          created_at?: string | null
          id?: string
          nombre: string
          stock_actual?: number
          stock_inicial_referencia?: number | null
          stock_minimo?: number
          unidad_medida?: string
          updated_at?: string | null
        }
        Update: {
          costo_por_unidad?: number
          created_at?: string | null
          id?: string
          nombre?: string
          stock_actual?: number
          stock_inicial_referencia?: number | null
          stock_minimo?: number
          unidad_medida?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      menu_opcion_items: {
        Row: {
          categoria_id: string | null
          costo_adicional: number | null
          created_at: string | null
          id: string
          menu_opcion_id: string
          producto_id: string | null
        }
        Insert: {
          categoria_id?: string | null
          costo_adicional?: number | null
          created_at?: string | null
          id?: string
          menu_opcion_id: string
          producto_id?: string | null
        }
        Update: {
          categoria_id?: string | null
          costo_adicional?: number | null
          created_at?: string | null
          id?: string
          menu_opcion_id?: string
          producto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_opcion_items_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_opcion_items_menu_opcion_id_fkey"
            columns: ["menu_opcion_id"]
            isOneToOne: false
            referencedRelation: "menu_opciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_opcion_items_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_opciones: {
        Row: {
          cantidad: number | null
          categoria_id: string | null
          created_at: string | null
          id: string
          menu_id: string
          nombre: string
          orden: number | null
        }
        Insert: {
          cantidad?: number | null
          categoria_id?: string | null
          created_at?: string | null
          id?: string
          menu_id: string
          nombre: string
          orden?: number | null
        }
        Update: {
          cantidad?: number | null
          categoria_id?: string | null
          created_at?: string | null
          id?: string
          menu_id?: string
          nombre?: string
          orden?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_opciones_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_opciones_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          activo: boolean | null
          created_at: string | null
          descripcion: string | null
          id: string
          imagen_url: string | null
          nombre: string
          precio: number
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre: string
          precio?: number
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          nombre?: string
          precio?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      meseros: {
        Row: {
          activo: boolean | null
          created_at: string | null
          id: string
          nombre: string
          telefono: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre: string
          telefono?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          id?: string
          nombre?: string
          telefono?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      modulos: {
        Row: {
          activo: boolean
          clave: string
          created_at: string | null
          grupo: string | null
          icono: string | null
          id: string
          nombre: string
          orden: number | null
          ruta: string | null
        }
        Insert: {
          activo?: boolean
          clave: string
          created_at?: string | null
          grupo?: string | null
          icono?: string | null
          id?: string
          nombre: string
          orden?: number | null
          ruta?: string | null
        }
        Update: {
          activo?: boolean
          clave?: string
          created_at?: string | null
          grupo?: string | null
          icono?: string | null
          id?: string
          nombre?: string
          orden?: number | null
          ruta?: string | null
        }
        Relationships: []
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
          nota: string | null
          orden_id: string
          precio_unitario: number
          producto_id: string | null
        }
        Insert: {
          cantidad?: number
          created_at?: string | null
          id?: string
          nota?: string | null
          orden_id: string
          precio_unitario: number
          producto_id?: string | null
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          id?: string
          nota?: string | null
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
          entregado_at: string | null
          es_invitado: boolean | null
          estado: string
          id: string
          mesero_id: string | null
          metodo_pago: string | null
          monto_pago: number | null
          motivo_cancelacion: string | null
          nombre_invitado: string | null
          notas: string | null
          numero_mesa: number | null
          puntos_ganados: number
          telefono_invitado: string | null
          total: number
          user_id: string | null
        }
        Insert: {
          comprobante_pago?: string | null
          created_at?: string | null
          entregado_at?: string | null
          es_invitado?: boolean | null
          estado?: string
          id?: string
          mesero_id?: string | null
          metodo_pago?: string | null
          monto_pago?: number | null
          motivo_cancelacion?: string | null
          nombre_invitado?: string | null
          notas?: string | null
          numero_mesa?: number | null
          puntos_ganados?: number
          telefono_invitado?: string | null
          total?: number
          user_id?: string | null
        }
        Update: {
          comprobante_pago?: string | null
          created_at?: string | null
          entregado_at?: string | null
          es_invitado?: boolean | null
          estado?: string
          id?: string
          mesero_id?: string | null
          metodo_pago?: string | null
          monto_pago?: number | null
          motivo_cancelacion?: string | null
          nombre_invitado?: string | null
          notas?: string | null
          numero_mesa?: number | null
          puntos_ganados?: number
          telefono_invitado?: string | null
          total?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordenes_mesero_id_fkey"
            columns: ["mesero_id"]
            isOneToOne: false
            referencedRelation: "meseros"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_insumos: {
        Row: {
          cantidad: number
          created_at: string | null
          id: string
          insumo_id: string
          producto_id: string
        }
        Insert: {
          cantidad?: number
          created_at?: string | null
          id?: string
          insumo_id: string
          producto_id: string
        }
        Update: {
          cantidad?: number
          created_at?: string | null
          id?: string
          insumo_id?: string
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producto_insumos_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "insumos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "producto_insumos_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          alergenos: string[] | null
          categoria_id: string | null
          created_at: string | null
          descripcion: string | null
          disponible: boolean | null
          id: string
          imagen_url: string | null
          ingredientes: string | null
          is_combo_item: boolean | null
          nombre: string
          precio: number
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          alergenos?: string[] | null
          categoria_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          disponible?: boolean | null
          id?: string
          imagen_url?: string | null
          ingredientes?: string | null
          is_combo_item?: boolean | null
          nombre: string
          precio?: number
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          alergenos?: string[] | null
          categoria_id?: string | null
          created_at?: string | null
          descripcion?: string | null
          disponible?: boolean | null
          id?: string
          imagen_url?: string | null
          ingredientes?: string | null
          is_combo_item?: boolean | null
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
      rol_permisos: {
        Row: {
          acciones_especiales: Json | null
          crear: boolean
          created_at: string | null
          editar: boolean
          eliminar: boolean
          id: string
          modulo_id: string
          rol_id: string
          updated_at: string | null
          ver: boolean
        }
        Insert: {
          acciones_especiales?: Json | null
          crear?: boolean
          created_at?: string | null
          editar?: boolean
          eliminar?: boolean
          id?: string
          modulo_id: string
          rol_id: string
          updated_at?: string | null
          ver?: boolean
        }
        Update: {
          acciones_especiales?: Json | null
          crear?: boolean
          created_at?: string | null
          editar?: boolean
          eliminar?: boolean
          id?: string
          modulo_id?: string
          rol_id?: string
          updated_at?: string | null
          ver?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "rol_permisos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rol_permisos_rol_id_fkey"
            columns: ["rol_id"]
            isOneToOne: false
            referencedRelation: "roles_custom"
            referencedColumns: ["id"]
          },
        ]
      }
      roles_custom: {
        Row: {
          activo: boolean
          created_at: string | null
          descripcion: string | null
          es_sistema: boolean
          id: string
          nombre: string
          updated_at: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string | null
          descripcion?: string | null
          es_sistema?: boolean
          id?: string
          nombre: string
          updated_at?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string | null
          descripcion?: string | null
          es_sistema?: boolean
          id?: string
          nombre?: string
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
      app_role: "admin" | "user" | "mesero" | "cocina"
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
      app_role: ["admin", "user", "mesero", "cocina"],
    },
  },
} as const
