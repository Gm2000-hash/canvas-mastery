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
      app_secret_history: {
        Row: {
          action: string
          hint: string | null
          id: string
          name: string
          set_at: string
          set_by: string | null
        }
        Insert: {
          action: string
          hint?: string | null
          id?: string
          name: string
          set_at?: string
          set_by?: string | null
        }
        Update: {
          action?: string
          hint?: string | null
          id?: string
          name?: string
          set_at?: string
          set_by?: string | null
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          hint: string | null
          name: string
          set_at: string
          set_by: string | null
          value_ciphertext: string
        }
        Insert: {
          hint?: string | null
          name: string
          set_at?: string
          set_by?: string | null
          value_ciphertext: string
        }
        Update: {
          hint?: string | null
          name?: string
          set_at?: string
          set_by?: string | null
          value_ciphertext?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      assessment_match_suggestions: {
        Row: {
          applied_group_id: string | null
          assignment_ids: string[]
          class_group_id: string
          confidence: number | null
          created_at: string
          dismissed_at: string | null
          id: string
          rationale: string | null
          suggested_name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          applied_group_id?: string | null
          assignment_ids: string[]
          class_group_id: string
          confidence?: number | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          rationale?: string | null
          suggested_name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          applied_group_id?: string | null
          assignment_ids?: string[]
          class_group_id?: string
          confidence?: number | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          rationale?: string | null
          suggested_name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_match_suggestions_applied_group_id_fkey"
            columns: ["applied_group_id"]
            isOneToOne: false
            referencedRelation: "assignment_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_match_suggestions_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_groups: {
        Row: {
          class_group_id: string | null
          confirmed: boolean
          created_at: string
          grade: string | null
          id: string
          kind: Database["public"]["Enums"]["assignment_kind"]
          name: string
          subject: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_group_id?: string | null
          confirmed?: boolean
          created_at?: string
          grade?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["assignment_kind"]
          name: string
          subject?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_group_id?: string | null
          confirmed?: boolean
          created_at?: string
          grade?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["assignment_kind"]
          name?: string
          subject?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_groups_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
        ]
      }
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
          assignment_group_id: string | null
          canvas_assignment_id: number | null
          canvas_quiz_id: number | null
          course_id: string
          created_at: string
          description: string | null
          due_at: string | null
          google_coursework_id: string | null
          google_form_id: string | null
          id: string
          kind: Database["public"]["Enums"]["assignment_kind"]
          name: string
          name_normalized: string | null
          points_possible: number | null
          quiz_engine: string | null
          teacher_id: string
        }
        Insert: {
          assignment_group_id?: string | null
          canvas_assignment_id?: number | null
          canvas_quiz_id?: number | null
          course_id: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          google_coursework_id?: string | null
          google_form_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["assignment_kind"]
          name: string
          name_normalized?: string | null
          points_possible?: number | null
          quiz_engine?: string | null
          teacher_id: string
        }
        Update: {
          assignment_group_id?: string | null
          canvas_assignment_id?: number | null
          canvas_quiz_id?: number | null
          course_id?: string
          created_at?: string
          description?: string | null
          due_at?: string | null
          google_coursework_id?: string | null
          google_form_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["assignment_kind"]
          name?: string
          name_normalized?: string | null
          points_possible?: number | null
          quiz_engine?: string | null
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assignment_group_id_fkey"
            columns: ["assignment_group_id"]
            isOneToOne: false
            referencedRelation: "assignment_groups"
            referencedColumns: ["id"]
          },
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
      class_group_courses: {
        Row: {
          class_group_id: string
          course_id: string
          created_at: string
          teacher_id: string
        }
        Insert: {
          class_group_id: string
          course_id: string
          created_at?: string
          teacher_id: string
        }
        Update: {
          class_group_id?: string
          course_id?: string
          created_at?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_group_courses_class_group_id_fkey"
            columns: ["class_group_id"]
            isOneToOne: false
            referencedRelation: "class_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      class_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          archived_at: string | null
          canvas_course_id: number | null
          canvas_workflow_state: string | null
          course_code: string | null
          created_at: string
          discipline_id: string | null
          end_at: string | null
          google_course_id: string | null
          hidden: boolean
          id: string
          last_synced_at: string | null
          name: string
          platform: string
          teacher_id: string
          term: string | null
        }
        Insert: {
          archived_at?: string | null
          canvas_course_id?: number | null
          canvas_workflow_state?: string | null
          course_code?: string | null
          created_at?: string
          discipline_id?: string | null
          end_at?: string | null
          google_course_id?: string | null
          hidden?: boolean
          id?: string
          last_synced_at?: string | null
          name: string
          platform?: string
          teacher_id: string
          term?: string | null
        }
        Update: {
          archived_at?: string | null
          canvas_course_id?: number | null
          canvas_workflow_state?: string | null
          course_code?: string | null
          created_at?: string
          discipline_id?: string | null
          end_at?: string | null
          google_course_id?: string | null
          hidden?: boolean
          id?: string
          last_synced_at?: string | null
          name?: string
          platform?: string
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
      curriculum_lesson_standards: {
        Row: {
          id: string
          lesson_id: string
          matched_terms: string[]
          ngss_code: string
          ngss_description: string
        }
        Insert: {
          id?: string
          lesson_id: string
          matched_terms?: string[]
          ngss_code: string
          ngss_description: string
        }
        Update: {
          id?: string
          lesson_id?: string
          matched_terms?: string[]
          ngss_code?: string
          ngss_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_lesson_standards_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "curriculum_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_lessons: {
        Row: {
          chapter: Json | null
          created_at: string
          explanation: Json
          id: string
          image_url: string | null
          interactive_activities: Json | null
          intro: Json
          key_terms: Json
          objectives: Json
          reading_paragraphs: Json | null
          reading_title: string | null
          sort_order: number
          title: string
          unit_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chapter?: Json | null
          created_at?: string
          explanation?: Json
          id?: string
          image_url?: string | null
          interactive_activities?: Json | null
          intro?: Json
          key_terms?: Json
          objectives?: Json
          reading_paragraphs?: Json | null
          reading_title?: string | null
          sort_order?: number
          title: string
          unit_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chapter?: Json | null
          created_at?: string
          explanation?: Json
          id?: string
          image_url?: string | null
          interactive_activities?: Json | null
          intro?: Json
          key_terms?: Json
          objectives?: Json
          reading_paragraphs?: Json | null
          reading_title?: string | null
          sort_order?: number
          title?: string
          unit_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_lessons_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_quizzes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          question_ids: string[]
          settings: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          question_ids?: string[]
          settings?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          question_ids?: string[]
          settings?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      exam_review_materials: {
        Row: {
          created_at: string
          exam_id: string
          flashcards: Json
          id: string
          review_lesson: Json
          study_guide: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          flashcards?: Json
          id?: string
          review_lesson?: Json
          study_guide?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          flashcards?: Json
          id?: string
          review_lesson?: Json
          study_guide?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_review_materials_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: true
            referencedRelation: "isat_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      google_credentials: {
        Row: {
          connected_at: string
          email: string | null
          refresh_token_ciphertext: string
          scopes: string[]
          teacher_id: string
          updated_at: string
        }
        Insert: {
          connected_at?: string
          email?: string | null
          refresh_token_ciphertext: string
          scopes?: string[]
          teacher_id: string
          updated_at?: string
        }
        Update: {
          connected_at?: string
          email?: string | null
          refresh_token_ciphertext?: string
          scopes?: string[]
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      h5p_activities: {
        Row: {
          activity_type: string
          content: Json
          created_at: string
          id: string
          title: string
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          content?: Json
          created_at?: string
          id?: string
          title: string
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          content?: Json
          created_at?: string
          id?: string
          title?: string
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "h5p_activities_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      h5p_activity_standards: {
        Row: {
          activity_id: string
          id: string
          matched_terms: string[]
          ngss_code: string
          ngss_description: string
        }
        Insert: {
          activity_id: string
          id?: string
          matched_terms?: string[]
          ngss_code: string
          ngss_description: string
        }
        Update: {
          activity_id?: string
          id?: string
          matched_terms?: string[]
          ngss_code?: string
          ngss_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "h5p_activity_standards_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "h5p_activities"
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
      isat_exams: {
        Row: {
          answers: Json | null
          completed_at: string | null
          created_at: string
          grade_level: string
          hints_enabled: boolean
          hints_used: number
          id: string
          question_count: number
          questions: Json
          score: number | null
          title: string
          total_points: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          grade_level?: string
          hints_enabled?: boolean
          hints_used?: number
          id?: string
          question_count?: number
          questions?: Json
          score?: number | null
          title: string
          total_points?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          grade_level?: string
          hints_enabled?: boolean
          hints_used?: number
          id?: string
          question_count?: number
          questions?: Json
          score?: number | null
          title?: string
          total_points?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_assignments: {
        Row: {
          ai_metadata: Json
          assignment_type: string
          canvas_assignment_id: number | null
          canvas_course_id: number | null
          created_at: string
          due_in_days: number | null
          google_doc_url: string | null
          google_sheet_url: string | null
          google_slides_url: string | null
          id: string
          instructions: string
          lesson_plan_id: string
          materials: Json
          points_possible: number
          quiz_questions: Json
          rubric: Json
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_metadata?: Json
          assignment_type?: string
          canvas_assignment_id?: number | null
          canvas_course_id?: number | null
          created_at?: string
          due_in_days?: number | null
          google_doc_url?: string | null
          google_sheet_url?: string | null
          google_slides_url?: string | null
          id?: string
          instructions?: string
          lesson_plan_id: string
          materials?: Json
          points_possible?: number
          quiz_questions?: Json
          rubric?: Json
          sort_order?: number
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_metadata?: Json
          assignment_type?: string
          canvas_assignment_id?: number | null
          canvas_course_id?: number | null
          created_at?: string
          due_in_days?: number | null
          google_doc_url?: string | null
          google_sheet_url?: string | null
          google_slides_url?: string | null
          id?: string
          instructions?: string
          lesson_plan_id?: string
          materials?: Json
          points_possible?: number
          quiz_questions?: Json
          rubric?: Json
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_assignments_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plan_standards: {
        Row: {
          id: string
          lesson_plan_id: string
          ngss_code: string
          ngss_description: string
        }
        Insert: {
          id?: string
          lesson_plan_id: string
          ngss_code: string
          ngss_description: string
        }
        Update: {
          id?: string
          lesson_plan_id?: string
          ngss_code?: string
          ngss_description?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plan_standards_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plans: {
        Row: {
          activities: Json | null
          assessment: string | null
          created_at: string
          differentiation: string | null
          duration_minutes: number | null
          embedded_activities: Json | null
          id: string
          lesson_date: string | null
          materials: string | null
          notes: string | null
          objectives: string | null
          resources: Json | null
          sort_order: number | null
          title: string
          udl_supports: Json
          unit_id: string | null
          updated_at: string
          user_id: string
          vocabulary: Json | null
        }
        Insert: {
          activities?: Json | null
          assessment?: string | null
          created_at?: string
          differentiation?: string | null
          duration_minutes?: number | null
          embedded_activities?: Json | null
          id?: string
          lesson_date?: string | null
          materials?: string | null
          notes?: string | null
          objectives?: string | null
          resources?: Json | null
          sort_order?: number | null
          title: string
          udl_supports?: Json
          unit_id?: string | null
          updated_at?: string
          user_id: string
          vocabulary?: Json | null
        }
        Update: {
          activities?: Json | null
          assessment?: string | null
          created_at?: string
          differentiation?: string | null
          duration_minutes?: number | null
          embedded_activities?: Json | null
          id?: string
          lesson_date?: string | null
          materials?: string | null
          notes?: string | null
          objectives?: string | null
          resources?: Json | null
          sort_order?: number | null
          title?: string
          udl_supports?: Json
          unit_id?: string | null
          updated_at?: string
          user_id?: string
          vocabulary?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      library_books: {
        Row: {
          cover_url: string | null
          created_at: string
          file_path: string
          file_size: number
          id: string
          is_published: boolean
          page_count: number | null
          share_token: string | null
          source_discipline: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          file_path: string
          file_size?: number
          id?: string
          is_published?: boolean
          page_count?: number | null
          share_token?: string | null
          source_discipline?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          file_path?: string
          file_size?: number
          id?: string
          is_published?: boolean
          page_count?: number | null
          share_token?: string | null
          source_discipline?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      library_item_standards: {
        Row: {
          created_at: string
          id: string
          library_item_id: string
          standard_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          library_item_id: string
          standard_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          library_item_id?: string
          standard_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_item_standards_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_item_standards_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      library_items: {
        Row: {
          body: string | null
          canvas_course_id: number | null
          canvas_item_id: number | null
          canvas_item_type: string | null
          chapter: Json | null
          created_at: string
          dok_levels: number[]
          file_mime: string | null
          file_name: string | null
          file_path: string | null
          grade: string | null
          id: string
          kind: string
          search_tsv: unknown
          source: string
          subject: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          canvas_course_id?: number | null
          canvas_item_id?: number | null
          canvas_item_type?: string | null
          chapter?: Json | null
          created_at?: string
          dok_levels?: number[]
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          grade?: string | null
          id?: string
          kind: string
          search_tsv?: unknown
          source?: string
          subject?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          canvas_course_id?: number | null
          canvas_item_id?: number | null
          canvas_item_type?: string | null
          chapter?: Json | null
          created_at?: string
          dok_levels?: number[]
          file_mime?: string | null
          file_name?: string | null
          file_path?: string | null
          grade?: string | null
          id?: string
          kind?: string
          search_tsv?: unknown
          source?: string
          subject?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
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
      mc_assessment_mappings: {
        Row: {
          assignment_group_id: string | null
          assignment_id: string | null
          created_at: string
          id: string
          mc_assessment_id: string
          mc_assessment_name: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          assignment_group_id?: string | null
          assignment_id?: string | null
          created_at?: string
          id?: string
          mc_assessment_id: string
          mc_assessment_name?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          assignment_group_id?: string | null
          assignment_id?: string | null
          created_at?: string
          id?: string
          mc_assessment_id?: string
          mc_assessment_name?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mc_course_mappings: {
        Row: {
          course_id: string
          created_at: string
          id: string
          mc_tracker_id: string
          mc_tracker_name: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          mc_tracker_id: string
          mc_tracker_name?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          mc_tracker_id?: string
          mc_tracker_name?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mc_export_log: {
        Row: {
          course_id: string | null
          created_at: string
          export_type: string
          id: string
          row_count: number
          teacher_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          export_type: string
          id?: string
          row_count?: number
          teacher_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          export_type?: string
          id?: string
          row_count?: number
          teacher_id?: string
        }
        Relationships: []
      }
      mc_settings: {
        Row: {
          created_at: string
          default_mc_org_id: string | null
          last_export_at: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_mc_org_id?: string | null
          last_export_at?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_mc_org_id?: string | null
          last_export_at?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mc_standard_mappings: {
        Row: {
          created_at: string
          id: string
          mc_code: string
          mc_name: string | null
          standard_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mc_code: string
          mc_name?: string | null
          standard_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mc_code?: string
          mc_name?: string | null
          standard_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      mc_student_mappings: {
        Row: {
          created_at: string
          id: string
          mc_sis_id: string | null
          mc_student_id: string | null
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mc_sis_id?: string | null
          mc_student_id?: string | null
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mc_sis_id?: string | null
          mc_student_id?: string | null
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      note_links: {
        Row: {
          created_at: string
          id: string
          source_note_id: string
          target_note_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_note_id: string
          target_note_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_note_id?: string
          target_note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_links_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_links_target_note_id_fkey"
            columns: ["target_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: Json
          content_text: string
          created_at: string
          icon: string | null
          id: string
          is_public: boolean
          parent_id: string | null
          search_vector: unknown
          share_token: string | null
          sort_order: number
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          content_text?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_public?: boolean
          parent_id?: string | null
          search_vector?: unknown
          share_token?: string | null
          sort_order?: number
          tags?: string[]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          content_text?: string
          created_at?: string
          icon?: string | null
          id?: string
          is_public?: boolean
          parent_id?: string | null
          search_vector?: unknown
          share_token?: string | null
          sort_order?: number
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      principal_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          school: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          school?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          school?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_preferences: Json
          avatar_url: string | null
          created_at: string
          default_grade: string | null
          default_subject: string | null
          display_name: string | null
          grade_levels: string[]
          id: string
          onboarding_dismissed_at: string | null
          school: string | null
          state: string | null
          subjects: string[]
          updated_at: string
        }
        Insert: {
          ai_preferences?: Json
          avatar_url?: string | null
          created_at?: string
          default_grade?: string | null
          default_subject?: string | null
          display_name?: string | null
          grade_levels?: string[]
          id: string
          onboarding_dismissed_at?: string | null
          school?: string | null
          state?: string | null
          subjects?: string[]
          updated_at?: string
        }
        Update: {
          ai_preferences?: Json
          avatar_url?: string | null
          created_at?: string
          default_grade?: string | null
          default_subject?: string | null
          display_name?: string | null
          grade_levels?: string[]
          id?: string
          onboarding_dismissed_at?: string | null
          school?: string | null
          state?: string | null
          subjects?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      question_bank: {
        Row: {
          answers: Json | null
          blooms_level: string | null
          canvas_question_id: number | null
          created_at: string
          dok_level: number | null
          id: string
          points_possible: number | null
          question_text: string
          question_type: string
          source_course: string | null
          source_quiz: string | null
          user_id: string
        }
        Insert: {
          answers?: Json | null
          blooms_level?: string | null
          canvas_question_id?: number | null
          created_at?: string
          dok_level?: number | null
          id?: string
          points_possible?: number | null
          question_text: string
          question_type: string
          source_course?: string | null
          source_quiz?: string | null
          user_id: string
        }
        Update: {
          answers?: Json | null
          blooms_level?: string | null
          canvas_question_id?: number | null
          created_at?: string
          dok_level?: number | null
          id?: string
          points_possible?: number | null
          question_text?: string
          question_type?: string
          source_course?: string | null
          source_quiz?: string | null
          user_id?: string
        }
        Relationships: []
      }
      question_bank_standards: {
        Row: {
          id: string
          ngss_code: string
          ngss_description: string
          question_bank_id: string
        }
        Insert: {
          id?: string
          ngss_code: string
          ngss_description: string
          question_bank_id: string
        }
        Update: {
          id?: string
          ngss_code?: string
          ngss_description?: string
          question_bank_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_standards_question_bank_id_fkey"
            columns: ["question_bank_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
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
          canvas_question_id: number | null
          created_at: string
          dok_level: number | null
          google_item_id: string | null
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
          canvas_question_id?: number | null
          created_at?: string
          dok_level?: number | null
          google_item_id?: string | null
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
          canvas_question_id?: number | null
          created_at?: string
          dok_level?: number | null
          google_item_id?: string | null
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
      resource_links: {
        Row: {
          assignment_id: string | null
          created_at: string
          direction: string
          external_course_id: string | null
          external_course_name: string | null
          external_item_id: string
          external_type: string
          id: string
          library_item_id: string | null
          platform: string
          question_set_key: string | null
          synced_at: string
          teacher_id: string
          url: string | null
        }
        Insert: {
          assignment_id?: string | null
          created_at?: string
          direction: string
          external_course_id?: string | null
          external_course_name?: string | null
          external_item_id: string
          external_type: string
          id?: string
          library_item_id?: string | null
          platform: string
          question_set_key?: string | null
          synced_at?: string
          teacher_id: string
          url?: string | null
        }
        Update: {
          assignment_id?: string | null
          created_at?: string
          direction?: string
          external_course_id?: string | null
          external_course_name?: string | null
          external_item_id?: string
          external_type?: string
          id?: string
          library_item_id?: string | null
          platform?: string
          question_set_key?: string | null
          synced_at?: string
          teacher_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_links_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_links_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          created_at: string
          id: string
          name: string
          name_key: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          name_key?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          name_key?: string | null
        }
        Relationships: []
      }
      standard_key_terms: {
        Row: {
          created_at: string
          id: string
          key_terms: string[]
          standard_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_terms?: string[]
          standard_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_terms?: string[]
          standard_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      tag_job_items: {
        Row: {
          assignment_id: string
          created_at: string
          error: string | null
          id: string
          job_id: string
          processed_at: string | null
          question_id: string
          status: string
          teacher_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          error?: string | null
          id?: string
          job_id: string
          processed_at?: string | null
          question_id: string
          status?: string
          teacher_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string
          processed_at?: string | null
          question_id?: string
          status?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "tag_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_job_items_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_jobs: {
        Row: {
          consecutive_429: number
          created_at: string
          done: number
          failed: number
          id: string
          last_run_at: string | null
          lease_until: string | null
          pause_reason: string | null
          scope: string
          status: string
          teacher_id: string
          total: number
          updated_at: string
        }
        Insert: {
          consecutive_429?: number
          created_at?: string
          done?: number
          failed?: number
          id?: string
          last_run_at?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          scope?: string
          status?: string
          teacher_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          consecutive_429?: number
          created_at?: string
          done?: number
          failed?: number
          id?: string
          last_run_at?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          scope?: string
          status?: string
          teacher_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
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
      teacher_security: {
        Row: {
          created_at: string
          pin_hash: string | null
          pin_reset_at: string | null
          pin_reset_by: string | null
          pin_set_at: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          pin_hash?: string | null
          pin_reset_at?: string | null
          pin_reset_by?: string | null
          pin_set_at?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          pin_hash?: string | null
          pin_reset_at?: string | null
          pin_reset_by?: string | null
          pin_set_at?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_settings: {
        Row: {
          attempt_window: number
          auto_archive_enabled: boolean
          auto_tag_on_import: boolean
          google_quiz_target: string
          mastery_threshold: number
          pseudonym_style: string
          reveal_default: boolean
          teacher_id: string
          updated_at: string
        }
        Insert: {
          attempt_window?: number
          auto_archive_enabled?: boolean
          auto_tag_on_import?: boolean
          google_quiz_target?: string
          mastery_threshold?: number
          pseudonym_style?: string
          reveal_default?: boolean
          teacher_id: string
          updated_at?: string
        }
        Update: {
          attempt_window?: number
          auto_archive_enabled?: boolean
          auto_tag_on_import?: boolean
          google_quiz_target?: string
          mastery_threshold?: number
          pseudonym_style?: string
          reveal_default?: boolean
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      textbook_chapters: {
        Row: {
          created_at: string
          id: string
          lesson_id: string | null
          library_item_id: string | null
          part_title: string | null
          sort_order: number
          source: string
          teacher_id: string
          textbook_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          library_item_id?: string | null
          part_title?: string | null
          sort_order?: number
          source: string
          teacher_id: string
          textbook_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string | null
          library_item_id?: string | null
          part_title?: string | null
          sort_order?: number
          source?: string
          teacher_id?: string
          textbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "textbook_chapters_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "curriculum_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textbook_chapters_library_item_id_fkey"
            columns: ["library_item_id"]
            isOneToOne: false
            referencedRelation: "library_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textbook_chapters_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "textbooks"
            referencedColumns: ["id"]
          },
        ]
      }
      textbooks: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          grade: string | null
          id: string
          is_published: boolean
          share_token: string | null
          subject: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          grade?: string | null
          id?: string
          is_published?: boolean
          share_token?: string | null
          subject?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          grade?: string | null
          id?: string
          is_published?: boolean
          share_token?: string | null
          subject?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          date_end: string | null
          date_start: string | null
          description: string | null
          discipline: string | null
          grade_level: string | null
          id: string
          sort_order: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          description?: string | null
          discipline?: string | null
          grade_level?: string | null
          id?: string
          sort_order?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_end?: string | null
          date_start?: string | null
          description?: string | null
          discipline?: string | null
          grade_level?: string | null
          id?: string
          sort_order?: number | null
          title?: string
          updated_at?: string
          user_id?: string
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
      worker_ticks: {
        Row: {
          created_at: string
          token: string
        }
        Insert: {
          created_at?: string
          token: string
        }
        Update: {
          created_at?: string
          token?: string
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
          principal_status: string
          roles: Database["public"]["Enums"]["app_role"][]
          school: string
          user_id: string
        }[]
      }
      admin_reset_security_pin: {
        Args: { _user_id: string }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: { _role: string; _user_id: string }
        Returns: undefined
      }
      admin_set_user_school: {
        Args: { _school: string; _user_id: string }
        Returns: undefined
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
      analytics_compare_classes: {
        Args: {
          _assignment_group_id?: string
          _assignment_id?: string
          _course_ids: string[]
          _standard_id?: string
        }
        Returns: {
          avg_score: number
          band: string
          count: number
          course_id: string
          course_name: string
          total_n: number
        }[]
      }
      analytics_compare_classes_students: {
        Args: {
          _assignment_group_id?: string
          _assignment_id?: string
          _course_ids: string[]
          _standard_id?: string
        }
        Returns: {
          band: string
          course_id: string
          course_name: string
          score: number
          student_id: string
          student_name: string
        }[]
      }
      analytics_dok_breakdown: {
        Args: { _course_id?: string; _framework?: string; _subject?: string }
        Returns: {
          avg_pct_correct: number
          dok_level: number
          question_count: number
          responses: number
          standards_covered: number
          students: number
        }[]
      }
      analytics_dok_standard_matrix: {
        Args: { _course_id?: string; _framework?: string; _subject?: string }
        Returns: {
          avg_pct_correct: number
          code: string
          description: string
          dok_level: number
          framework: string
          question_count: number
          responses: number
          standard_id: string
          subject: string
        }[]
      }
      analytics_dok_trends: {
        Args: { _course_id?: string; _granularity?: string; _subject?: string }
        Returns: {
          avg_pct_correct: number
          bucket_label: string
          bucket_ts: string
          dok_level: number
          question_count: number
          responses: number
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
      apply_assignment_group: {
        Args: { _assignment_ids: string[]; _group_id?: string; _name: string }
        Returns: string
      }
      apply_assignment_group_in_class_group: {
        Args: {
          _assignment_ids: string[]
          _class_group_id: string
          _group_id?: string
          _name: string
        }
        Returns: string
      }
      approve_principal: {
        Args: { _approve: boolean; _user_id: string }
        Returns: undefined
      }
      building_breakdown: {
        Args: {
          _courses?: string[]
          _dims: string[]
          _grades?: string[]
          _school_year?: string
          _student_search?: string
          _subjects?: string[]
          _teachers?: string[]
        }
        Returns: {
          advanced: number
          avg_mastery: number
          basic: number
          class_count: number
          key1: string
          key2: string
          label1: string
          label2: string
          pct_mastered: number
          proficient: number
          standards_assessed: number
          student_count: number
          teacher_count: number
        }[]
      }
      building_facts: {
        Args: {
          _courses?: string[]
          _grades?: string[]
          _school_year?: string
          _student_search?: string
          _subjects?: string[]
          _teachers?: string[]
        }
        Returns: {
          computed_at: string
          course_id: string
          course_name: string
          grade: string
          mastered: boolean
          mastery_score: number
          standard_code: string
          standard_description: string
          standard_id: string
          student_id: string
          student_label: string
          subject: string
          teacher_id: string
          teacher_name: string
        }[]
      }
      building_filter_options: {
        Args: { _school_year?: string }
        Returns: Json
      }
      building_overview: {
        Args: {
          _courses?: string[]
          _grades?: string[]
          _school_year?: string
          _student_search?: string
          _subjects?: string[]
          _teachers?: string[]
        }
        Returns: {
          advanced: number
          avg_mastery: number
          basic: number
          class_count: number
          pct_mastered: number
          proficient: number
          standards_assessed: number
          student_count: number
          teacher_count: number
          trend: Json
        }[]
      }
      building_scope_courses: {
        Args: {
          _courses?: string[]
          _grades?: string[]
          _school_year?: string
          _subjects?: string[]
          _teachers?: string[]
        }
        Returns: {
          course_id: string
          course_name: string
          grade: string
          subject: string
          teacher_id: string
          teacher_name: string
        }[]
      }
      building_student_history: {
        Args: { _student_id: string }
        Returns: {
          attempts: number
          course_id: string
          course_name: string
          grade: string
          last_assessed: string
          mastered: boolean
          mastery_score: number
          school_year: string
          standard_code: string
          standard_description: string
          standard_id: string
          subject: string
          teacher_name: string
        }[]
      }
      create_class_group: {
        Args: { _course_ids: string[]; _name: string }
        Returns: string
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
      default_framework_for_subject: {
        Args: { _subject: string }
        Returns: string
      }
      department_assessments: {
        Args: { _grades?: string[]; _school_year?: string; _subject: string }
        Returns: {
          avg_percentage: number
          class_count: number
          display_name: string
          name_normalized: string
          standards_tagged: number
          submission_count: number
          teacher_count: number
        }[]
      }
      department_classes: {
        Args: { _grades?: string[]; _school_year?: string; _subject: string }
        Returns: {
          avg_mastery: number
          course_id: string
          display_label: string
          grade: string
          is_own: boolean
          pct_mastered: number
          student_count: number
        }[]
      }
      department_membership: {
        Args: { _grades?: string[]; _school_year?: string; _subject: string }
        Returns: {
          teacher_id: string
        }[]
      }
      department_overview: {
        Args: { _grades?: string[]; _school_year?: string; _subject: string }
        Returns: {
          avg_mastery: number
          class_count: number
          distribution: Json
          pct_mastered: number
          student_count: number
          teacher_count: number
          trend: Json
        }[]
      }
      department_scope_courses: {
        Args: { _grades?: string[]; _school_year?: string; _subject: string }
        Returns: {
          course_id: string
          grade: string
          name: string
          teacher_id: string
        }[]
      }
      department_standard_class_matrix: {
        Args: { _grades?: string[]; _school_year?: string; _subject: string }
        Returns: {
          avg_mastery: number
          class_grade: string
          class_label: string
          course_id: string
          is_own: boolean
          pct_mastered: number
          standard_code: string
          standard_description: string
          standard_grade: string
          standard_id: string
          students_assessed: number
          students_mastered: number
        }[]
      }
      department_standards: {
        Args: { _grades?: string[]; _school_year?: string; _subject: string }
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
        }[]
      }
      department_student_standard_matrix: {
        Args: { _grades?: string[]; _school_year?: string; _subject: string }
        Returns: {
          class_label: string
          is_own: boolean
          mastered: boolean
          mastery_score: number
          standard_code: string
          standard_id: string
          student_id: string
          student_label: string
        }[]
      }
      department_students: {
        Args: { _grades?: string[]; _school_year?: string; _subject: string }
        Returns: {
          avg_mastery: number
          class_label: string
          display_name: string
          grade: string
          is_own: boolean
          last_activity: string
          standards_assessed: number
          standards_mastered: number
          student_id: string
        }[]
      }
      department_subjects: {
        Args: { _school_year?: string }
        Returns: {
          class_count: number
          grades: string[]
          student_count: number
          subject: string
          teacher_count: number
        }[]
      }
      enqueue_untagged_questions: {
        Args: { _assignment_ids?: string[]; _scope?: string }
        Returns: Json
      }
      enqueue_untagged_questions_for: {
        Args: {
          _assignment_ids?: string[]
          _scope: string
          _teacher_id: string
        }
        Returns: Json
      }
      force_archive_state: {
        Args: { _archive: boolean; _course_id: string }
        Returns: boolean
      }
      generate_unique_student_code: { Args: never; Returns: string }
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
      get_google_connection_status: {
        Args: never
        Returns: {
          connected: boolean
          connected_at: string
          email: string
          scopes: string[]
        }[]
      }
      get_public_exam: {
        Args: { _exam_id: string }
        Returns: {
          grade_level: string
          hints_enabled: boolean
          id: string
          question_count: number
          questions: Json
          title: string
        }[]
      }
      get_public_review: {
        Args: { _exam_id: string }
        Returns: {
          exam_id: string
          exam_title: string
          flashcards: Json
          id: string
          review_lesson: Json
          study_guide: Json
        }[]
      }
      get_published_books: {
        Args: never
        Returns: {
          cover_url: string
          created_at: string
          file_path: string
          file_size: number
          id: string
          is_published: boolean
          page_count: number
          source_discipline: string
          title: string
          updated_at: string
        }[]
      }
      get_shared_book: {
        Args: { _share_token: string }
        Returns: {
          file_path: string
          id: string
          source_discipline: string
          title: string
        }[]
      }
      get_shared_note: {
        Args: { _token: string }
        Returns: {
          author_display_name: string
          content: Json
          icon: string
          id: string
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      get_shared_textbook: { Args: { _share_token: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_security_pin: { Args: never; Returns: boolean }
      is_course_active: { Args: { _course_id: string }; Returns: boolean }
      is_within_active_school_year: {
        Args: { _course_id: string }
        Returns: boolean
      }
      list_assignment_groups: {
        Args: never
        Returns: {
          assignment_ids: string[]
          avg_percentage: number
          confirmed: boolean
          course_count: number
          course_names: string[]
          grade: string
          group_id: string
          kind: Database["public"]["Enums"]["assignment_kind"]
          member_count: number
          name: string
          subject: string
          total_submissions: number
        }[]
      }
      list_class_groups: {
        Args: never
        Returns: {
          assessment_group_count: number
          course_count: number
          course_ids: string[]
          course_names: string[]
          created_at: string
          id: string
          name: string
          pending_suggestion_count: number
          updated_at: string
        }[]
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
      normalize_assignment_name: { Args: { _name: string }; Returns: string }
      principal_school: { Args: never; Returns: string }
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
      reveal_building_identities: {
        Args: { _pin: string; _reason?: string; _student_ids: string[] }
        Returns: {
          email: string
          real_name: string
          real_sortable_name: string
          student_id: string
        }[]
      }
      reveal_my_identities: {
        Args: { _pin?: string; _reason?: string }
        Returns: {
          email: string
          real_name: string
          real_sortable_name: string
          student_id: string
        }[]
      }
      reveal_question_identities: {
        Args: { _question_id: string; _reason?: string }
        Returns: {
          email: string
          real_name: string
          real_sortable_name: string
          student_id: string
        }[]
      }
      reveal_student_identities:
        | {
            Args: { _course_id: string; _reason?: string }
            Returns: {
              email: string
              real_name: string
              real_sortable_name: string
              student_id: string
            }[]
          }
        | {
            Args: { _course_id: string; _pin?: string; _reason?: string }
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
      search_library: {
        Args: { _kind?: string; _q?: string; _standard_id?: string }
        Returns: {
          item_id: string
          item_type: string
          rank: number
          snippet: string
          source: string
          standards: Json
          title: string
          updated_at: string
        }[]
      }
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
      set_security_pin: { Args: { _pin: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      suggest_assignment_groups: {
        Args: never
        Returns: {
          assignment_ids: string[]
          cluster_key: string
          course_count: number
          course_ids: string[]
          course_names: string[]
          grade: string
          kind: Database["public"]["Enums"]["assignment_kind"]
          member_count: number
          subject: string
          suggested_name: string
        }[]
      }
      suggest_assignment_groups_in_class_group: {
        Args: { _class_group_id: string }
        Returns: {
          assignment_ids: string[]
          cluster_key: string
          course_count: number
          course_ids: string[]
          course_names: string[]
          kind: Database["public"]["Enums"]["assignment_kind"]
          member_count: number
          suggested_name: string
        }[]
      }
      tag_job_active: {
        Args: never
        Returns: {
          consecutive_429: number
          created_at: string
          done: number
          failed: number
          id: string
          last_run_at: string | null
          lease_until: string | null
          pause_reason: string | null
          scope: string
          status: string
          teacher_id: string
          total: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "tag_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      tag_job_control: {
        Args: { _action: string; _job_id: string }
        Returns: undefined
      }
      tag_worker_arm: { Args: never; Returns: undefined }
      tag_worker_disarm: { Args: never; Returns: undefined }
      unlink_assignment_from_group: {
        Args: { _assignment_id: string }
        Returns: boolean
      }
      update_class_group: {
        Args: { _course_ids: string[]; _id: string; _name: string }
        Returns: boolean
      }
      verify_security_pin: { Args: { _pin: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "teacher" | "principal"
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
      app_role: ["admin", "teacher", "principal"],
      assignment_kind: ["assignment", "quiz"],
    },
  },
} as const
