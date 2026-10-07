export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string;
          created_by: string | null;
          is_active: boolean;
          permissions: string[];
          profile_id: string;
          role: Database["public"]["Enums"]["admin_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          is_active?: boolean;
          permissions?: string[];
          profile_id: string;
          role?: Database["public"]["Enums"]["admin_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          is_active?: boolean;
          permissions?: string[];
          profile_id?: string;
          role?: Database["public"]["Enums"]["admin_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "admin_users_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "admin_users_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_job_alert_hits: {
        Row: {
          alert_id: string;
          created_at: string;
          vacancy_id: string;
        };
        Insert: {
          alert_id: string;
          created_at?: string;
          vacancy_id: string;
        };
        Update: {
          alert_id?: string;
          created_at?: string;
          vacancy_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_job_alert_hits_alert_id_fkey";
            columns: ["alert_id"];
            isOneToOne: false;
            referencedRelation: "ai_job_alerts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_job_alert_hits_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_job_alerts: {
        Row: {
          category_id: string | null;
          created_at: string;
          district_ids: string[];
          employment_types: Database["public"]["Enums"]["employment_type"][];
          hits_count: number;
          id: string;
          is_active: boolean;
          is_remote: boolean;
          label: string;
          last_hit_at: string | null;
          no_experience: boolean;
          paid_until: string | null;
          profession_node_id: string | null;
          profile_id: string;
          prompt: string;
          q: string | null;
          region_id: string | null;
          salary_min: number | null;
          schedules: Database["public"]["Enums"]["work_schedule"][];
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          district_ids?: string[];
          employment_types?: Database["public"]["Enums"]["employment_type"][];
          hits_count?: number;
          id?: string;
          is_active?: boolean;
          is_remote?: boolean;
          label: string;
          last_hit_at?: string | null;
          no_experience?: boolean;
          paid_until?: string | null;
          profession_node_id?: string | null;
          profile_id: string;
          prompt: string;
          q?: string | null;
          region_id?: string | null;
          salary_min?: number | null;
          schedules?: Database["public"]["Enums"]["work_schedule"][];
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          district_ids?: string[];
          employment_types?: Database["public"]["Enums"]["employment_type"][];
          hits_count?: number;
          id?: string;
          is_active?: boolean;
          is_remote?: boolean;
          label?: string;
          last_hit_at?: string | null;
          no_experience?: boolean;
          paid_until?: string | null;
          profession_node_id?: string | null;
          profile_id?: string;
          prompt?: string;
          q?: string | null;
          region_id?: string | null;
          salary_min?: number | null;
          schedules?: Database["public"]["Enums"]["work_schedule"][];
        };
        Relationships: [
          {
            foreignKeyName: "ai_job_alerts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_job_alerts_profession_node_id_fkey";
            columns: ["profession_node_id"];
            isOneToOne: false;
            referencedRelation: "profession_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_job_alerts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_job_alerts_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          is_public: boolean;
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        Insert: {
          is_public?: boolean;
          key: string;
          updated_at?: string;
          value: NonNullable<Json>;
        };
        Update: {
          is_public?: boolean;
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
      application_events: {
        Row: {
          actor_id: string | null;
          application_id: string;
          created_at: string;
          from_status: Database["public"]["Enums"]["application_status"] | null;
          id: number;
          note: string | null;
          to_status: Database["public"]["Enums"]["application_status"];
        };
        Insert: {
          actor_id?: string | null;
          application_id: string;
          created_at?: string;
          from_status?:
            Database["public"]["Enums"]["application_status"] | null;
          id?: never;
          note?: string | null;
          to_status: Database["public"]["Enums"]["application_status"];
        };
        Update: {
          actor_id?: string | null;
          application_id?: string;
          created_at?: string;
          from_status?:
            Database["public"]["Enums"]["application_status"] | null;
          id?: never;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["application_status"];
        };
        Relationships: [
          {
            foreignKeyName: "application_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_events_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      application_notes: {
        Row: {
          application_id: string;
          author_id: string | null;
          body: string;
          created_at: string;
          id: string;
        };
        Insert: {
          application_id: string;
          author_id?: string | null;
          body: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          application_id?: string;
          author_id?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "application_notes_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "application_notes_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          cover_message: string | null;
          created_at: string;
          id: string;
          interview_at: string | null;
          interview_place: string | null;
          match_reasons: Json | null;
          match_score: number | null;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
          vacancy_id: string;
          viewed_at: string | null;
          worker_id: string;
        };
        Insert: {
          cover_message?: string | null;
          created_at?: string;
          id?: string;
          interview_at?: string | null;
          interview_place?: string | null;
          match_reasons?: Json | null;
          match_score?: number | null;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
          vacancy_id: string;
          viewed_at?: string | null;
          worker_id: string;
        };
        Update: {
          cover_message?: string | null;
          created_at?: string;
          id?: string;
          interview_at?: string | null;
          interview_place?: string | null;
          match_reasons?: Json | null;
          match_score?: number | null;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
          vacancy_id?: string;
          viewed_at?: string | null;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          id: number;
          ip: unknown;
          target_id: string | null;
          target_type: string;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          id?: never;
          ip?: unknown;
          target_id?: string | null;
          target_type: string;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          id?: never;
          ip?: unknown;
          target_id?: string | null;
          target_type?: string;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      benefits: {
        Row: {
          code: string;
          is_active: boolean;
          kind: string;
          name_ru: string;
          name_uz: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          is_active?: boolean;
          kind?: string;
          name_ru: string;
          name_uz: string;
          sort_order?: number;
        };
        Update: {
          code?: string;
          is_active?: boolean;
          kind?: string;
          name_ru?: string;
          name_uz?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      billing_usage: {
        Row: {
          free_promotion_used_at: string | null;
          free_vacancy_used_at: string | null;
          profile_id: string;
        };
        Insert: {
          free_promotion_used_at?: string | null;
          free_vacancy_used_at?: string | null;
          profile_id: string;
        };
        Update: {
          free_promotion_used_at?: string | null;
          free_vacancy_used_at?: string | null;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "billing_usage_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      bot_sessions: {
        Row: {
          data: NonNullable<Json>;
          flow: string;
          profile_id: string | null;
          step: string;
          telegram_user_id: number;
          updated_at: string;
        };
        Insert: {
          data?: NonNullable<Json>;
          flow?: string;
          profile_id?: string | null;
          step: string;
          telegram_user_id: number;
          updated_at?: string;
        };
        Update: {
          data?: NonNullable<Json>;
          flow?: string;
          profile_id?: string | null;
          step?: string;
          telegram_user_id?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bot_sessions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          is_active: boolean;
          name_en: string | null;
          name_ru: string;
          name_uz: string;
          portfolio_recommended: boolean;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_ru: string;
          name_uz: string;
          portfolio_recommended?: boolean;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_ru?: string;
          name_uz?: string;
          portfolio_recommended?: boolean;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          about: string | null;
          address: string | null;
          created_at: string;
          created_by: string | null;
          district_id: string | null;
          id: string;
          industry_category_id: string | null;
          instagram: string | null;
          is_blocked: boolean;
          is_government: boolean;
          logo_url: string | null;
          name: string;
          phone: string | null;
          region_id: string | null;
          size: Database["public"]["Enums"]["company_size"] | null;
          slug: string;
          telegram: string | null;
          tin: string | null;
          updated_at: string;
          verification_status: Database["public"]["Enums"]["verification_status"];
          verified_at: string | null;
          website: string | null;
        };
        Insert: {
          about?: string | null;
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          district_id?: string | null;
          id?: string;
          industry_category_id?: string | null;
          instagram?: string | null;
          is_blocked?: boolean;
          is_government?: boolean;
          logo_url?: string | null;
          name: string;
          phone?: string | null;
          region_id?: string | null;
          size?: Database["public"]["Enums"]["company_size"] | null;
          slug: string;
          telegram?: string | null;
          tin?: string | null;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
          verified_at?: string | null;
          website?: string | null;
        };
        Update: {
          about?: string | null;
          address?: string | null;
          created_at?: string;
          created_by?: string | null;
          district_id?: string | null;
          id?: string;
          industry_category_id?: string | null;
          instagram?: string | null;
          is_blocked?: boolean;
          is_government?: boolean;
          logo_url?: string | null;
          name?: string;
          phone?: string | null;
          region_id?: string | null;
          size?: Database["public"]["Enums"]["company_size"] | null;
          slug?: string;
          telegram?: string | null;
          tin?: string | null;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
          verified_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "companies_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "companies_industry_category_id_fkey";
            columns: ["industry_category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "companies_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      company_invites: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          company_id: string;
          created_at: string;
          expires_at: string;
          id: string;
          invited_by: string;
          role: Database["public"]["Enums"]["company_member_role"];
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          company_id: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by: string;
          role?: Database["public"]["Enums"]["company_member_role"];
          token?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          company_id?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          role?: Database["public"]["Enums"]["company_member_role"];
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_invites_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_invites_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_invites_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      company_members: {
        Row: {
          company_id: string;
          created_at: string;
          invited_by: string | null;
          profile_id: string;
          role: Database["public"]["Enums"]["company_member_role"];
        };
        Insert: {
          company_id: string;
          created_at?: string;
          invited_by?: string | null;
          profile_id: string;
          role?: Database["public"]["Enums"]["company_member_role"];
        };
        Update: {
          company_id?: string;
          created_at?: string;
          invited_by?: string | null;
          profile_id?: string;
          role?: Database["public"]["Enums"]["company_member_role"];
        };
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_grants: {
        Row: {
          created_at: string;
          grantee_profile_id: string;
          owner_profile_id: string;
        };
        Insert: {
          created_at?: string;
          grantee_profile_id: string;
          owner_profile_id: string;
        };
        Update: {
          created_at?: string;
          grantee_profile_id?: string;
          owner_profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_grants_grantee_profile_id_fkey";
            columns: ["grantee_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_grants_owner_profile_id_fkey";
            columns: ["owner_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_requests: {
        Row: {
          created_at: string;
          id: string;
          owner_profile_id: string;
          requester_profile_id: string;
          responded_at: string | null;
          status: Database["public"]["Enums"]["contact_request_status"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          owner_profile_id: string;
          requester_profile_id: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["contact_request_status"];
        };
        Update: {
          created_at?: string;
          id?: string;
          owner_profile_id?: string;
          requester_profile_id?: string;
          responded_at?: string | null;
          status?: Database["public"]["Enums"]["contact_request_status"];
        };
        Relationships: [
          {
            foreignKeyName: "contact_requests_owner_profile_id_fkey";
            columns: ["owner_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_requests_requester_profile_id_fkey";
            columns: ["requester_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          is_blocked: boolean;
          is_muted: boolean;
          joined_at: string;
          last_read_at: string | null;
          profile_id: string;
        };
        Insert: {
          conversation_id: string;
          is_blocked?: boolean;
          is_muted?: boolean;
          joined_at?: string;
          last_read_at?: string | null;
          profile_id: string;
        };
        Update: {
          conversation_id?: string;
          is_blocked?: boolean;
          is_muted?: boolean;
          joined_at?: string;
          last_read_at?: string | null;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          application_id: string | null;
          created_at: string;
          id: string;
          job_offer_id: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
        };
        Insert: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          job_offer_id?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
        };
        Update: {
          application_id?: string | null;
          created_at?: string;
          id?: string;
          job_offer_id?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: true;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_job_offer_id_fkey";
            columns: ["job_offer_id"];
            isOneToOne: true;
            referencedRelation: "job_offers";
            referencedColumns: ["id"];
          },
        ];
      };
      custom_occupation_requests: {
        Row: {
          category_id: string | null;
          context: string;
          created_at: string;
          created_by: string;
          id: string;
          linked_node_id: string | null;
          normalized: string | null;
          raw_text: string;
          status: string;
          vacancy_id: string | null;
          worker_id: string | null;
        };
        Insert: {
          category_id?: string | null;
          context: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          linked_node_id?: string | null;
          normalized?: never;
          raw_text: string;
          status?: string;
          vacancy_id?: string | null;
          worker_id?: string | null;
        };
        Update: {
          category_id?: string | null;
          context?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          linked_node_id?: string | null;
          normalized?: never;
          raw_text?: string;
          status?: string;
          vacancy_id?: string | null;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "custom_occupation_requests_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_occupation_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_occupation_requests_linked_node_id_fkey";
            columns: ["linked_node_id"];
            isOneToOne: false;
            referencedRelation: "profession_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_occupation_requests_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "custom_occupation_requests_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      demo_vv: {
        Row: {
          cat: string | null;
          co: string | null;
          descr: string | null;
          descr_ru: string | null;
          dist: string | null;
          emp: Database["public"]["Enums"]["employment_type"] | null;
          exp: number | null;
          hours: number | null;
          remote: boolean | null;
          sched: Database["public"]["Enums"]["work_schedule"] | null;
          sf: number | null;
          st: number | null;
          stype: Database["public"]["Enums"]["salary_type"] | null;
          sub: string | null;
          title: string | null;
          title_ru: string | null;
        };
        Insert: {
          cat?: string | null;
          co?: string | null;
          descr?: string | null;
          descr_ru?: string | null;
          dist?: string | null;
          emp?: Database["public"]["Enums"]["employment_type"] | null;
          exp?: number | null;
          hours?: number | null;
          remote?: boolean | null;
          sched?: Database["public"]["Enums"]["work_schedule"] | null;
          sf?: number | null;
          st?: number | null;
          stype?: Database["public"]["Enums"]["salary_type"] | null;
          sub?: string | null;
          title?: string | null;
          title_ru?: string | null;
        };
        Update: {
          cat?: string | null;
          co?: string | null;
          descr?: string | null;
          descr_ru?: string | null;
          dist?: string | null;
          emp?: Database["public"]["Enums"]["employment_type"] | null;
          exp?: number | null;
          hours?: number | null;
          remote?: boolean | null;
          sched?: Database["public"]["Enums"]["work_schedule"] | null;
          sf?: number | null;
          st?: number | null;
          stype?: Database["public"]["Enums"]["salary_type"] | null;
          sub?: string | null;
          title?: string | null;
          title_ru?: string | null;
        };
        Relationships: [];
      };
      device_tokens: {
        Row: {
          created_at: string;
          id: string;
          last_seen_at: string;
          platform: Database["public"]["Enums"]["device_platform"];
          profile_id: string;
          token: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform: Database["public"]["Enums"]["device_platform"];
          profile_id: string;
          token: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_seen_at?: string;
          platform?: Database["public"]["Enums"]["device_platform"];
          profile_id?: string;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "device_tokens_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      districts: {
        Row: {
          id: string;
          is_active: boolean;
          kind: string;
          lat: number | null;
          lng: number | null;
          name_en: string | null;
          name_oz: string | null;
          name_ru: string;
          name_uz: string;
          region_id: string;
          slug: string;
          soato: string | null;
          sort_order: number;
          source: string | null;
          source_updated_at: string | null;
        };
        Insert: {
          id?: string;
          is_active?: boolean;
          kind?: string;
          lat?: number | null;
          lng?: number | null;
          name_en?: string | null;
          name_oz?: string | null;
          name_ru: string;
          name_uz: string;
          region_id: string;
          slug: string;
          soato?: string | null;
          sort_order?: number;
          source?: string | null;
          source_updated_at?: string | null;
        };
        Update: {
          id?: string;
          is_active?: boolean;
          kind?: string;
          lat?: number | null;
          lng?: number | null;
          name_en?: string | null;
          name_oz?: string | null;
          name_ru?: string;
          name_uz?: string;
          region_id?: string;
          slug?: string;
          soato?: string | null;
          sort_order?: number;
          source?: string | null;
          source_updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "districts_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      employer_profiles: {
        Row: {
          about: string | null;
          company_id: string | null;
          contact_phone: string | null;
          created_at: string;
          display_name: string | null;
          district_id: string | null;
          employer_type: Database["public"]["Enums"]["employer_type"];
          employer_type_note: string | null;
          id: string;
          onboarding_completed_at: string | null;
          profile_id: string;
          region_id: string | null;
          updated_at: string;
          verification_status: Database["public"]["Enums"]["verification_status"];
        };
        Insert: {
          about?: string | null;
          company_id?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          display_name?: string | null;
          district_id?: string | null;
          employer_type?: Database["public"]["Enums"]["employer_type"];
          employer_type_note?: string | null;
          id?: string;
          onboarding_completed_at?: string | null;
          profile_id: string;
          region_id?: string | null;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
        };
        Update: {
          about?: string | null;
          company_id?: string | null;
          contact_phone?: string | null;
          created_at?: string;
          display_name?: string | null;
          district_id?: string | null;
          employer_type?: Database["public"]["Enums"]["employer_type"];
          employer_type_note?: string | null;
          id?: string;
          onboarding_completed_at?: string | null;
          profile_id?: string;
          region_id?: string | null;
          updated_at?: string;
          verification_status?: Database["public"]["Enums"]["verification_status"];
        };
        Relationships: [
          {
            foreignKeyName: "employer_profiles_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employer_profiles_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employer_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "employer_profiles_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
        ];
      };
      job_offers: {
        Row: {
          company_id: string | null;
          created_at: string;
          employer_profile_id: string;
          expires_at: string | null;
          hired_at: string | null;
          id: string;
          message: string | null;
          responded_at: string | null;
          salary_from: number | null;
          salary_to: number | null;
          status: Database["public"]["Enums"]["offer_status"];
          title: string | null;
          updated_at: string;
          vacancy_id: string | null;
          viewed_at: string | null;
          worker_id: string;
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          employer_profile_id: string;
          expires_at?: string | null;
          hired_at?: string | null;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          salary_from?: number | null;
          salary_to?: number | null;
          status?: Database["public"]["Enums"]["offer_status"];
          title?: string | null;
          updated_at?: string;
          vacancy_id?: string | null;
          viewed_at?: string | null;
          worker_id: string;
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          employer_profile_id?: string;
          expires_at?: string | null;
          hired_at?: string | null;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          salary_from?: number | null;
          salary_to?: number | null;
          status?: Database["public"]["Enums"]["offer_status"];
          title?: string | null;
          updated_at?: string;
          vacancy_id?: string | null;
          viewed_at?: string | null;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_offers_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_offers_employer_profile_id_fkey";
            columns: ["employer_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_offers_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_offers_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      languages: {
        Row: {
          code: string;
          is_active: boolean;
          name_ru: string;
          name_uz: string;
          sort_order: number;
        };
        Insert: {
          code: string;
          is_active?: boolean;
          name_ru: string;
          name_uz: string;
          sort_order?: number;
        };
        Update: {
          code?: string;
          is_active?: boolean;
          name_ru?: string;
          name_uz?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      login_codes: {
        Row: {
          attempts: number;
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          phone: string;
          telegram_user_id: number;
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          phone: string;
          telegram_user_id: number;
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          phone?: string;
          telegram_user_id?: number;
        };
        Relationships: [
          {
            foreignKeyName: "login_codes_telegram_user_id_fkey";
            columns: ["telegram_user_id"];
            isOneToOne: false;
            referencedRelation: "telegram_accounts";
            referencedColumns: ["telegram_user_id"];
          },
        ];
      };
      matches: {
        Row: {
          computed_at: string;
          reasons: NonNullable<Json>;
          score: number;
          vacancy_id: string;
          worker_id: string;
        };
        Insert: {
          computed_at?: string;
          reasons?: NonNullable<Json>;
          score: number;
          vacancy_id: string;
          worker_id: string;
        };
        Update: {
          computed_at?: string;
          reasons?: NonNullable<Json>;
          score?: number;
          vacancy_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "matches_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "matches_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          attachment_meta: Json | null;
          attachment_path: string | null;
          body: string | null;
          conversation_id: string;
          created_at: string;
          deleted_at: string | null;
          id: number;
          lat: number | null;
          lng: number | null;
          sender_id: string | null;
          type: Database["public"]["Enums"]["message_type"];
        };
        Insert: {
          attachment_meta?: Json | null;
          attachment_path?: string | null;
          body?: string | null;
          conversation_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: never;
          lat?: number | null;
          lng?: number | null;
          sender_id?: string | null;
          type?: Database["public"]["Enums"]["message_type"];
        };
        Update: {
          attachment_meta?: Json | null;
          attachment_path?: string | null;
          body?: string | null;
          conversation_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: never;
          lat?: number | null;
          lng?: number | null;
          sender_id?: string | null;
          type?: Database["public"]["Enums"]["message_type"];
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: number;
          link: string | null;
          payload: NonNullable<Json>;
          profile_id: string;
          push_sent_at: string | null;
          read_at: string | null;
          telegram_sent_at: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Insert: {
          created_at?: string;
          id?: never;
          link?: string | null;
          payload?: NonNullable<Json>;
          profile_id: string;
          push_sent_at?: string | null;
          read_at?: string | null;
          telegram_sent_at?: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Update: {
          created_at?: string;
          id?: never;
          link?: string | null;
          payload?: NonNullable<Json>;
          profile_id?: string;
          push_sent_at?: string | null;
          read_at?: string | null;
          telegram_sent_at?: string | null;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          cancel_reason: number | null;
          cancelled_at: string | null;
          created_at: string;
          id: string;
          order_no: number;
          paid_at: string | null;
          profile_id: string | null;
          provider: Database["public"]["Enums"]["payment_provider"] | null;
          provider_cancel_time: number | null;
          provider_create_time: number | null;
          provider_perform_time: number | null;
          provider_state: number | null;
          provider_txn_id: string | null;
          purpose: Database["public"]["Enums"]["payment_purpose"];
          status: Database["public"]["Enums"]["payment_status"];
          vacancy_id: string | null;
          worker_id: string | null;
        };
        Insert: {
          amount: number;
          cancel_reason?: number | null;
          cancelled_at?: string | null;
          created_at?: string;
          id?: string;
          order_no?: never;
          paid_at?: string | null;
          profile_id?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"] | null;
          provider_cancel_time?: number | null;
          provider_create_time?: number | null;
          provider_perform_time?: number | null;
          provider_state?: number | null;
          provider_txn_id?: string | null;
          purpose: Database["public"]["Enums"]["payment_purpose"];
          status?: Database["public"]["Enums"]["payment_status"];
          vacancy_id?: string | null;
          worker_id?: string | null;
        };
        Update: {
          amount?: number;
          cancel_reason?: number | null;
          cancelled_at?: string | null;
          created_at?: string;
          id?: string;
          order_no?: never;
          paid_at?: string | null;
          profile_id?: string | null;
          provider?: Database["public"]["Enums"]["payment_provider"] | null;
          provider_cancel_time?: number | null;
          provider_create_time?: number | null;
          provider_perform_time?: number | null;
          provider_state?: number | null;
          provider_txn_id?: string | null;
          purpose?: Database["public"]["Enums"]["payment_purpose"];
          status?: Database["public"]["Enums"]["payment_status"];
          vacancy_id?: string | null;
          worker_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profession_nodes: {
        Row: {
          aliases: string[];
          category_id: string;
          created_at: string;
          depth: number;
          effective_subcategory_id: string | null;
          icon: string | null;
          id: string;
          is_active: boolean;
          is_popular: boolean;
          kind: string;
          metadata: NonNullable<Json>;
          name_en: string | null;
          name_ru: string;
          name_uz: string;
          parent_id: string | null;
          path: string[];
          search_text: string;
          selectable: boolean;
          slug: string;
          sort_order: number;
          subcategory_id: string | null;
          updated_at: string;
        };
        Insert: {
          aliases?: string[];
          category_id: string;
          created_at?: string;
          depth?: number;
          effective_subcategory_id?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          is_popular?: boolean;
          kind?: string;
          metadata?: NonNullable<Json>;
          name_en?: string | null;
          name_ru: string;
          name_uz: string;
          parent_id?: string | null;
          path?: string[];
          search_text?: string;
          selectable?: boolean;
          slug: string;
          sort_order?: number;
          subcategory_id?: string | null;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          category_id?: string;
          created_at?: string;
          depth?: number;
          effective_subcategory_id?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          is_popular?: boolean;
          kind?: string;
          metadata?: NonNullable<Json>;
          name_en?: string | null;
          name_ru?: string;
          name_uz?: string;
          parent_id?: string | null;
          path?: string[];
          search_text?: string;
          selectable?: boolean;
          slug?: string;
          sort_order?: number;
          subcategory_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profession_nodes_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profession_nodes_effective_subcategory_id_fkey";
            columns: ["effective_subcategory_id"];
            isOneToOne: false;
            referencedRelation: "subcategories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profession_nodes_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "profession_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profession_nodes_subcategory_id_fkey";
            columns: ["subcategory_id"];
            isOneToOne: false;
            referencedRelation: "subcategories";
            referencedColumns: ["id"];
          },
        ];
      };
      profile_contacts: {
        Row: {
          email: string | null;
          phone: string | null;
          phone_verified_at: string | null;
          phone_visibility: Database["public"]["Enums"]["phone_visibility"];
          profile_id: string;
          telegram_username: string | null;
          updated_at: string;
        };
        Insert: {
          email?: string | null;
          phone?: string | null;
          phone_verified_at?: string | null;
          phone_visibility?: Database["public"]["Enums"]["phone_visibility"];
          profile_id: string;
          telegram_username?: string | null;
          updated_at?: string;
        };
        Update: {
          email?: string | null;
          phone?: string | null;
          phone_verified_at?: string | null;
          phone_visibility?: Database["public"]["Enums"]["phone_visibility"];
          profile_id?: string;
          telegram_username?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_contacts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active_role: Database["public"]["Enums"]["app_role"] | null;
          avatar_url: string | null;
          birth_date: string | null;
          blocked_at: string | null;
          blocked_reason: string | null;
          created_at: string;
          first_name: string;
          gender: Database["public"]["Enums"]["gender"] | null;
          id: string;
          is_blocked: boolean;
          last_name: string;
          last_seen_at: string | null;
          locale: Database["public"]["Enums"]["app_locale"];
          updated_at: string;
        };
        Insert: {
          active_role?: Database["public"]["Enums"]["app_role"] | null;
          avatar_url?: string | null;
          birth_date?: string | null;
          blocked_at?: string | null;
          blocked_reason?: string | null;
          created_at?: string;
          first_name?: string;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id: string;
          is_blocked?: boolean;
          last_name?: string;
          last_seen_at?: string | null;
          locale?: Database["public"]["Enums"]["app_locale"];
          updated_at?: string;
        };
        Update: {
          active_role?: Database["public"]["Enums"]["app_role"] | null;
          avatar_url?: string | null;
          birth_date?: string | null;
          blocked_at?: string | null;
          blocked_reason?: string | null;
          created_at?: string;
          first_name?: string;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id?: string;
          is_blocked?: boolean;
          last_name?: string;
          last_seen_at?: string | null;
          locale?: Database["public"]["Enums"]["app_locale"];
          updated_at?: string;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: {
          count: number;
          key: string;
          window_start: string;
        };
        Insert: {
          count?: number;
          key: string;
          window_start: string;
        };
        Update: {
          count?: number;
          key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      regions: {
        Row: {
          country_code: string;
          id: string;
          is_active: boolean;
          name_en: string | null;
          name_oz: string | null;
          name_ru: string;
          name_uz: string;
          slug: string;
          soato: string | null;
          sort_order: number;
        };
        Insert: {
          country_code?: string;
          id?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_oz?: string | null;
          name_ru: string;
          name_uz: string;
          slug: string;
          soato?: string | null;
          sort_order?: number;
        };
        Update: {
          country_code?: string;
          id?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_oz?: string | null;
          name_ru?: string;
          name_uz?: string;
          slug?: string;
          soato?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_profile_id: string;
          resolution_note: string | null;
          resolved_by: string | null;
          status: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason: Database["public"]["Enums"]["report_reason"];
          reporter_profile_id: string;
          resolution_note?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id: string;
          target_type: Database["public"]["Enums"]["report_target"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          reason?: Database["public"]["Enums"]["report_reason"];
          reporter_profile_id?: string;
          resolution_note?: string | null;
          resolved_by?: string | null;
          status?: Database["public"]["Enums"]["report_status"];
          target_id?: string;
          target_type?: Database["public"]["Enums"]["report_target"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_reporter_profile_id_fkey";
            columns: ["reporter_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          application_id: string | null;
          author_profile_id: string;
          created_at: string;
          id: string;
          job_offer_id: string | null;
          moderated_by: string | null;
          moderation_note: string | null;
          rating: number;
          status: Database["public"]["Enums"]["review_status"];
          target_profile_id: string;
          text: string | null;
          updated_at: string;
        };
        Insert: {
          application_id?: string | null;
          author_profile_id: string;
          created_at?: string;
          id?: string;
          job_offer_id?: string | null;
          moderated_by?: string | null;
          moderation_note?: string | null;
          rating: number;
          status?: Database["public"]["Enums"]["review_status"];
          target_profile_id: string;
          text?: string | null;
          updated_at?: string;
        };
        Update: {
          application_id?: string | null;
          author_profile_id?: string;
          created_at?: string;
          id?: string;
          job_offer_id?: string | null;
          moderated_by?: string | null;
          moderation_note?: string | null;
          rating?: number;
          status?: Database["public"]["Enums"]["review_status"];
          target_profile_id?: string;
          text?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_author_profile_id_fkey";
            columns: ["author_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_job_offer_id_fkey";
            columns: ["job_offer_id"];
            isOneToOne: false;
            referencedRelation: "job_offers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_moderated_by_fkey";
            columns: ["moderated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_target_profile_id_fkey";
            columns: ["target_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_searches: {
        Row: {
          category_id: string | null;
          created_at: string;
          district_ids: string[];
          employment_types: Database["public"]["Enums"]["employment_type"][];
          id: string;
          is_remote: boolean;
          label: string;
          last_checked_at: string;
          no_experience: boolean;
          notify: boolean;
          profile_id: string;
          q: string | null;
          query_string: string;
          region_id: string | null;
          salary_min: number | null;
          schedules: Database["public"]["Enums"]["work_schedule"][];
          subcategory_id: string | null;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          district_ids?: string[];
          employment_types?: Database["public"]["Enums"]["employment_type"][];
          id?: string;
          is_remote?: boolean;
          label: string;
          last_checked_at?: string;
          no_experience?: boolean;
          notify?: boolean;
          profile_id: string;
          q?: string | null;
          query_string: string;
          region_id?: string | null;
          salary_min?: number | null;
          schedules?: Database["public"]["Enums"]["work_schedule"][];
          subcategory_id?: string | null;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          district_ids?: string[];
          employment_types?: Database["public"]["Enums"]["employment_type"][];
          id?: string;
          is_remote?: boolean;
          label?: string;
          last_checked_at?: string;
          no_experience?: boolean;
          notify?: boolean;
          profile_id?: string;
          q?: string | null;
          query_string?: string;
          region_id?: string | null;
          salary_min?: number | null;
          schedules?: Database["public"]["Enums"]["work_schedule"][];
          subcategory_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "saved_searches_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_searches_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_searches_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_searches_subcategory_id_fkey";
            columns: ["subcategory_id"];
            isOneToOne: false;
            referencedRelation: "subcategories";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_vacancies: {
        Row: {
          created_at: string;
          folder: string | null;
          vacancy_id: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          folder?: string | null;
          vacancy_id: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          folder?: string | null;
          vacancy_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_vacancies_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_vacancies_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_workers: {
        Row: {
          created_at: string;
          employer_profile_id: string;
          folder: string | null;
          note: string | null;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          employer_profile_id: string;
          folder?: string | null;
          note?: string | null;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          employer_profile_id?: string;
          folder?: string | null;
          note?: string | null;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_workers_employer_profile_id_fkey";
            columns: ["employer_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "saved_workers_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      search_logs: {
        Row: {
          created_at: string;
          id: number;
          profile_id: string | null;
          query: string;
          query_norm: string;
          results_count: number;
          scope: string;
          understood: NonNullable<Json>;
        };
        Insert: {
          created_at?: string;
          id?: never;
          profile_id?: string | null;
          query: string;
          query_norm: string;
          results_count: number;
          scope: string;
          understood?: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          id?: never;
          profile_id?: string | null;
          query?: string;
          query_norm?: string;
          results_count?: number;
          scope?: string;
          understood?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "search_logs_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      skill_question_options: {
        Row: {
          question_id: string;
          skill_id: string;
          sort_order: number;
        };
        Insert: {
          question_id: string;
          skill_id: string;
          sort_order?: number;
        };
        Update: {
          question_id?: string;
          skill_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "skill_question_options_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "skill_questions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "skill_question_options_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      skill_questions: {
        Row: {
          category_id: string;
          created_at: string;
          hint_ru: string | null;
          hint_uz: string | null;
          id: string;
          is_active: boolean;
          profession_node_id: string | null;
          slug: string;
          sort_order: number;
          subcategory_slugs: string[];
          title_ru: string;
          title_uz: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          hint_ru?: string | null;
          hint_uz?: string | null;
          id?: string;
          is_active?: boolean;
          profession_node_id?: string | null;
          slug: string;
          sort_order?: number;
          subcategory_slugs?: string[];
          title_ru: string;
          title_uz: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          hint_ru?: string | null;
          hint_uz?: string | null;
          id?: string;
          is_active?: boolean;
          profession_node_id?: string | null;
          slug?: string;
          sort_order?: number;
          subcategory_slugs?: string[];
          title_ru?: string;
          title_uz?: string;
        };
        Relationships: [
          {
            foreignKeyName: "skill_questions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "skill_questions_profession_node_id_fkey";
            columns: ["profession_node_id"];
            isOneToOne: false;
            referencedRelation: "profession_nodes";
            referencedColumns: ["id"];
          },
        ];
      };
      skills: {
        Row: {
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_approved: boolean;
          is_custom: boolean;
          name_en: string | null;
          name_ru: string;
          name_uz: string;
          slug: string;
          usage_count: number;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_approved?: boolean;
          is_custom?: boolean;
          name_en?: string | null;
          name_ru: string;
          name_uz: string;
          slug: string;
          usage_count?: number;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_approved?: boolean;
          is_custom?: boolean;
          name_en?: string | null;
          name_ru?: string;
          name_uz?: string;
          slug?: string;
          usage_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "skills_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subcategories: {
        Row: {
          aliases: string[];
          category_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name_en: string | null;
          name_ru: string;
          name_uz: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          aliases?: string[];
          category_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_ru: string;
          name_uz: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          category_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_en?: string | null;
          name_ru?: string;
          name_uz?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      telegram_accounts: {
        Row: {
          bot_started: boolean;
          first_name: string | null;
          language_code: string | null;
          last_name: string | null;
          last_seen_at: string | null;
          linked_at: string;
          phone: string | null;
          phone_shared_at: string | null;
          photo_url: string | null;
          profile_id: string;
          telegram_user_id: number;
          username: string | null;
        };
        Insert: {
          bot_started?: boolean;
          first_name?: string | null;
          language_code?: string | null;
          last_name?: string | null;
          last_seen_at?: string | null;
          linked_at?: string;
          phone?: string | null;
          phone_shared_at?: string | null;
          photo_url?: string | null;
          profile_id: string;
          telegram_user_id: number;
          username?: string | null;
        };
        Update: {
          bot_started?: boolean;
          first_name?: string | null;
          language_code?: string | null;
          last_name?: string | null;
          last_seen_at?: string | null;
          linked_at?: string;
          phone?: string | null;
          phone_shared_at?: string | null;
          photo_url?: string | null;
          profile_id?: string;
          telegram_user_id?: number;
          username?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "telegram_accounts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          profile_id: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          created_at?: string;
          profile_id: string;
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          created_at?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      vacancies: {
        Row: {
          address: string | null;
          age_max: number | null;
          age_min: number | null;
          applications_count: number;
          category_id: string | null;
          company_id: string | null;
          created_at: string;
          custom_profession: string | null;
          description: string | null;
          district_id: string | null;
          education_min: Database["public"]["Enums"]["education_level"] | null;
          employment_type: Database["public"]["Enums"]["employment_type"];
          experience_min_months: number;
          expires_at: string | null;
          featured_until: string | null;
          gender: Database["public"]["Enums"]["gender"] | null;
          id: string;
          is_featured: boolean;
          is_government: boolean;
          is_paid: boolean | null;
          is_remote: boolean;
          lat: number | null;
          lng: number | null;
          moderation_note: string | null;
          official_terms: string[];
          opportunity_type: Database["public"]["Enums"]["opportunity_type"];
          owner_profile_id: string | null;
          paid_until: string | null;
          positions_count: number;
          profession_node_id: string | null;
          published_at: string | null;
          region_id: string | null;
          requires_review: boolean;
          salary_from: number | null;
          salary_negotiable: boolean;
          salary_to: number | null;
          salary_type: Database["public"]["Enums"]["salary_type"];
          schedule: Database["public"]["Enums"]["work_schedule"];
          search_vector: unknown;
          slug: string;
          status: Database["public"]["Enums"]["vacancy_status"];
          student_friendly: boolean;
          subcategory_id: string | null;
          title: string;
          updated_at: string;
          views_count: number;
          work_format: Database["public"]["Enums"]["work_format"];
          work_time_from: string | null;
          work_time_to: string | null;
        };
        Insert: {
          address?: string | null;
          age_max?: number | null;
          age_min?: number | null;
          applications_count?: number;
          category_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          custom_profession?: string | null;
          description?: string | null;
          district_id?: string | null;
          education_min?: Database["public"]["Enums"]["education_level"] | null;
          employment_type?: Database["public"]["Enums"]["employment_type"];
          experience_min_months?: number;
          expires_at?: string | null;
          featured_until?: string | null;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id?: string;
          is_featured?: boolean;
          is_government?: boolean;
          is_paid?: boolean | null;
          is_remote?: boolean;
          lat?: number | null;
          lng?: number | null;
          moderation_note?: string | null;
          official_terms?: string[];
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"];
          owner_profile_id?: string | null;
          paid_until?: string | null;
          positions_count?: number;
          profession_node_id?: string | null;
          published_at?: string | null;
          region_id?: string | null;
          requires_review?: boolean;
          salary_from?: number | null;
          salary_negotiable?: boolean;
          salary_to?: number | null;
          salary_type?: Database["public"]["Enums"]["salary_type"];
          schedule?: Database["public"]["Enums"]["work_schedule"];
          search_vector?: unknown;
          slug: string;
          status?: Database["public"]["Enums"]["vacancy_status"];
          student_friendly?: boolean;
          subcategory_id?: string | null;
          title: string;
          updated_at?: string;
          views_count?: number;
          work_format?: Database["public"]["Enums"]["work_format"];
          work_time_from?: string | null;
          work_time_to?: string | null;
        };
        Update: {
          address?: string | null;
          age_max?: number | null;
          age_min?: number | null;
          applications_count?: number;
          category_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          custom_profession?: string | null;
          description?: string | null;
          district_id?: string | null;
          education_min?: Database["public"]["Enums"]["education_level"] | null;
          employment_type?: Database["public"]["Enums"]["employment_type"];
          experience_min_months?: number;
          expires_at?: string | null;
          featured_until?: string | null;
          gender?: Database["public"]["Enums"]["gender"] | null;
          id?: string;
          is_featured?: boolean;
          is_government?: boolean;
          is_paid?: boolean | null;
          is_remote?: boolean;
          lat?: number | null;
          lng?: number | null;
          moderation_note?: string | null;
          official_terms?: string[];
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"];
          owner_profile_id?: string | null;
          paid_until?: string | null;
          positions_count?: number;
          profession_node_id?: string | null;
          published_at?: string | null;
          region_id?: string | null;
          requires_review?: boolean;
          salary_from?: number | null;
          salary_negotiable?: boolean;
          salary_to?: number | null;
          salary_type?: Database["public"]["Enums"]["salary_type"];
          schedule?: Database["public"]["Enums"]["work_schedule"];
          search_vector?: unknown;
          slug?: string;
          status?: Database["public"]["Enums"]["vacancy_status"];
          student_friendly?: boolean;
          subcategory_id?: string | null;
          title?: string;
          updated_at?: string;
          views_count?: number;
          work_format?: Database["public"]["Enums"]["work_format"];
          work_time_from?: string | null;
          work_time_to?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vacancies_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vacancies_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vacancies_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vacancies_owner_profile_id_fkey";
            columns: ["owner_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vacancies_profession_node_id_fkey";
            columns: ["profession_node_id"];
            isOneToOne: false;
            referencedRelation: "profession_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vacancies_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vacancies_subcategory_id_fkey";
            columns: ["subcategory_id"];
            isOneToOne: false;
            referencedRelation: "subcategories";
            referencedColumns: ["id"];
          },
        ];
      };
      vacancy_benefits: {
        Row: {
          benefit_code: string;
          vacancy_id: string;
        };
        Insert: {
          benefit_code: string;
          vacancy_id: string;
        };
        Update: {
          benefit_code?: string;
          vacancy_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacancy_benefits_benefit_code_fkey";
            columns: ["benefit_code"];
            isOneToOne: false;
            referencedRelation: "benefits";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "vacancy_benefits_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
        ];
      };
      vacancy_languages: {
        Row: {
          language_code: string;
          min_level: Database["public"]["Enums"]["language_level"];
          vacancy_id: string;
        };
        Insert: {
          language_code: string;
          min_level?: Database["public"]["Enums"]["language_level"];
          vacancy_id: string;
        };
        Update: {
          language_code?: string;
          min_level?: Database["public"]["Enums"]["language_level"];
          vacancy_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacancy_languages_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "vacancy_languages_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
        ];
      };
      vacancy_skills: {
        Row: {
          is_required: boolean;
          skill_id: string;
          vacancy_id: string;
        };
        Insert: {
          is_required?: boolean;
          skill_id: string;
          vacancy_id: string;
        };
        Update: {
          is_required?: boolean;
          skill_id?: string;
          vacancy_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vacancy_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vacancy_skills_vacancy_id_fkey";
            columns: ["vacancy_id"];
            isOneToOne: false;
            referencedRelation: "vacancies";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_requests: {
        Row: {
          company_id: string | null;
          created_at: string;
          document_paths: string[];
          id: string;
          note: string | null;
          profile_id: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["verification_status"];
          type: Database["public"]["Enums"]["verification_type"];
        };
        Insert: {
          company_id?: string | null;
          created_at?: string;
          document_paths?: string[];
          id?: string;
          note?: string | null;
          profile_id: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          type: Database["public"]["Enums"]["verification_type"];
        };
        Update: {
          company_id?: string | null;
          created_at?: string;
          document_paths?: string[];
          id?: string;
          note?: string | null;
          profile_id?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["verification_status"];
          type?: Database["public"]["Enums"]["verification_type"];
        };
        Relationships: [
          {
            foreignKeyName: "verification_requests_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_requests_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "verification_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      web_login_requests: {
        Row: {
          confirmed_at: string | null;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          telegram_user_id: number | null;
          tg_user: Json | null;
          token_hash: string;
          user_agent: string | null;
        };
        Insert: {
          confirmed_at?: string | null;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          telegram_user_id?: number | null;
          tg_user?: Json | null;
          token_hash: string;
          user_agent?: string | null;
        };
        Update: {
          confirmed_at?: string | null;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          telegram_user_id?: number | null;
          tg_user?: Json | null;
          token_hash?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      worker_education: {
        Row: {
          created_at: string;
          ended_year: number | null;
          field: string | null;
          id: string;
          institution: string | null;
          level: Database["public"]["Enums"]["education_level"];
          started_year: number | null;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          ended_year?: number | null;
          field?: string | null;
          id?: string;
          institution?: string | null;
          level: Database["public"]["Enums"]["education_level"];
          started_year?: number | null;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          ended_year?: number | null;
          field?: string | null;
          id?: string;
          institution?: string | null;
          level?: Database["public"]["Enums"]["education_level"];
          started_year?: number | null;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_education_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_experience: {
        Row: {
          achievements: string | null;
          company_name: string;
          created_at: string;
          ended_on: string | null;
          id: string;
          is_current: boolean;
          position: string;
          responsibilities: string | null;
          sort_order: number;
          started_on: string;
          worker_id: string;
        };
        Insert: {
          achievements?: string | null;
          company_name: string;
          created_at?: string;
          ended_on?: string | null;
          id?: string;
          is_current?: boolean;
          position: string;
          responsibilities?: string | null;
          sort_order?: number;
          started_on: string;
          worker_id: string;
        };
        Update: {
          achievements?: string | null;
          company_name?: string;
          created_at?: string;
          ended_on?: string | null;
          id?: string;
          is_current?: boolean;
          position?: string;
          responsibilities?: string | null;
          sort_order?: number;
          started_on?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_experience_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_geo: {
        Row: {
          lat: number;
          lng: number;
          updated_at: string;
          worker_id: string;
        };
        Insert: {
          lat: number;
          lng: number;
          updated_at?: string;
          worker_id: string;
        };
        Update: {
          lat?: number;
          lng?: number;
          updated_at?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_geo_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: true;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_languages: {
        Row: {
          language_code: string;
          level: Database["public"]["Enums"]["language_level"];
          worker_id: string;
        };
        Insert: {
          language_code: string;
          level?: Database["public"]["Enums"]["language_level"];
          worker_id: string;
        };
        Update: {
          language_code?: string;
          level?: Database["public"]["Enums"]["language_level"];
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_languages_language_code_fkey";
            columns: ["language_code"];
            isOneToOne: false;
            referencedRelation: "languages";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "worker_languages_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_locations: {
        Row: {
          district_id: string;
          worker_id: string;
        };
        Insert: {
          district_id: string;
          worker_id: string;
        };
        Update: {
          district_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_locations_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_locations_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_portfolio: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          link_url: string | null;
          media_paths: string[];
          sort_order: number;
          title: string;
          type: Database["public"]["Enums"]["portfolio_type"];
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          link_url?: string | null;
          media_paths?: string[];
          sort_order?: number;
          title: string;
          type?: Database["public"]["Enums"]["portfolio_type"];
          worker_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          link_url?: string | null;
          media_paths?: string[];
          sort_order?: number;
          title?: string;
          type?: Database["public"]["Enums"]["portfolio_type"];
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_portfolio_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_preferences: {
        Row: {
          availability: Database["public"]["Enums"]["availability"];
          employment_types: Database["public"]["Enums"]["employment_type"][];
          official_terms: string[];
          salary_expected: number | null;
          salary_min: number | null;
          salary_type: Database["public"]["Enums"]["salary_type"];
          schedules: Database["public"]["Enums"]["work_schedule"][];
          updated_at: string;
          work_time_from: string | null;
          work_time_to: string | null;
          worker_id: string;
        };
        Insert: {
          availability?: Database["public"]["Enums"]["availability"];
          employment_types?: Database["public"]["Enums"]["employment_type"][];
          official_terms?: string[];
          salary_expected?: number | null;
          salary_min?: number | null;
          salary_type?: Database["public"]["Enums"]["salary_type"];
          schedules?: Database["public"]["Enums"]["work_schedule"][];
          updated_at?: string;
          work_time_from?: string | null;
          work_time_to?: string | null;
          worker_id: string;
        };
        Update: {
          availability?: Database["public"]["Enums"]["availability"];
          employment_types?: Database["public"]["Enums"]["employment_type"][];
          official_terms?: string[];
          salary_expected?: number | null;
          salary_min?: number | null;
          salary_type?: Database["public"]["Enums"]["salary_type"];
          schedules?: Database["public"]["Enums"]["work_schedule"][];
          updated_at?: string;
          work_time_from?: string | null;
          work_time_to?: string | null;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_preferences_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: true;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_professions: {
        Row: {
          created_at: string;
          experience_level: Database["public"]["Enums"]["experience_level"];
          node_id: string;
          worker_id: string;
        };
        Insert: {
          created_at?: string;
          experience_level?: Database["public"]["Enums"]["experience_level"];
          node_id: string;
          worker_id: string;
        };
        Update: {
          created_at?: string;
          experience_level?: Database["public"]["Enums"]["experience_level"];
          node_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_professions_node_id_fkey";
            columns: ["node_id"];
            isOneToOne: false;
            referencedRelation: "profession_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_professions_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_profiles: {
        Row: {
          about: string | null;
          area_hint: string | null;
          category_id: string | null;
          completeness: number;
          created_at: string;
          custom_profession: string | null;
          district_id: string | null;
          experience_level: Database["public"]["Enums"]["experience_level"];
          headline: string | null;
          id: string;
          is_public: boolean;
          last_active_at: string;
          onboarding_completed_at: string | null;
          onboarding_step: number;
          profession_node_id: string | null;
          profile_id: string;
          promoted_until: string | null;
          region_id: string | null;
          remote_preference: Database["public"]["Enums"]["remote_preference"];
          status: Database["public"]["Enums"]["worker_status"];
          subcategory_id: string | null;
          updated_at: string;
          views_count: number;
          work_format: Database["public"]["Enums"]["work_format"];
        };
        Insert: {
          about?: string | null;
          area_hint?: string | null;
          category_id?: string | null;
          completeness?: number;
          created_at?: string;
          custom_profession?: string | null;
          district_id?: string | null;
          experience_level?: Database["public"]["Enums"]["experience_level"];
          headline?: string | null;
          id?: string;
          is_public?: boolean;
          last_active_at?: string;
          onboarding_completed_at?: string | null;
          onboarding_step?: number;
          profession_node_id?: string | null;
          profile_id: string;
          promoted_until?: string | null;
          region_id?: string | null;
          remote_preference?: Database["public"]["Enums"]["remote_preference"];
          status?: Database["public"]["Enums"]["worker_status"];
          subcategory_id?: string | null;
          updated_at?: string;
          views_count?: number;
          work_format?: Database["public"]["Enums"]["work_format"];
        };
        Update: {
          about?: string | null;
          area_hint?: string | null;
          category_id?: string | null;
          completeness?: number;
          created_at?: string;
          custom_profession?: string | null;
          district_id?: string | null;
          experience_level?: Database["public"]["Enums"]["experience_level"];
          headline?: string | null;
          id?: string;
          is_public?: boolean;
          last_active_at?: string;
          onboarding_completed_at?: string | null;
          onboarding_step?: number;
          profession_node_id?: string | null;
          profile_id?: string;
          promoted_until?: string | null;
          region_id?: string | null;
          remote_preference?: Database["public"]["Enums"]["remote_preference"];
          status?: Database["public"]["Enums"]["worker_status"];
          subcategory_id?: string | null;
          updated_at?: string;
          views_count?: number;
          work_format?: Database["public"]["Enums"]["work_format"];
        };
        Relationships: [
          {
            foreignKeyName: "worker_profiles_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_profiles_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_profiles_profession_node_id_fkey";
            columns: ["profession_node_id"];
            isOneToOne: false;
            referencedRelation: "profession_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_profiles_region_id_fkey";
            columns: ["region_id"];
            isOneToOne: false;
            referencedRelation: "regions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_profiles_subcategory_id_fkey";
            columns: ["subcategory_id"];
            isOneToOne: false;
            referencedRelation: "subcategories";
            referencedColumns: ["id"];
          },
        ];
      };
      worker_skills: {
        Row: {
          level: Database["public"]["Enums"]["skill_level"];
          skill_id: string;
          worker_id: string;
        };
        Insert: {
          level?: Database["public"]["Enums"]["skill_level"];
          skill_id: string;
          worker_id: string;
        };
        Update: {
          level?: Database["public"]["Enums"]["skill_level"];
          skill_id?: string;
          worker_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "worker_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "worker_skills_worker_id_fkey";
            columns: ["worker_id"];
            isOneToOne: false;
            referencedRelation: "worker_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_company_invite: { Args: { p_token: string }; Returns: string };
      activate_vacancy_internal: {
        Args: { p_vacancy_id: string; p_window_end: string };
        Returns: Database["public"]["Enums"]["vacancy_status"];
      };
      admin_broadcast: {
        Args: {
          p_body: string;
          p_link?: string;
          p_role?: Database["public"]["Enums"]["app_role"];
          p_title: string;
        };
        Returns: number;
      };
      admin_daily_stats: {
        Args: { p_days?: number };
        Returns: {
          applications: number;
          day: string;
          hires: number;
          registrations: number;
          vacancies: number;
        }[];
      };
      admin_log: {
        Args: {
          p_action: string;
          p_after?: Json;
          p_before?: Json;
          p_target_id?: string;
          p_target_type: string;
        };
        Returns: undefined;
      };
      admin_merge_profession_node: {
        Args: { p_from: string; p_into: string };
        Returns: undefined;
      };
      admin_moderate_review: {
        Args: {
          p_note?: string;
          p_review_id: string;
          p_status: Database["public"]["Enums"]["review_status"];
        };
        Returns: undefined;
      };
      admin_profession_node_stats: {
        Args: { p_category_id?: string; p_parent_id?: string };
        Returns: {
          id: string;
          profiles: number;
          vacancies: number;
        }[];
      };
      admin_resolve_report: {
        Args: {
          p_note?: string;
          p_report_id: string;
          p_status: Database["public"]["Enums"]["report_status"];
        };
        Returns: undefined;
      };
      admin_review_verification: {
        Args: {
          p_note?: string;
          p_request_id: string;
          p_status: Database["public"]["Enums"]["verification_status"];
        };
        Returns: undefined;
      };
      admin_search_insights: {
        Args: { p_days?: number; p_limit?: number };
        Returns: {
          last_at: string;
          query_norm: string;
          scope: string;
          searches: number;
          zero_results: number;
        }[];
      };
      admin_set_user_block: {
        Args: { p_block: boolean; p_profile_id: string; p_reason?: string };
        Returns: undefined;
      };
      admin_set_vacancy_status: {
        Args: {
          p_note?: string;
          p_status: Database["public"]["Enums"]["vacancy_status"];
          p_vacancy_id: string;
        };
        Returns: undefined;
      };
      admin_stats: { Args: Record<PropertyKey, never>; Returns: Json };
      application_stage_rank: {
        Args: { s: Database["public"]["Enums"]["application_status"] };
        Returns: number;
      };
      apply_payment_internal: {
        Args: { p_payment_id: string };
        Returns: undefined;
      };
      apply_to_vacancy: {
        Args: { p_message?: string; p_vacancy_id: string };
        Returns: string;
      };
      billing_enabled: { Args: Record<PropertyKey, never>; Returns: boolean };
      billing_promo_active: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      billing_promo_until: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      bot_matching_vacancies: {
        Args: { p_limit?: number; p_offset?: number; p_worker_id: string };
        Returns: {
          company_name: string;
          district_name_ru: string;
          district_name_uz: string;
          id: string;
          is_remote: boolean;
          region_name_ru: string;
          region_name_uz: string;
          salary_from: number;
          salary_negotiable: boolean;
          salary_to: number;
          salary_type: Database["public"]["Enums"]["salary_type"];
          score: number;
          slug: string;
          title: string;
          total: number;
        }[];
      };
      bulk_set_application_status: {
        Args: {
          p_ids: string[];
          p_note?: string;
          p_status: Database["public"]["Enums"]["application_status"];
        };
        Returns: number;
      };
      can_edit_vacancy: { Args: { p_vacancy_id: string }; Returns: boolean };
      can_view_phone: { Args: { p_owner: string }; Returns: boolean };
      can_view_profile: { Args: { p_profile_id: string }; Returns: boolean };
      can_view_worker: { Args: { p_worker_id: string }; Returns: boolean };
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      click_complete: {
        Args: {
          p_amount: number;
          p_click_trans_id: number;
          p_error: number;
          p_order: string;
          p_prepare_id: number;
        };
        Returns: Json;
      };
      click_prepare: {
        Args: {
          p_amount: number;
          p_click_trans_id: number;
          p_error: number;
          p_order: string;
        };
        Returns: Json;
      };
      compute_match: {
        Args: { p_vacancy_id: string; p_worker_id: string };
        Returns: {
          reasons: Json;
          score: number;
        }[];
      };
      contact_status_for: { Args: { p_owner: string }; Returns: string };
      create_payment: {
        Args: {
          p_purpose: Database["public"]["Enums"]["payment_purpose"];
          p_target_id: string;
        };
        Returns: Json;
      };
      create_review: {
        Args: {
          p_application_id?: string;
          p_job_offer_id?: string;
          p_rating?: number;
          p_text?: string;
        };
        Returns: string;
      };
      current_employer_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      current_profile_id: { Args: Record<PropertyKey, never>; Returns: string };
      current_worker_id: { Args: Record<PropertyKey, never>; Returns: string };
      delete_message: { Args: { p_message_id: number }; Returns: undefined };
      dispatch_app_cron: { Args: { p_path: string }; Returns: number };
      distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number };
        Returns: number;
      };
      education_rank: {
        Args: { level: Database["public"]["Enums"]["education_level"] };
        Returns: number;
      };
      employer_dashboard_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      experience_level_months: {
        Args: { level: Database["public"]["Enums"]["experience_level"] };
        Returns: number;
      };
      expire_offers: { Args: Record<PropertyKey, never>; Returns: number };
      expire_vacancies: { Args: Record<PropertyKey, never>; Returns: number };
      extend_worker_promotion_internal: {
        Args: { p_worker_id: string };
        Returns: string;
      };
      get_contact: {
        Args: { p_profile_id: string };
        Returns: {
          allowed: boolean;
          phone: string;
          phone_verified: boolean;
          telegram_username: string;
        }[];
      };
      get_or_create_conversation: {
        Args: { p_application_id?: string; p_job_offer_id?: string };
        Returns: string;
      };
      has_admin_permission: { Args: { perm: string }; Returns: boolean };
      is_active_user: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_blocked: { Args: { pid: string }; Returns: boolean };
      is_company_admin: { Args: { p_company_id: string }; Returns: boolean };
      is_company_member: { Args: { p_company_id: string }; Returns: boolean };
      is_conversation_member: {
        Args: { p_conversation_id: string };
        Returns: boolean;
      };
      language_level_rank: {
        Args: { level: Database["public"]["Enums"]["language_level"] };
        Returns: number;
      };
      manages_vacancy: { Args: { p_vacancy_id: string }; Returns: boolean };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: undefined;
      };
      mark_notifications_read: { Args: { p_ids?: number[] }; Returns: number };
      mark_offer_hired: { Args: { p_offer_id: string }; Returns: undefined };
      mark_offer_viewed: { Args: { p_offer_id: string }; Returns: undefined };
      mark_saved_search_seen: {
        Args: { p_search_id: string };
        Returns: undefined;
      };
      my_contact_requests: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_url: string;
          created_at: string;
          id: string;
          name: string;
          person: string;
          requester_profile_id: string;
        }[];
      };
      my_conversations: {
        Args: Record<PropertyKey, never>;
        Returns: {
          application_id: string;
          company_name: string;
          context_title: string;
          id: string;
          job_offer_id: string;
          last_message_at: string;
          last_message_preview: string;
          other_avatar_url: string;
          other_name: string;
          other_profile_id: string;
          unread_count: number;
        }[];
      };
      my_saved_searches: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          id: string;
          label: string;
          new_count: number;
          notify: boolean;
          query_string: string;
        }[];
      };
      normalize_search_text: { Args: { p: string }; Returns: string };
      notify: {
        Args: {
          p_link?: string;
          p_payload: Json;
          p_profile_id: string;
          p_type: Database["public"]["Enums"]["notification_type"];
        };
        Returns: undefined;
      };
      notify_expiring_vacancies: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      notify_matching_workers: {
        Args: { p_min_score?: number; p_vacancy_id: string };
        Returns: number;
      };
      payme_cancel: {
        Args: { p_reason: number; p_txn: string };
        Returns: Json;
      };
      payme_check: { Args: { p_txn: string }; Returns: Json };
      payme_check_perform: {
        Args: { p_amount: number; p_order: string };
        Returns: Json;
      };
      payme_create: {
        Args: {
          p_amount: number;
          p_order: string;
          p_time: number;
          p_txn: string;
        };
        Returns: Json;
      };
      payme_error: {
        Args: {
          p_code: number;
          p_data?: string;
          p_en: string;
          p_ru: string;
          p_uz: string;
        };
        Returns: Json;
      };
      payme_perform: { Args: { p_txn: string }; Returns: Json };
      payme_statement: {
        Args: { p_from: number; p_to: number };
        Returns: Json;
      };
      payme_validate_order: {
        Args: { p_amount: number; p_order: string };
        Returns: Json;
      };
      prepare_account_deletion: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      profession_direction_counts: {
        Args: { p_category_id: string; p_parent_id?: string };
        Returns: {
          has_children: boolean;
          icon: string;
          id: string;
          kind: string;
          name_en: string;
          name_ru: string;
          name_uz: string;
          slug: string;
          sort_order: number;
          vacancies: number;
        }[];
      };
      profession_direction_worker_counts: {
        Args: { p_category_id: string; p_parent_id?: string };
        Returns: {
          has_children: boolean;
          icon: string;
          id: string;
          kind: string;
          name_en: string;
          name_ru: string;
          name_uz: string;
          slug: string;
          sort_order: number;
          workers: number;
        }[];
      };
      profession_node_trail: {
        Args: { p_node_id: string };
        Returns: {
          depth: number;
          id: string;
          name_en: string;
          name_ru: string;
          name_uz: string;
          selectable: boolean;
        }[];
      };
      profession_relation: {
        Args: { p_vacancy_path: string[]; p_worker_path: string[] };
        Returns: number;
      };
      profile_display_name: { Args: { p_profile: string }; Returns: string };
      profile_rating: {
        Args: { p_profile_id: string };
        Returns: {
          avg_rating: number;
          reviews_count: number;
        }[];
      };
      promote_worker: { Args: Record<PropertyKey, never>; Returns: string };
      publish_vacancy: {
        Args: { p_vacancy_id: string };
        Returns: Database["public"]["Enums"]["vacancy_status"];
      };
      purge_search_logs: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      recommended_vacancies: {
        Args: { p_limit?: number };
        Returns: {
          reasons: Json;
          score: number;
          vacancy_id: string;
        }[];
      };
      recommended_workers: {
        Args: { p_limit?: number; p_vacancy_id: string };
        Returns: {
          reasons: Json;
          score: number;
          worker_id: string;
        }[];
      };
      record_vacancy_view: {
        Args: { p_vacancy_id: string };
        Returns: undefined;
      };
      record_worker_view: { Args: { p_worker_id: string }; Returns: undefined };
      refresh_matches_for_vacancy: {
        Args: { p_vacancy_id: string };
        Returns: number;
      };
      refresh_matches_for_worker: {
        Args: { p_worker_id: string };
        Returns: number;
      };
      refresh_worker_completeness: {
        Args: { p_worker_id: string };
        Returns: number;
      };
      request_contact: { Args: { p_owner: string }; Returns: string };
      respond_contact_request: {
        Args: { p_approve: boolean; p_request_id: string };
        Returns: Database["public"]["Enums"]["contact_request_status"];
      };
      respond_offer: {
        Args: { p_accept: boolean; p_offer_id: string };
        Returns: undefined;
      };
      run_saved_search_alerts: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      salary_insight: {
        Args: {
          p_region_id?: string;
          p_salary_type?: Database["public"]["Enums"]["salary_type"];
          p_subcategory_id: string;
        };
        Returns: {
          p25: number;
          p50: number;
          p75: number;
          sample_size: number;
        }[];
      };
      salary_monthly_equivalent: {
        Args: {
          p_amount: number;
          p_type: Database["public"]["Enums"]["salary_type"];
        };
        Returns: number;
      };
      saved_search_new_count: {
        Args: { p_search_id: string; p_since: string };
        Returns: number;
      };
      schedule_interview: {
        Args: {
          p_application_id: string;
          p_at: string;
          p_note?: string;
          p_place?: string;
        };
        Returns: undefined;
      };
      search_profession_nodes: {
        Args: { p_category_id?: string; p_limit?: number; p_query: string };
        Returns: {
          category_id: string;
          depth: number;
          has_children: boolean;
          icon: string;
          id: string;
          name_en: string;
          name_ru: string;
          name_uz: string;
          parent_id: string;
          score: number;
          selectable: boolean;
          slug: string;
          trail: Json;
        }[];
      };
      search_vacancies: {
        Args: {
          p_benefits?: string[];
          p_category_id?: string;
          p_company_id?: string;
          p_district_ids?: string[];
          p_employment_types?: Database["public"]["Enums"]["employment_type"][];
          p_experience_max_months?: number;
          p_government_only?: boolean;
          p_is_remote?: boolean;
          p_limit?: number;
          p_no_experience?: boolean;
          p_offset?: number;
          p_opportunity_types?: Database["public"]["Enums"]["opportunity_type"][];
          p_query?: string;
          p_region_id?: string;
          p_salary_min?: number;
          p_schedules?: Database["public"]["Enums"]["work_schedule"][];
          p_sort?: string;
          p_start_today?: boolean;
          p_student_friendly?: boolean;
          p_subcategory_id?: string;
          p_verified_only?: boolean;
          p_work_format?: Database["public"]["Enums"]["work_format"];
        };
        Returns: {
          applications_count: number;
          benefits: string[];
          category_id: string;
          category_slug: string;
          company_id: string;
          company_logo_url: string;
          company_name: string;
          company_verified: boolean;
          district_id: string;
          district_name_ru: string;
          district_name_uz: string;
          employment_type: Database["public"]["Enums"]["employment_type"];
          experience_min_months: number;
          expires_at: string;
          has_applied: boolean;
          id: string;
          is_featured: boolean;
          is_government: boolean;
          is_paid: boolean;
          is_remote: boolean;
          is_saved: boolean;
          match_reasons: Json;
          match_score: number;
          opportunity_type: Database["public"]["Enums"]["opportunity_type"];
          published_at: string;
          region_id: string;
          region_name_ru: string;
          region_name_uz: string;
          salary_from: number;
          salary_negotiable: boolean;
          salary_to: number;
          salary_type: Database["public"]["Enums"]["salary_type"];
          schedule: Database["public"]["Enums"]["work_schedule"];
          slug: string;
          student_friendly: boolean;
          title: string;
          total_count: number;
          views_count: number;
          work_format: Database["public"]["Enums"]["work_format"];
          work_time_from: string;
          work_time_to: string;
        }[];
      };
      search_vacancies_v2: {
        Args: {
          p_benefits?: string[];
          p_category_id?: string;
          p_company_id?: string;
          p_district_ids?: string[];
          p_employment_types?: Database["public"]["Enums"]["employment_type"][];
          p_experience_max_months?: number;
          p_government_only?: boolean;
          p_is_remote?: boolean;
          p_limit?: number;
          p_no_experience?: boolean;
          p_offset?: number;
          p_opportunity_types?: Database["public"]["Enums"]["opportunity_type"][];
          p_profession_node_id?: string;
          p_query?: string;
          p_region_id?: string;
          p_salary_min?: number;
          p_schedules?: Database["public"]["Enums"]["work_schedule"][];
          p_sort?: string;
          p_start_today?: boolean;
          p_student_friendly?: boolean;
          p_subcategory_id?: string;
          p_verified_only?: boolean;
          p_work_format?: Database["public"]["Enums"]["work_format"];
        };
        Returns: {
          applications_count: number;
          benefits: string[];
          category_id: string;
          category_slug: string;
          company_id: string;
          company_logo_url: string;
          company_name: string;
          company_verified: boolean;
          district_id: string;
          district_name_ru: string;
          district_name_uz: string;
          employment_type: Database["public"]["Enums"]["employment_type"];
          experience_min_months: number;
          expires_at: string;
          has_applied: boolean;
          id: string;
          is_featured: boolean;
          is_government: boolean;
          is_paid: boolean;
          is_remote: boolean;
          is_saved: boolean;
          match_reasons: Json;
          match_score: number;
          opportunity_type: Database["public"]["Enums"]["opportunity_type"];
          published_at: string;
          region_id: string;
          region_name_ru: string;
          region_name_uz: string;
          salary_from: number;
          salary_negotiable: boolean;
          salary_to: number;
          salary_type: Database["public"]["Enums"]["salary_type"];
          schedule: Database["public"]["Enums"]["work_schedule"];
          slug: string;
          student_friendly: boolean;
          title: string;
          total_count: number;
          views_count: number;
          work_format: Database["public"]["Enums"]["work_format"];
          work_time_from: string;
          work_time_to: string;
        }[];
      };
      search_workers: {
        Args: {
          p_availability?: Database["public"]["Enums"]["availability"][];
          p_category_id?: string;
          p_district_ids?: string[];
          p_education_min?: Database["public"]["Enums"]["education_level"];
          p_employment_types?: Database["public"]["Enums"]["employment_type"][];
          p_experience_min_months?: number;
          p_gender?: Database["public"]["Enums"]["gender"];
          p_has_portfolio?: boolean;
          p_language_codes?: string[];
          p_lat?: number;
          p_limit?: number;
          p_lng?: number;
          p_max_distance_km?: number;
          p_offset?: number;
          p_query?: string;
          p_region_id?: string;
          p_remote?: boolean;
          p_salary_max?: number;
          p_schedules?: Database["public"]["Enums"]["work_schedule"][];
          p_skill_ids?: string[];
          p_sort?: string;
          p_statuses?: Database["public"]["Enums"]["worker_status"][];
          p_subcategory_id?: string;
          p_vacancy_id?: string;
          p_verified_only?: boolean;
          p_work_format?: Database["public"]["Enums"]["work_format"];
        };
        Returns: {
          availability: Database["public"]["Enums"]["availability"];
          avatar_url: string;
          category_id: string;
          category_name_ru: string;
          category_name_uz: string;
          completeness: number;
          distance_km: number;
          district_name_ru: string;
          district_name_uz: string;
          employment_types: Database["public"]["Enums"]["employment_type"][];
          experience_level: Database["public"]["Enums"]["experience_level"];
          first_name: string;
          has_portfolio: boolean;
          headline: string;
          id: string;
          is_saved: boolean;
          languages: Json;
          last_active_at: string;
          last_initial: string;
          match_reasons: Json;
          match_score: number;
          phone_verified: boolean;
          profile_id: string;
          region_name_ru: string;
          region_name_uz: string;
          remote_preference: Database["public"]["Enums"]["remote_preference"];
          salary_expected: number;
          salary_min: number;
          salary_type: Database["public"]["Enums"]["salary_type"];
          schedules: Database["public"]["Enums"]["work_schedule"][];
          skills: Json;
          status: Database["public"]["Enums"]["worker_status"];
          subcategory_name_ru: string;
          subcategory_name_uz: string;
          total_count: number;
          work_format: Database["public"]["Enums"]["work_format"];
        }[];
      };
      search_workers_v2: {
        Args: {
          p_availability?: Database["public"]["Enums"]["availability"][];
          p_category_id?: string;
          p_district_ids?: string[];
          p_education_min?: Database["public"]["Enums"]["education_level"];
          p_employment_types?: Database["public"]["Enums"]["employment_type"][];
          p_experience_min_months?: number;
          p_gender?: Database["public"]["Enums"]["gender"];
          p_has_portfolio?: boolean;
          p_language_codes?: string[];
          p_lat?: number;
          p_limit?: number;
          p_lng?: number;
          p_max_distance_km?: number;
          p_offset?: number;
          p_profession_node_id?: string;
          p_query?: string;
          p_region_id?: string;
          p_remote?: boolean;
          p_salary_max?: number;
          p_schedules?: Database["public"]["Enums"]["work_schedule"][];
          p_skill_ids?: string[];
          p_sort?: string;
          p_statuses?: Database["public"]["Enums"]["worker_status"][];
          p_subcategory_id?: string;
          p_vacancy_id?: string;
          p_verified_only?: boolean;
          p_work_format?: Database["public"]["Enums"]["work_format"];
        };
        Returns: {
          availability: Database["public"]["Enums"]["availability"];
          avatar_url: string;
          category_id: string;
          category_name_ru: string;
          category_name_uz: string;
          completeness: number;
          distance_km: number;
          district_name_ru: string;
          district_name_uz: string;
          employment_types: Database["public"]["Enums"]["employment_type"][];
          experience_level: Database["public"]["Enums"]["experience_level"];
          first_name: string;
          has_portfolio: boolean;
          headline: string;
          id: string;
          is_saved: boolean;
          languages: Json;
          last_active_at: string;
          last_initial: string;
          match_reasons: Json;
          match_score: number;
          phone_verified: boolean;
          profile_id: string;
          region_name_ru: string;
          region_name_uz: string;
          remote_preference: Database["public"]["Enums"]["remote_preference"];
          salary_expected: number;
          salary_min: number;
          salary_type: Database["public"]["Enums"]["salary_type"];
          schedules: Database["public"]["Enums"]["work_schedule"][];
          skills: Json;
          status: Database["public"]["Enums"]["worker_status"];
          subcategory_name_ru: string;
          subcategory_name_uz: string;
          total_count: number;
          work_format: Database["public"]["Enums"]["work_format"];
        }[];
      };
      send_message: {
        Args: {
          p_attachment_meta?: Json;
          p_attachment_path?: string;
          p_body?: string;
          p_conversation_id: string;
          p_lat?: number;
          p_lng?: number;
          p_type?: Database["public"]["Enums"]["message_type"];
        };
        Returns: number;
      };
      send_offer: {
        Args: {
          p_message?: string;
          p_salary_from?: number;
          p_salary_to?: number;
          p_title?: string;
          p_vacancy_id?: string;
          p_worker_id: string;
        };
        Returns: string;
      };
      set_application_status: {
        Args: {
          p_application_id: string;
          p_note?: string;
          p_status: Database["public"]["Enums"]["application_status"];
        };
        Returns: undefined;
      };
      set_conversation_block: {
        Args: { p_blocked: boolean; p_conversation_id: string };
        Returns: undefined;
      };
      set_vacancy_status: {
        Args: {
          p_status: Database["public"]["Enums"]["vacancy_status"];
          p_vacancy_id: string;
        };
        Returns: undefined;
      };
      setting_int: {
        Args: { p_default: number; p_key: string };
        Returns: number;
      };
      similar_vacancies: {
        Args: { p_vacancy_id: string };
        Returns: {
          created_at: string;
          id: string;
          similarity: number;
          status: Database["public"]["Enums"]["vacancy_status"];
          title: string;
        }[];
      };
      slugify: { Args: { input: string }; Returns: string };
      submit_report: {
        Args: {
          p_details?: string;
          p_reason: Database["public"]["Enums"]["report_reason"];
          p_target_id: string;
          p_target_type: Database["public"]["Enums"]["report_target"];
        };
        Returns: string;
      };
      touch_last_seen: { Args: Record<PropertyKey, never>; Returns: undefined };
      unread_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          applications: number;
          messages: number;
          notifications: number;
          offers: number;
        }[];
      };
      vacancy_managers: { Args: { p_vacancy_id: string }; Returns: string[] };
      vacancy_publish_mode: { Args: { p_vacancy_id: string }; Returns: string };
      vacancy_publish_quote: { Args: { p_vacancy_id: string }; Returns: Json };
      vacancy_risk_flags: {
        Args: { p_description: string; p_title: string };
        Returns: string[];
      };
      withdraw_offer: { Args: { p_offer_id: string }; Returns: undefined };
      worker_completeness: {
        Args: { p_worker_id: string };
        Returns: {
          score: number;
          suggestions: string[];
        }[];
      };
      worker_dashboard_stats: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      worker_promotion_mode: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      worker_promotion_quote: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      worker_related_to_vacancy: {
        Args: { p_vacancy_id: string };
        Returns: boolean;
      };
      write_audit: {
        Args: {
          p_action: string;
          p_after?: Json;
          p_before?: Json;
          p_target_id: string;
          p_target_type: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      admin_role: "super_admin" | "admin" | "moderator" | "support";
      app_locale: "uz" | "oz" | "ru" | "en";
      app_role: "worker" | "employer";
      application_status:
        | "sent"
        | "viewed"
        | "shortlisted"
        | "interview"
        | "offered"
        | "hired"
        | "rejected"
        | "withdrawn";
      availability:
        "today" | "tomorrow" | "within_3_days" | "within_week" | "negotiable";
      company_member_role: "owner" | "admin" | "recruiter" | "viewer";
      company_size: "1_10" | "11_50" | "51_200" | "201_500" | "500_plus";
      contact_request_status: "pending" | "approved" | "declined";
      device_platform: "web" | "android" | "ios";
      education_level:
        "secondary" | "vocational" | "incomplete_higher" | "higher" | "master";
      employer_type:
        | "company"
        | "individual_entrepreneur"
        | "person"
        | "government"
        | "self_employed"
        | "other";
      employment_type:
        | "permanent"
        | "temporary"
        | "part_time"
        | "full_time"
        | "shift"
        | "remote"
        | "freelance"
        | "internship";
      experience_level:
        "none" | "lt_6m" | "6_12m" | "1_2y" | "2_3y" | "3_5y" | "5y_plus";
      gender: "male" | "female";
      language_level: "a1" | "a2" | "b1" | "b2" | "c1" | "c2" | "native";
      message_type:
        "text" | "image" | "document" | "location" | "voice" | "system";
      notification_type:
        | "application_received"
        | "application_status"
        | "offer_received"
        | "offer_response"
        | "new_message"
        | "interview_invite"
        | "vacancy_expiring"
        | "new_matching_vacancy"
        | "new_matching_worker"
        | "verification_result"
        | "review_received"
        | "system";
      offer_status:
        "sent" | "viewed" | "accepted" | "declined" | "expired" | "withdrawn";
      opportunity_type:
        | "job"
        | "fixed_term"
        | "one_time"
        | "seasonal"
        | "internship"
        | "practice"
        | "apprenticeship";
      payment_provider: "payme" | "click";
      payment_purpose: "vacancy_publish" | "worker_promotion";
      payment_status: "pending" | "paid" | "cancelled" | "failed";
      phone_visibility: "nobody" | "applicants" | "on_request" | "everyone";
      portfolio_type: "image" | "video" | "pdf" | "document" | "link";
      remote_preference: "yes" | "no" | "any";
      report_reason:
        | "fraud"
        | "fake_vacancy"
        | "asked_money"
        | "wrong_info"
        | "spam"
        | "abuse"
        | "other";
      report_status: "open" | "in_review" | "resolved" | "dismissed";
      report_target: "profile" | "vacancy" | "company" | "message" | "review";
      review_status: "pending" | "approved" | "rejected";
      salary_type: "monthly" | "daily" | "hourly" | "piecework" | "negotiable";
      skill_level: "beginner" | "intermediate" | "good" | "professional";
      vacancy_status:
        | "draft"
        | "pending_review"
        | "active"
        | "paused"
        | "closed"
        | "expired"
        | "hidden"
        | "rejected";
      verification_status: "unverified" | "pending" | "verified" | "rejected";
      verification_type:
        | "phone"
        | "telegram"
        | "identity"
        | "education"
        | "company"
        | "tin"
        | "documents";
      work_format: "official" | "unofficial" | "any";
      work_schedule:
        "5_2" | "6_1" | "2_2" | "shift" | "flexible" | "negotiable";
      worker_status: "active" | "open" | "not_looking";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      admin_role: ["super_admin", "admin", "moderator", "support"],
      app_locale: ["uz", "oz", "ru", "en"],
      app_role: ["worker", "employer"],
      application_status: [
        "sent",
        "viewed",
        "shortlisted",
        "interview",
        "offered",
        "hired",
        "rejected",
        "withdrawn",
      ],
      availability: [
        "today",
        "tomorrow",
        "within_3_days",
        "within_week",
        "negotiable",
      ],
      company_member_role: ["owner", "admin", "recruiter", "viewer"],
      company_size: ["1_10", "11_50", "51_200", "201_500", "500_plus"],
      contact_request_status: ["pending", "approved", "declined"],
      device_platform: ["web", "android", "ios"],
      education_level: [
        "secondary",
        "vocational",
        "incomplete_higher",
        "higher",
        "master",
      ],
      employer_type: [
        "company",
        "individual_entrepreneur",
        "person",
        "government",
        "self_employed",
        "other",
      ],
      employment_type: [
        "permanent",
        "temporary",
        "part_time",
        "full_time",
        "shift",
        "remote",
        "freelance",
        "internship",
      ],
      experience_level: [
        "none",
        "lt_6m",
        "6_12m",
        "1_2y",
        "2_3y",
        "3_5y",
        "5y_plus",
      ],
      gender: ["male", "female"],
      language_level: ["a1", "a2", "b1", "b2", "c1", "c2", "native"],
      message_type: [
        "text",
        "image",
        "document",
        "location",
        "voice",
        "system",
      ],
      notification_type: [
        "application_received",
        "application_status",
        "offer_received",
        "offer_response",
        "new_message",
        "interview_invite",
        "vacancy_expiring",
        "new_matching_vacancy",
        "new_matching_worker",
        "verification_result",
        "review_received",
        "system",
      ],
      offer_status: [
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
        "withdrawn",
      ],
      opportunity_type: [
        "job",
        "fixed_term",
        "one_time",
        "seasonal",
        "internship",
        "practice",
        "apprenticeship",
      ],
      payment_provider: ["payme", "click"],
      payment_purpose: ["vacancy_publish", "worker_promotion"],
      payment_status: ["pending", "paid", "cancelled", "failed"],
      phone_visibility: ["nobody", "applicants", "on_request", "everyone"],
      portfolio_type: ["image", "video", "pdf", "document", "link"],
      remote_preference: ["yes", "no", "any"],
      report_reason: [
        "fraud",
        "fake_vacancy",
        "asked_money",
        "wrong_info",
        "spam",
        "abuse",
        "other",
      ],
      report_status: ["open", "in_review", "resolved", "dismissed"],
      report_target: ["profile", "vacancy", "company", "message", "review"],
      review_status: ["pending", "approved", "rejected"],
      salary_type: ["monthly", "daily", "hourly", "piecework", "negotiable"],
      skill_level: ["beginner", "intermediate", "good", "professional"],
      vacancy_status: [
        "draft",
        "pending_review",
        "active",
        "paused",
        "closed",
        "expired",
        "hidden",
        "rejected",
      ],
      verification_status: ["unverified", "pending", "verified", "rejected"],
      verification_type: [
        "phone",
        "telegram",
        "identity",
        "education",
        "company",
        "tin",
        "documents",
      ],
      work_format: ["official", "unofficial", "any"],
      work_schedule: ["5_2", "6_1", "2_2", "shift", "flexible", "negotiable"],
      worker_status: ["active", "open", "not_looking"],
    },
  },
} as const;
