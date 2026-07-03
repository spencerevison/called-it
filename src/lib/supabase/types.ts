export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      checkin_failures: {
        Row: {
          attribution: Database["public"]["Enums"]["attribution"]
          checkin_id: string
          created_at: string
          description: string
          id: string
          linked_risk_id: string | null
          user_id: string
          was_knowable: boolean
        }
        Insert: {
          attribution: Database["public"]["Enums"]["attribution"]
          checkin_id: string
          created_at?: string
          description: string
          id?: string
          linked_risk_id?: string | null
          user_id: string
          was_knowable?: boolean
        }
        Update: {
          attribution?: Database["public"]["Enums"]["attribution"]
          checkin_id?: string
          created_at?: string
          description?: string
          id?: string
          linked_risk_id?: string | null
          user_id?: string
          was_knowable?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "checkin_failures_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkin_failures_linked_risk_id_fkey"
            columns: ["linked_risk_id"]
            isOneToOne: false
            referencedRelation: "premortem_risks"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          completed_at: string | null
          created_at: string
          decision_id: string
          horizon: Database["public"]["Enums"]["checkin_horizon"]
          id: string
          outcome_notes: string | null
          overall_attribution: Database["public"]["Enums"]["attribution"] | null
          scheduled_for: string
          status: Database["public"]["Enums"]["checkin_status"]
          trigger_run_id: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          decision_id: string
          horizon: Database["public"]["Enums"]["checkin_horizon"]
          id?: string
          outcome_notes?: string | null
          overall_attribution?:
            | Database["public"]["Enums"]["attribution"]
            | null
          scheduled_for: string
          status?: Database["public"]["Enums"]["checkin_status"]
          trigger_run_id?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          decision_id?: string
          horizon?: Database["public"]["Enums"]["checkin_horizon"]
          id?: string
          outcome_notes?: string | null
          overall_attribution?:
            | Database["public"]["Enums"]["attribution"]
            | null
          scheduled_for?: string
          status?: Database["public"]["Enums"]["checkin_status"]
          trigger_run_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_events: {
        Row: {
          created_at: string
          decision_id: string
          event_type: Database["public"]["Enums"]["decision_event_type"]
          id: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          event_type: Database["public"]["Enums"]["decision_event_type"]
          id?: string
          payload?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          event_type?: Database["public"]["Enums"]["decision_event_type"]
          id?: string
          payload?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_events_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          chosen_option: string | null
          context: string
          created_at: string
          decided_at: string | null
          id: string
          options_considered: Json
          rationale: string | null
          resolved_at: string | null
          reversibility: Database["public"]["Enums"]["reversibility"]
          stakes: Database["public"]["Enums"]["stakes_level"]
          status: Database["public"]["Enums"]["decision_status"]
          title: string
          user_id: string
        }
        Insert: {
          chosen_option?: string | null
          context: string
          created_at?: string
          decided_at?: string | null
          id?: string
          options_considered?: Json
          rationale?: string | null
          resolved_at?: string | null
          reversibility?: Database["public"]["Enums"]["reversibility"]
          stakes?: Database["public"]["Enums"]["stakes_level"]
          status?: Database["public"]["Enums"]["decision_status"]
          title: string
          user_id: string
        }
        Update: {
          chosen_option?: string | null
          context?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          options_considered?: Json
          rationale?: string | null
          resolved_at?: string | null
          reversibility?: Database["public"]["Enums"]["reversibility"]
          stakes?: Database["public"]["Enums"]["stakes_level"]
          status?: Database["public"]["Enums"]["decision_status"]
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      eval_items: {
        Row: {
          created_at: string
          id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          id: string
          payload: Json
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      eval_runs: {
        Row: {
          created_at: string
          id: string
          kind: string
          metrics: Json
          prompt_versions: string[]
          report_path: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metrics: Json
          prompt_versions: string[]
          report_path?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metrics?: Json
          prompt_versions?: string[]
          report_path?: string | null
        }
        Relationships: []
      }
      forecasts: {
        Row: {
          created_at: string
          decision_id: string
          desired: boolean
          id: string
          outcome: boolean | null
          probability: number
          question: string
          recalled_at: string | null
          recalled_probability: number | null
          resolve_by: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_in_checkin_id: string | null
          revealed_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          desired?: boolean
          id?: string
          outcome?: boolean | null
          probability: number
          question: string
          recalled_at?: string | null
          recalled_probability?: number | null
          resolve_by?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_in_checkin_id?: string | null
          revealed_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          desired?: boolean
          id?: string
          outcome?: boolean | null
          probability?: number
          question?: string
          recalled_at?: string | null
          recalled_probability?: number | null
          resolve_by?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_in_checkin_id?: string | null
          revealed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecasts_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecasts_resolved_in_checkin_id_fkey"
            columns: ["resolved_in_checkin_id"]
            isOneToOne: false
            referencedRelation: "checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      judge_scores: {
        Row: {
          contamination: boolean
          created_at: string
          decision_id: string
          id: string
          input_hash: string
          langfuse_trace_id: string | null
          model: string
          prompt_version: string
          rationale: Json
          scores: Json
          user_id: string
        }
        Insert: {
          contamination?: boolean
          created_at?: string
          decision_id: string
          id?: string
          input_hash: string
          langfuse_trace_id?: string | null
          model: string
          prompt_version: string
          rationale: Json
          scores: Json
          user_id: string
        }
        Update: {
          contamination?: boolean
          created_at?: string
          decision_id?: string
          id?: string
          input_hash?: string
          langfuse_trace_id?: string | null
          model?: string
          prompt_version?: string
          rationale?: Json
          scores?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "judge_scores_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "judge_scores_prompt_version_fkey"
            columns: ["prompt_version"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      premortem_risks: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          likelihood: number | null
          premortem_id: string
          severity: Database["public"]["Enums"]["risk_severity"]
          source: Database["public"]["Enums"]["risk_source"]
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          likelihood?: number | null
          premortem_id: string
          severity: Database["public"]["Enums"]["risk_severity"]
          source?: Database["public"]["Enums"]["risk_source"]
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          likelihood?: number | null
          premortem_id?: string
          severity?: Database["public"]["Enums"]["risk_severity"]
          source?: Database["public"]["Enums"]["risk_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premortem_risks_premortem_id_fkey"
            columns: ["premortem_id"]
            isOneToOne: false
            referencedRelation: "premortems"
            referencedColumns: ["id"]
          },
        ]
      }
      premortems: {
        Row: {
          created_at: string
          decision_id: string
          id: string
          langfuse_trace_id: string | null
          model: string
          prompt_version: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decision_id: string
          id?: string
          langfuse_trace_id?: string | null
          model: string
          prompt_version: string
          user_id: string
        }
        Update: {
          created_at?: string
          decision_id?: string
          id?: string
          langfuse_trace_id?: string | null
          model?: string
          prompt_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premortems_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "decisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premortems_prompt_version_fkey"
            columns: ["prompt_version"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prompt_versions: {
        Row: {
          content_hash: string
          created_at: string
          file_path: string
          id: string
          kind: Database["public"]["Enums"]["prompt_kind"]
          notes: string | null
        }
        Insert: {
          content_hash: string
          created_at?: string
          file_path: string
          id: string
          kind: Database["public"]["Enums"]["prompt_kind"]
          notes?: string | null
        }
        Update: {
          content_hash?: string
          created_at?: string
          file_path?: string
          id?: string
          kind?: Database["public"]["Enums"]["prompt_kind"]
          notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      commit_decision: {
        Args: {
          p_decision_id: string
          p_six_months: string
          p_two_months: string
          p_two_weeks: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      attribution: "skill" | "luck" | "mixed"
      checkin_horizon: "two_weeks" | "two_months" | "six_months" | "custom"
      checkin_status: "pending" | "due" | "completed" | "skipped"
      decision_event_type:
        | "created"
        | "committed"
        | "revised"
        | "reversed"
        | "reaffirmed"
        | "resolved"
        | "abandoned"
      decision_status: "draft" | "active" | "resolved" | "abandoned"
      prompt_kind: "premortem" | "judge"
      reversibility: "one_way" | "two_way"
      risk_severity: "low" | "medium" | "high"
      risk_source: "ai" | "user"
      stakes_level: "low" | "medium" | "high"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attribution: ["skill", "luck", "mixed"],
      checkin_horizon: ["two_weeks", "two_months", "six_months", "custom"],
      checkin_status: ["pending", "due", "completed", "skipped"],
      decision_event_type: [
        "created",
        "committed",
        "revised",
        "reversed",
        "reaffirmed",
        "resolved",
        "abandoned",
      ],
      decision_status: ["draft", "active", "resolved", "abandoned"],
      prompt_kind: ["premortem", "judge"],
      reversibility: ["one_way", "two_way"],
      risk_severity: ["low", "medium", "high"],
      risk_source: ["ai", "user"],
      stakes_level: ["low", "medium", "high"],
    },
  },
} as const

