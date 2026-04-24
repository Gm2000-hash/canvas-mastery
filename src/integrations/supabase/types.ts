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
      assignment_standards: {
        Row: {
          ai_suggested: boolean
          assignment_id: string
          confidence: number | null
          confirmed: boolean
          created_at: string
          id: string
          rationale: string | null
          standard_id: string
          teacher_id: string
        }
        Insert: {
          ai_suggested?: boolean
          assignment_id: string
          confidence?: number | null
          confirmed?: boolean
          created_at?: string
          id?: string
          rationale?: string | null
          standard_id: string
          teacher_id: string
        }
        Update: {
          ai_suggested?: boolean
          assignment_id?: string
          confidence?: number | null
          confirmed?: boolean
          created_at?: string
          id?: string
          rationale?: string | null
          standard_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_standards_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_standards_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          canvas_assignment_id: number
          canvas_quiz_id: number | null
          course_id: string
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          kind: Database["public"]["Enums"]["assignment_kind"]
          name: string
          points_possible: number | null
          teacher_id: string
        }
        Insert: {
          canvas_assignment_id: number
          canvas_quiz_id?: number | null
          course_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["assignment_kind"]
          name: string
          points_possible?: number | null
          teacher_id: string
        }
        Update: {
          canvas_assignment_id?: number
          canvas_quiz_id?: number | null
          course_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["assignment_kind"]
          name?: string
          points_possible?: number | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_credentials: {
        Row: {
          api_token: string
          base_url: string
          created_at: string
          last_sync_at: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          api_token: string
          base_url: string
          created_at?: string
          last_sync_at?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          api_token?: string
          base_url?: string
          created_at?: string
          last_sync_at?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          canvas_course_id: number
          course_code: string | null
          created_at: string
          discipline_id: string | null
          id: string
          last_synced_at: string | null
          name: string
          teacher_id: string
          term: string | null
        }
        Insert: {
          canvas_course_id: number
          course_code?: string | null
          created_at?: string
          discipline_id?: string | null
          id?: string
          last_synced_at?: string | null
          name: string
          teacher_id: string
          term?: string | null
        }
        Update: {
          canvas_course_id?: number
          course_code?: string | null
          created_at?: string
          discipline_id?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          teacher_id?: string
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "teacher_disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      mastery_snapshots: {
        Row: {
          attempts: number
          computed_at: string
          id: string
          mastered: boolean
          mastery_score: number
          standard_id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          attempts?: number
          computed_at?: string
          id?: string
          mastered?: boolean
          mastery_score: number
          standard_id: string
          student_id: string
          teacher_id: string
        }
        Update: {
          attempts?: number
          computed_at?: string
          id?: string
          mastered?: boolean
          mastery_score?: number
          standard_id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mastery_snapshots_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mastery_snapshots_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_grade: string | null
          default_subject: string | null
          display_name: string | null
          id: string
          state: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_grade?: string | null
          default_subject?: string | null
          display_name?: string | null
          id: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_grade?: string | null
          default_subject?: string | null
          display_name?: string | null
          id?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      question_responses: {
        Row: {
          correct: boolean | null
          created_at: string
          id: string
          points: number | null
          points_possible: number | null
          question_id: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          correct?: boolean | null
          created_at?: string
          id?: string
          points?: number | null
          points_possible?: number | null
          question_id: string
          student_id: string
          teacher_id: string
        }
        Update: {
          correct?: boolean | null
          created_at?: string
          id?: string
          points?: number | null
          points_possible?: number | null
          question_id?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_responses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      question_standards: {
        Row: {
          ai_suggested: boolean
          confidence: number | null
          confirmed: boolean
          created_at: string
          id: string
          question_id: string
          rationale: string | null
          standard_id: string
          teacher_id: string
        }
        Insert: {
          ai_suggested?: boolean
          confidence?: number | null
          confirmed?: boolean
          created_at?: string
          id?: string
          question_id: string
          rationale?: string | null
          standard_id: string
          teacher_id: string
        }
        Update: {
          ai_suggested?: boolean
          confidence?: number | null
          confirmed?: boolean
          created_at?: string
          id?: string
          question_id?: string
          rationale?: string | null
          standard_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_standards_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_standards_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          assignment_id: string
          canvas_question_id: number
          created_at: string
          id: string
          points_possible: number | null
          position: number | null
          question_text: string | null
          teacher_id: string
        }
        Insert: {
          assignment_id: string
          canvas_question_id: number
          created_at?: string
          id?: string
          points_possible?: number | null
          position?: number | null
          question_text?: string | null
          teacher_id: string
        }
        Update: {
          assignment_id?: string
          canvas_question_id?: number
          created_at?: string
          id?: string
          points_possible?: number | null
          position?: number | null
          question_text?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      standards: {
        Row: {
          code: string
          created_at: string
          description: string
          framework: string | null
          grade: string
          id: string
          state: string
          subject: string
          teacher_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description: string
          framework?: string | null
          grade: string
          id?: string
          state: string
          subject: string
          teacher_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
          framework?: string | null
          grade?: string
          id?: string
          state?: string
          subject?: string
          teacher_id?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          canvas_user_id: number
          course_id: string
          created_at: string
          id: string
          name: string
          sortable_name: string | null
          teacher_id: string
        }
        Insert: {
          canvas_user_id: number
          course_id: string
          created_at?: string
          id?: string
          name: string
          sortable_name?: string | null
          teacher_id: string
        }
        Update: {
          canvas_user_id?: number
          course_id?: string
          created_at?: string
          id?: string
          name?: string
          sortable_name?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          assignment_id: string
          created_at: string
          graded_at: string | null
          id: string
          percentage: number | null
          points_possible: number | null
          score: number | null
          student_id: string
          submitted_at: string | null
          teacher_id: string
          workflow_state: string | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          graded_at?: string | null
          id?: string
          percentage?: number | null
          points_possible?: number | null
          score?: number | null
          student_id: string
          submitted_at?: string | null
          teacher_id: string
          workflow_state?: string | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          graded_at?: string | null
          id?: string
          percentage?: number | null
          points_possible?: number | null
          score?: number | null
          student_id?: string
          submitted_at?: string | null
          teacher_id?: string
          workflow_state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_disciplines: {
        Row: {
          created_at: string
          framework: string | null
          grade: string
          id: string
          is_default: boolean
          state: string
          subject: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          framework?: string | null
          grade: string
          id?: string
          is_default?: boolean
          state: string
          subject: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          framework?: string | null
          grade?: string
          id?: string
          is_default?: boolean
          state?: string
          subject?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_settings: {
        Row: {
          attempt_window: number
          mastery_threshold: number
          teacher_id: string
          updated_at: string
        }
        Insert: {
          attempt_window?: number
          mastery_threshold?: number
          teacher_id: string
          updated_at?: string
        }
        Update: {
          attempt_window?: number
          mastery_threshold?: number
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_canvas_connection_status: {
        Args: never
        Returns: {
          base_url: string
          connected: boolean
          last_sync_at: string
          teacher_id: string
          updated_at: string
        }[]
      }
      get_effective_discipline: {
        Args: { _course_id: string }
        Returns: {
          framework: string
          grade: string
          id: string
          state: string
          subject: string
          teacher_id: string
        }[]
      }
    }
    Enums: {
      assignment_kind: "assignment" | "quiz"
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
      assignment_kind: ["assignment", "quiz"],
    },
  },
} as const
