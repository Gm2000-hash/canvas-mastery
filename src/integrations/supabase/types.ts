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
          quiz_engine: string | null
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
          quiz_engine?: string | null
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
          quiz_engine?: string | null
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
          archived_at: string | null
          canvas_course_id: number
          canvas_workflow_state: string | null
          course_code: string | null
          created_at: string
          discipline_id: string | null
          end_at: string | null
          hidden: boolean
          id: string
          last_synced_at: string | null
          name: string
          teacher_id: string
          term: string | null
        }
        Insert: {
          archived_at?: string | null
          canvas_course_id: number
          canvas_workflow_state?: string | null
          course_code?: string | null
          created_at?: string
          discipline_id?: string | null
          end_at?: string | null
          hidden?: boolean
          id?: string
          last_synced_at?: string | null
          name: string
          teacher_id: string
          term?: string | null
        }
        Update: {
          archived_at?: string | null
          canvas_course_id?: number
          canvas_workflow_state?: string | null
          course_code?: string | null
          created_at?: string
          discipline_id?: string | null
          end_at?: string | null
          hidden?: boolean
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
      historical_access_log: {
        Row: {
          accessed_at: string
          course_id: string | null
          id: string
          reason: string | null
          student_ids: string[]
          teacher_id: string
        }
        Insert: {
          accessed_at?: string
          course_id?: string | null
          id?: string
          reason?: string | null
          student_ids?: string[]
          teacher_id: string
        }
        Update: {
          accessed_at?: string
          course_id?: string | null
          id?: string
          reason?: string | null
          student_ids?: string[]
          teacher_id?: string
        }
        Relationships: []
      }
      identity_reveals: {
        Row: {
          course_id: string | null
          id: string
          reason: string | null
          revealed_at: string
          student_count: number
          teacher_id: string
        }
        Insert: {
          course_id?: string | null
          id?: string
          reason?: string | null
          revealed_at?: string
          student_count?: number
          teacher_id: string
        }
        Update: {
          course_id?: string | null
          id?: string
          reason?: string | null
          revealed_at?: string
          student_count?: number
          teacher_id?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          note: string | null
          revoked: boolean
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          note?: string | null
          revoked?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          revoked?: boolean
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
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
          onboarding_dismissed_at: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_grade?: string | null
          default_subject?: string | null
          display_name?: string | null
          id: string
          onboarding_dismissed_at?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_grade?: string | null
          default_subject?: string | null
          display_name?: string | null
          id?: string
          onboarding_dismissed_at?: string | null
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
          answers: Json | null
          assignment_id: string
          canvas_question_id: number
          created_at: string
          id: string
          item_type: string | null
          points_possible: number | null
          position: number | null
          question_text: string | null
          teacher_id: string
        }
        Insert: {
          answers?: Json | null
          assignment_id: string
          canvas_question_id: number
          created_at?: string
          id?: string
          item_type?: string | null
          points_possible?: number | null
          position?: number | null
          question_text?: string | null
          teacher_id: string
        }
        Update: {
          answers?: Json | null
          assignment_id?: string
          canvas_question_id?: number
          created_at?: string
          id?: string
          item_type?: string | null
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
      student_identities: {
        Row: {
          canvas_user_id: number | null
          created_at: string
          email: string | null
          real_name: string
          real_sortable_name: string | null
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          canvas_user_id?: number | null
          created_at?: string
          email?: string | null
          real_name: string
          real_sortable_name?: string | null
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          canvas_user_id?: number | null
          created_at?: string
          email?: string | null
          real_name?: string
          real_sortable_name?: string | null
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          archived_at: string | null
          canvas_user_id: number
          course_id: string
          created_at: string
          email: string | null
          enrollment_state: string | null
          id: string
          merged_into: string | null
          name: string
          pseudonym: string | null
          pseudonym_seq: number | null
          sortable_name: string | null
          teacher_id: string
        }
        Insert: {
          archived_at?: string | null
          canvas_user_id: number
          course_id: string
          created_at?: string
          email?: string | null
          enrollment_state?: string | null
          id?: string
          merged_into?: string | null
          name: string
          pseudonym?: string | null
          pseudonym_seq?: number | null
          sortable_name?: string | null
          teacher_id: string
        }
        Update: {
          archived_at?: string | null
          canvas_user_id?: number
          course_id?: string
          created_at?: string
          email?: string | null
          enrollment_state?: string | null
          id?: string
          merged_into?: string | null
          name?: string
          pseudonym?: string | null
          pseudonym_seq?: number | null
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
          {
            foreignKeyName: "students_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "students"
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
          auto_archive_enabled: boolean
          mastery_threshold: number
          pseudonym_style: string
          reveal_default: boolean
          teacher_id: string
          updated_at: string
        }
        Insert: {
          attempt_window?: number
          auto_archive_enabled?: boolean
          mastery_threshold?: number
          pseudonym_style?: string
          reveal_default?: boolean
          teacher_id: string
          updated_at?: string
        }
        Update: {
          attempt_window?: number
          auto_archive_enabled?: boolean
          mastery_threshold?: number
          pseudonym_style?: string
          reveal_default?: boolean
          teacher_id?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          roles: Database["public"]["Enums"]["app_role"][]
          user_id: string
        }[]
      }
      analytics_active_dimensions: {
        Args: never
        Returns: {
          framework: string
          standard_count: number
          subject: string
        }[]
      }
      analytics_assignment_breakdown: {
        Args: { _course_id?: string }
        Returns: {
          assignment_id: string
          avg_percentage: number
          course_id: string
          course_name: string
          due_at: string
          kind: string
          name: string
          points_possible: number
          standards_tagged: number
          submission_count: number
        }[]
      }
      analytics_backfill_report: {
        Args: { _course_ids: string[] }
        Returns: {
          assignment_count: number
          course_id: string
          course_name: string
          district_standard_count: number
          district_standards_missing: number
          district_standards_with_mastery: number
          framework: string
          grade: string
          mastery_record_count: number
          missing_standard_codes: string[]
          question_response_count: number
          school_year: string
          student_count: number
          subject: string
          submission_count: number
        }[]
      }
      analytics_class_breakdown:
        | {
            Args: never
            Returns: {
              assessment_count: number
              avg_mastery: number
              course_id: string
              course_name: string
              framework: string
              pct_mastered: number
              student_count: number
              subject: string
            }[]
          }
        | {
            Args: { _include_archived?: boolean; _school_year?: string }
            Returns: {
              assessment_count: number
              avg_mastery: number
              course_id: string
              course_name: string
              framework: string
              pct_mastered: number
              student_count: number
              subject: string
            }[]
          }
      analytics_class_matrix: {
        Args: { _course_id: string }
        Returns: {
          attempts: number
          code: string
          computed_at: string
          description: string
          framework: string
          grade: string
          mastered: boolean
          mastery_score: number
          parent_code: string
          standard_id: string
          student_id: string
          student_name: string
          student_sortable: string
          subject: string
        }[]
      }
      analytics_mastery_distribution: {
        Args: { _course_id?: string; _subject?: string }
        Returns: {
          bucket: string
          bucket_max: number
          bucket_min: number
          count: number
        }[]
      }
      analytics_mastery_trends: {
        Args: { _course_id?: string; _granularity?: string; _subject?: string }
        Returns: {
          avg_mastery: number
          bucket_label: string
          bucket_ts: string
          framework: string
          sample_size: number
          subject: string
        }[]
      }
      analytics_question_bank: {
        Args: { _course_id?: string; _framework?: string; _subject?: string }
        Returns: {
          avg_pct_correct: number
          code: string
          description: string
          framework: string
          grade: string
          parent_code: string
          response_count: number
          standard_id: string
          subject: string
          tagged_question_count: number
        }[]
      }
      analytics_question_breakdown: {
        Args: { _assignment_id?: string; _course_id?: string }
        Returns: {
          assignment_id: string
          assignment_name: string
          avg_points: number
          correct_count: number
          pct_correct: number
          points_possible: number
          question_id: string
          question_position: number
          question_text: string
          responses: number
          standards_tagged: number
        }[]
      }
      analytics_standard_breakdown: {
        Args: { _course_id?: string; _framework?: string; _subject?: string }
        Returns: {
          avg_mastery: number
          code: string
          description: string
          framework: string
          grade: string
          pct_mastered: number
          standard_id: string
          students_assessed: number
          students_mastered: number
          subject: string
        }[]
      }
      analytics_student_breakdown:
        | {
            Args: { _course_id?: string }
            Returns: {
              avg_mastery: number
              course_id: string
              course_name: string
              last_activity: string
              standards_assessed: number
              standards_mastered: number
              student_id: string
              student_name: string
            }[]
          }
        | {
            Args: {
              _course_id?: string
              _include_archived?: boolean
              _school_year?: string
            }
            Returns: {
              avg_mastery: number
              course_id: string
              course_name: string
              last_activity: string
              standards_assessed: number
              standards_mastered: number
              student_id: string
              student_name: string
            }[]
          }
      analytics_student_history: {
        Args: { _student_id: string }
        Returns: {
          attempts: number
          course_archived: boolean
          course_id: string
          course_name: string
          framework: string
          grade: string
          last_assessed: string
          mastered: boolean
          mastery_score: number
          school_year: string
          standard_code: string
          standard_description: string
          standard_id: string
          subject: string
        }[]
      }
      create_invitation: {
        Args: { _expires_at?: string; _note?: string }
        Returns: {
          code: string
          created_at: string
          expires_at: string
          id: string
          note: string
        }[]
      }
      force_archive_state: {
        Args: { _archive: boolean; _course_id: string }
        Returns: boolean
      }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_course_active: { Args: { _course_id: string }; Returns: boolean }
      is_within_active_school_year: {
        Args: { _course_id: string }
        Returns: boolean
      }
      mastery_debug: {
        Args: { _standard_id: string; _student_id: string }
        Returns: {
          ai_suggested: boolean
          assignment_id: string
          assignment_name: string
          confidence: number
          confirmed: boolean
          matched_via_question_id: string
          occurred_at: string
          pct: number
          points: number
          points_possible: number
          question_id: string
          question_position: number
          question_text: string
          source: string
          weight: number
        }[]
      }
      merge_student_records: {
        Args: { _from: string; _to: string }
        Returns: {
          reassigned_responses: number
          reassigned_snapshots: number
          reassigned_submissions: number
        }[]
      }
      redeem_invitation: {
        Args: { _code: string; _user_id: string }
        Returns: {
          error: string
          ok: boolean
        }[]
      }
      repseudonymize_course: {
        Args: { _course_id: string }
        Returns: {
          new_pseudonym: string
          old_pseudonym: string
          student_id: string
        }[]
      }
      reveal_student_identities: {
        Args: { _course_id: string; _reason?: string }
        Returns: {
          email: string
          real_name: string
          real_sortable_name: string
          student_id: string
        }[]
      }
      run_auto_archive: {
        Args: { _teacher_id: string }
        Returns: {
          courses_archived: number
          students_archived: number
        }[]
      }
      school_year_end_for: { Args: { _anchor: string }; Returns: string }
      school_year_label: { Args: { _anchor: string }; Returns: string }
      search_students_history:
        | {
            Args: { _query: string }
            Returns: {
              course_archived: boolean
              course_id: string
              course_name: string
              display_name: string
              last_activity: string
              real_name: string
              school_year: string
              student_id: string
            }[]
          }
        | {
            Args: {
              _grade?: string
              _query: string
              _school_year?: string
              _subject?: string
              _trimester?: string
            }
            Returns: {
              course_archived: boolean
              course_id: string
              course_name: string
              display_name: string
              grade: string
              last_activity: string
              real_name: string
              school_year: string
              student_id: string
              subject: string
              term: string
            }[]
          }
    }
    Enums: {
      app_role: "admin" | "teacher"
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
      app_role: ["admin", "teacher"],
      assignment_kind: ["assignment", "quiz"],
    },
  },
} as const
