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
      attendance: {
        Row: {
          created_at: string
          id: string
          jenis: string
          latitude: number | null
          longitude: number | null
          nama_lokasi: string | null
          photo_url: string | null
          tanggal: string
          user_id: string
          waktu: string
        }
        Insert: {
          created_at?: string
          id?: string
          jenis: string
          latitude?: number | null
          longitude?: number | null
          nama_lokasi?: string | null
          photo_url?: string | null
          tanggal?: string
          user_id: string
          waktu?: string
        }
        Update: {
          created_at?: string
          id?: string
          jenis?: string
          latitude?: number | null
          longitude?: number | null
          nama_lokasi?: string | null
          photo_url?: string | null
          tanggal?: string
          user_id?: string
          waktu?: string
        }
        Relationships: []
      }
      dudi_akun: {
        Row: {
          created_at: string
          id: string
          nama_tempat: string
          pin: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nama_tempat: string
          pin?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nama_tempat?: string
          pin?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      guru_favorit_siswa: {
        Row: {
          created_at: string
          guru_id: string
          id: string
          siswa_id: string
        }
        Insert: {
          created_at?: string
          guru_id: string
          id?: string
          siswa_id: string
        }
        Update: {
          created_at?: string
          guru_id?: string
          id?: string
          siswa_id?: string
        }
        Relationships: []
      }
      ortu_link: {
        Row: {
          created_at: string
          id: string
          ortu_user_id: string
          siswa_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ortu_user_id: string
          siswa_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ortu_user_id?: string
          siswa_user_id?: string
        }
        Relationships: []
      }
      ortu_otp: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          kode: string
          no_hp: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at: string
          kode: string
          no_hp: string
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          kode?: string
          no_hp?: string
        }
        Relationships: []
      }
      pin_lockout: {
        Row: {
          failed_count: number
          last_failed_at: string
          locked_until: string | null
          user_id: string
        }
        Insert: {
          failed_count?: number
          last_failed_at?: string
          locked_until?: string | null
          user_id: string
        }
        Update: {
          failed_count?: number
          last_failed_at?: string
          locked_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          kelas: string | null
          nama_siswa: string | null
          no_hp_dudi: string | null
          no_hp_guru: string | null
          no_hp_ortu: string | null
          no_hp_siswa: string | null
          pin: string
          pin_ortu: string
          tempat_magang: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          kelas?: string | null
          nama_siswa?: string | null
          no_hp_dudi?: string | null
          no_hp_guru?: string | null
          no_hp_ortu?: string | null
          no_hp_siswa?: string | null
          pin?: string
          pin_ortu?: string
          tempat_magang?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kelas?: string | null
          nama_siswa?: string | null
          no_hp_dudi?: string | null
          no_hp_guru?: string | null
          no_hp_ortu?: string | null
          no_hp_siswa?: string | null
          pin?: string
          pin_ortu?: string
          tempat_magang?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform?: string | null
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      siswa: {
        Row: {
          created_at: string
          id: string
          kelas: string | null
          nama_lengkap: string
          nisn: string | null
          password_login: string
          pin: string
          status_akun: string
          tempat_pkl: string | null
          updated_at: string
          user_id: string | null
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          kelas?: string | null
          nama_lengkap: string
          nisn?: string | null
          password_login: string
          pin?: string
          status_akun?: string
          tempat_pkl?: string | null
          updated_at?: string
          user_id?: string | null
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          kelas?: string | null
          nama_lengkap?: string
          nisn?: string | null
          password_login?: string
          pin?: string
          status_akun?: string
          tempat_pkl?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wa_reminder_log: {
        Row: {
          detail: string | null
          id: string
          sent_at: string
          status: string
          tahap: string
          tanggal: string
          user_id: string
        }
        Insert: {
          detail?: string | null
          id?: string
          sent_at?: string
          status?: string
          tahap: string
          tanggal?: string
          user_id: string
        }
        Update: {
          detail?: string | null
          id?: string
          sent_at?: string
          status?: string
          tahap?: string
          tanggal?: string
          user_id?: string
        }
        Relationships: []
      }
      wa_schedule_overrides: {
        Row: {
          disable_all: boolean
          hari_aktif: number[] | null
          siswa_user_id: string
          skip_dudi: boolean
          skip_guru: boolean
          skip_ortu: boolean
          skip_pulang: boolean
          skip_siswa: boolean
          tanggal_libur: string[]
          updated_at: string
        }
        Insert: {
          disable_all?: boolean
          hari_aktif?: number[] | null
          siswa_user_id: string
          skip_dudi?: boolean
          skip_guru?: boolean
          skip_ortu?: boolean
          skip_pulang?: boolean
          skip_siswa?: boolean
          tanggal_libur?: string[]
          updated_at?: string
        }
        Update: {
          disable_all?: boolean
          hari_aktif?: number[] | null
          siswa_user_id?: string
          skip_dudi?: boolean
          skip_guru?: boolean
          skip_ortu?: boolean
          skip_pulang?: boolean
          skip_siswa?: boolean
          tanggal_libur?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      wa_schedule_settings: {
        Row: {
          aktif_dudi: boolean
          aktif_guru: boolean
          aktif_ortu: boolean
          aktif_pulang: boolean
          aktif_siswa: boolean
          fonnte_sender: string | null
          fonnte_token: string | null
          hari_aktif: number[]
          id: number
          jam_dudi: string
          jam_guru: string
          jam_ortu: string
          jam_pulang: string
          jam_siswa: string
          jeda_menit: number
          sender_phone: string | null
          template_dudi: string
          template_guru: string
          template_ortu: string
          template_pulang: string
          template_siswa: string
          updated_at: string
        }
        Insert: {
          aktif_dudi?: boolean
          aktif_guru?: boolean
          aktif_ortu?: boolean
          aktif_pulang?: boolean
          aktif_siswa?: boolean
          fonnte_sender?: string | null
          fonnte_token?: string | null
          hari_aktif?: number[]
          id?: number
          jam_dudi?: string
          jam_guru?: string
          jam_ortu?: string
          jam_pulang?: string
          jam_siswa?: string
          jeda_menit?: number
          sender_phone?: string | null
          template_dudi?: string
          template_guru?: string
          template_ortu?: string
          template_pulang?: string
          template_siswa?: string
          updated_at?: string
        }
        Update: {
          aktif_dudi?: boolean
          aktif_guru?: boolean
          aktif_ortu?: boolean
          aktif_pulang?: boolean
          aktif_siswa?: boolean
          fonnte_sender?: string | null
          fonnte_token?: string | null
          hari_aktif?: number[]
          id?: number
          jam_dudi?: string
          jam_guru?: string
          jam_ortu?: string
          jam_pulang?: string
          jam_siswa?: string
          jeda_menit?: number
          sender_phone?: string | null
          template_dudi?: string
          template_guru?: string
          template_ortu?: string
          template_pulang?: string
          template_siswa?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      export_auth_users: {
        Args: { _limit: number; _offset: number }
        Returns: Json
      }
      finalize_role_import: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_auth_user: { Args: { _u: Json }; Returns: undefined }
      is_dudi_of_siswa: {
        Args: { _dudi: string; _siswa: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "siswa" | "guru" | "admin" | "ortu" | "dudi"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["siswa", "guru", "admin", "ortu", "dudi"],
    },
  },
} as const
