export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Branch = "CSE" | "ECE" | "ENTC" | "CIVIL" | "AERO" | "MECH";
export type DocType =
  | "tenth"
  | "twelfth"
  | "sem1"
  | "sem2"
  | "sem3"
  | "sem4"
  | "sem5"
  | "sem6"
  | "sem7"
  | "sem8"
  | "resume"
  | "other";
export type CompanyType = "Service" | "Product" | "Startup" | "Government";
export type JobType = "Full-time" | "Internship" | "Both";
export type UserRole = "student" | "admin" | "super_admin";
export type ResumeTemplateType = "modern" | "classic" | "minimalist" | "creative";
export type ApplicationStatus = "applied" | "shortlisted" | "interview" | "rejected" | "selected";

export interface CompanyCriteria {
  tenth_min?: number;
  twelfth_min?: number;
  cgpa_min: number;
  branches: Branch[];
  backlogs_allowed: number;
  other_requirements?: string;
}

export interface ResumeData {
  personal: {
    name: string;
    email: string;
    phone?: string;
    linkedin?: string;
    github?: string;
    portfolio?: string;
  };
  education: Array<{
    degree: string;
    college: string;
    year: string;
    cgpa?: string;
  }>;
  experience: Array<{
    title: string;
    company: string;
    duration: string;
    description: string;
  }>;
  projects: Array<{
    name: string;
    tech: string[];
    description: string;
    link?: string;
    github?: string;
  }>;
  skills: {
    technical: string[];
    soft: string[];
  };
  certifications: Array<{
    name: string;
    issuer: string;
    date: string;
  }>;
  achievements: string[];
}

export interface ApplicationFormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "dropdown" | "file";
  required: boolean;
  options?: string[];
}

export interface ProcessTimelineItem {
  id: string;
  title: string;
  description?: string;
  planned_at?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export interface Database {
  public: {
    Tables: {
      students: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string;
          prn: string | null;
          branch: Branch | null;
          batch_year: number;
          phone: string | null;
          linkedin_url: string | null;
          github_url: string | null;
          portfolio_url: string | null;
          tenth_board: string | null;
          tenth_school: string | null;
          tenth_year: number | null;
          tenth_percentage: number | null;
          twelfth_board: string | null;
          twelfth_college: string | null;
          twelfth_year: number | null;
          twelfth_percentage: number | null;
          current_backlogs: number;
          cgpa_sem1: number | null;
          cgpa_sem2: number | null;
          cgpa_sem3: number | null;
          cgpa_sem4: number | null;
          cgpa_sem5: number | null;
          cgpa_sem6: number | null;
          cgpa_sem7: number | null;
          cgpa_sem8: number | null;
          overall_cgpa: number | null;
          documents_uploaded: number;
          profile_complete: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          avatar_url: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          email: string;
          prn?: string | null;
          branch?: Branch | null;
          batch_year?: number;
          phone?: string | null;
          linkedin_url?: string | null;
          github_url?: string | null;
          portfolio_url?: string | null;
          tenth_board?: string | null;
          tenth_school?: string | null;
          tenth_year?: number | null;
          tenth_percentage?: number | null;
          twelfth_board?: string | null;
          twelfth_college?: string | null;
          twelfth_year?: number | null;
          twelfth_percentage?: number | null;
          current_backlogs?: number;
          cgpa_sem1?: number | null;
          cgpa_sem2?: number | null;
          cgpa_sem3?: number | null;
          cgpa_sem4?: number | null;
          cgpa_sem5?: number | null;
          cgpa_sem6?: number | null;
          cgpa_sem7?: number | null;
          cgpa_sem8?: number | null;
          documents_uploaded?: number;
          profile_complete?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          avatar_url?: string | null;
        };
        Update: {
          name?: string;
          email?: string;
          prn?: string | null;
          branch?: Branch | null;
          batch_year?: number;
          phone?: string | null;
          linkedin_url?: string | null;
          github_url?: string | null;
          portfolio_url?: string | null;
          tenth_board?: string | null;
          tenth_school?: string | null;
          tenth_year?: number | null;
          tenth_percentage?: number | null;
          twelfth_board?: string | null;
          twelfth_college?: string | null;
          twelfth_year?: number | null;
          twelfth_percentage?: number | null;
          current_backlogs?: number;
          cgpa_sem1?: number | null;
          cgpa_sem2?: number | null;
          cgpa_sem3?: number | null;
          cgpa_sem4?: number | null;
          cgpa_sem5?: number | null;
          cgpa_sem6?: number | null;
          cgpa_sem7?: number | null;
          cgpa_sem8?: number | null;
          documents_uploaded?: number;
          profile_complete?: boolean;
          is_active?: boolean;
          updated_at?: string;
          avatar_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      documents: {
        Row: {
          id: string;
          student_id: string;
          doc_type: DocType;
          file_url: string;
          file_name: string | null;
          file_size: number | null;
          verified: boolean;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          doc_type: DocType;
          file_url: string;
          file_name?: string | null;
          file_size?: number | null;
          verified?: boolean;
          uploaded_at?: string;
        };
        Update: {
          file_url?: string;
          file_name?: string | null;
          file_size?: number | null;
          verified?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "documents_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      companies: {
        Row: {
          id: string;
          name: string;
          logo_url: string | null;
          description: string | null;
          company_type: CompanyType;
          job_type: JobType;
          location: string | null;
          package_range: string | null;
          criteria_json: Json;
          application_form_fields: Json;
          process_timeline: Json;
          application_deadline: string | null;
          target_role: string | null;
          active: boolean;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          logo_url?: string | null;
          description?: string | null;
          company_type?: CompanyType;
          job_type?: JobType;
          location?: string | null;
          package_range?: string | null;
          criteria_json?: Json;
          application_form_fields?: Json;
          process_timeline?: Json;
          application_deadline?: string | null;
          target_role?: string | null;
          active?: boolean;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          logo_url?: string | null;
          description?: string | null;
          company_type?: CompanyType;
          job_type?: JobType;
          location?: string | null;
          package_range?: string | null;
          criteria_json?: Json;
          application_form_fields?: Json;
          process_timeline?: Json;
          application_deadline?: string | null;
          target_role?: string | null;
          active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      resumes: {
        Row: {
          id: string;
          student_id: string;
          title: string;
          template_type: ResumeTemplateType;
          resume_data: Json;
          file_url: string | null;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          title: string;
          template_type?: ResumeTemplateType;
          resume_data?: Json;
          file_url?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          template_type?: ResumeTemplateType;
          resume_data?: Json;
          file_url?: string | null;
          is_default?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resumes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      applications: {
        Row: {
          id: string;
          student_id: string;
          company_id: string;
          resume_id: string | null;
          status: ApplicationStatus;
          cover_letter: string | null;
          additional_info: Json;
          admin_notes: string | null;
          applied_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          company_id: string;
          resume_id?: string | null;
          status?: ApplicationStatus;
          cover_letter?: string | null;
          additional_info?: Json;
          admin_notes?: string | null;
          applied_at?: string;
          updated_at?: string;
        };
        Update: {
          resume_id?: string | null;
          status?: ApplicationStatus;
          cover_letter?: string | null;
          additional_info?: Json;
          admin_notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_resume_id_fkey";
            columns: ["resume_id"];
            isOneToOne: false;
            referencedRelation: "resumes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string | null;
          subject: string | null;
          message: string;
          is_broadcast: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id?: string | null;
          subject?: string | null;
          message: string;
          is_broadcast?: boolean;
          created_at?: string;
        };
        Update: {
          subject?: string | null;
          message?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      message_recipients: {
        Row: {
          id: string;
          message_id: string;
          recipient_id: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          recipient_id: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          read_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "message_recipients_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_recipients_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      labs: {
        Row: {
          id: string;
          owner_id: string;
          lab_name: string;
          total_seats: number;
          rows: number | null;
          columns: number | null;
          seat_pattern: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          lab_name: string;
          total_seats: number;
          rows?: number | null;
          columns?: number | null;
          seat_pattern?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          lab_name?: string;
          total_seats?: number;
          rows?: number | null;
          columns?: number | null;
          seat_pattern?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "labs_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      seat_sessions: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          scheduled_at: string | null;
          source_mode: "direct" | "upload";
          status: "draft" | "ready" | "published";
          is_published: boolean;
          published_at: string | null;
          published_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title?: string;
          scheduled_at?: string | null;
          source_mode: "direct" | "upload";
          status?: "draft" | "ready" | "published";
          is_published?: boolean;
          published_at?: string | null;
          published_by?: string | null;
          created_at?: string;
        };
        Update: {
          title?: string;
          scheduled_at?: string | null;
          source_mode?: "direct" | "upload";
          status?: "draft" | "ready" | "published";
          is_published?: boolean;
          published_at?: string | null;
          published_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "seat_sessions_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seat_sessions_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      seat_session_candidates: {
        Row: {
          id: string;
          session_id: string;
          student_id: string | null;
          prn: string;
          name_snapshot: string | null;
          branch_snapshot: string | null;
          source_mode: "direct" | "upload";
          source_row_no: number | null;
          match_status: "matched" | "unmatched" | "duplicate" | "overflow" | "removed";
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          student_id?: string | null;
          prn: string;
          name_snapshot?: string | null;
          branch_snapshot?: string | null;
          source_mode: "direct" | "upload";
          source_row_no?: number | null;
          match_status: "matched" | "unmatched" | "duplicate" | "overflow" | "removed";
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          student_id?: string | null;
          prn?: string;
          name_snapshot?: string | null;
          branch_snapshot?: string | null;
          source_mode?: "direct" | "upload";
          source_row_no?: number | null;
          match_status?: "matched" | "unmatched" | "duplicate" | "overflow" | "removed";
          error_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "seat_session_candidates_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "seat_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seat_session_candidates_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          }
        ];
      };
      seat_assignments: {
        Row: {
          id: string;
          session_id: string;
          candidate_id: string | null;
          student_id: string | null;
          lab_id: string;
          seat_number: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          candidate_id?: string | null;
          student_id?: string | null;
          lab_id: string;
          seat_number: string;
          created_at?: string;
        };
        Update: {
          candidate_id?: string | null;
          student_id?: string | null;
          lab_id?: string;
          seat_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seat_assignments_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "seat_session_candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seat_assignments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "seat_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seat_assignments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "seat_assignments_lab_id_fkey";
            columns: ["lab_id"];
            isOneToOne: false;
            referencedRelation: "labs";
            referencedColumns: ["id"];
          }
        ];
      };
      students_temp: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          roll_number: string;
          department: string | null;
          upload_session_id: string;
          parse_source: "xlsx" | "csv" | "pdf" | null;
          raw_row: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          roll_number: string;
          department?: string | null;
          upload_session_id: string;
          parse_source?: "xlsx" | "csv" | "pdf" | null;
          raw_row?: Json | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          roll_number?: string;
          department?: string | null;
          parse_source?: "xlsx" | "csv" | "pdf" | null;
          raw_row?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "students_temp_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      allocation_sessions: {
        Row: {
          id: string;
          owner_id: string;
          upload_session_id: string;
          mode: "alphabetical" | "random";
          status: string;
          seed: number | null;
          metadata: Json | null;
          is_published: boolean;
          published_at: string | null;
          published_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          upload_session_id: string;
          mode?: "alphabetical" | "random";
          status?: string;
          seed?: number | null;
          metadata?: Json | null;
          is_published?: boolean;
          published_at?: string | null;
          published_by?: string | null;
          created_at?: string;
        };
        Update: {
          mode?: "alphabetical" | "random";
          status?: string;
          seed?: number | null;
          metadata?: Json | null;
          is_published?: boolean;
          published_at?: string | null;
          published_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "allocation_sessions_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocation_sessions_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      allocations: {
        Row: {
          id: string;
          owner_id: string;
          student_id: string;
          matched_student_id: string | null;
          lab_id: string;
          lab_name_snapshot: string;
          seat_number: string;
          session_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          student_id: string;
          matched_student_id?: string | null;
          lab_id: string;
          lab_name_snapshot: string;
          seat_number: string;
          session_id: string;
          created_at?: string;
        };
        Update: {
          matched_student_id?: string | null;
          lab_name_snapshot?: string;
          seat_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "allocations_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students_temp";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_matched_student_id_fkey";
            columns: ["matched_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_lab_id_fkey";
            columns: ["lab_id"];
            isOneToOne: false;
            referencedRelation: "labs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "allocation_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
      document_settings: {
        Row: {
          id: string;
          owner_id: string;
          institute_name: string;
          exam_title: string;
          subject: string;
          logo_url: string | null;
          footer_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          institute_name: string;
          exam_title: string;
          subject: string;
          logo_url?: string | null;
          footer_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          institute_name?: string;
          exam_title?: string;
          subject?: string;
          logo_url?: string | null;
          footer_text?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "document_settings_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: UserRole;
          is_active: boolean;
        };
        Insert: {
          user_id: string;
          role?: UserRole;
          is_active?: boolean;
        };
        Update: {
          role?: UserRole;
          is_active?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      application_events: {
        Row: {
          id: string;
          application_id: string;
          from_status: ApplicationStatus | null;
          to_status: ApplicationStatus;
          note: string | null;
          actor_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          application_id: string;
          from_status?: ApplicationStatus | null;
          to_status: ApplicationStatus;
          note?: string | null;
          actor_id?: string | null;
          created_at?: string;
        };
        Update: {
          note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      student_activity_logs: {
        Row: {
          id: string;
          student_id: string;
          action: string;
          metadata: Json;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          action: string;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          action?: string;
          metadata?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "student_activity_logs_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_activity_logs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_eligibility: {
        Args: { student_id: string; company_id: string };
        Returns: EligibilityResult;
      };
      get_eligible_students_for_company: {
        Args: { company_id: string };
        Returns: {
          student_id: string;
          name: string;
          email: string;
          prn: string | null;
          branch: Branch | null;
          overall_cgpa: number | null;
        }[];
      };
      publish_seat_allocation_session: {
        Args: { p_session_id: string };
        Returns: {
          id: string;
          owner_id: string;
          upload_session_id: string;
          mode: "alphabetical" | "random";
          status: string;
          seed: number | null;
          metadata: Json | null;
          is_published: boolean;
          published_at: string | null;
          published_by: string | null;
          created_at: string;
        };
      };
      publish_seat_session: {
        Args: { p_session_id: string };
        Returns: {
          id: string;
          owner_id: string;
          title: string;
          source_mode: "direct" | "upload";
          status: "draft" | "ready" | "published";
          is_published: boolean;
          published_at: string | null;
          published_by: string | null;
          created_at: string;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
