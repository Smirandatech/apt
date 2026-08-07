export interface ResumeTemplate {
  id: string;
  name: string;
  file_url: string;
  developer_id: string;
  created_at: string;
  company_count?: number;
  prompt?: string;
  demographics?: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    gender?: string;
    dob?: string;
    ethnicity?: string;
    disability?: string;
    veteran?: string;
    linkedin?: string;
    website?: string;
  };
}

export interface Bidder {
  id: string;
  username: string;
  template_id?: string;
  drive_folder_id?: string;
  rate?: number;
}

export interface UnassignedBidder {
  id: string;
  username: string;
}

export interface User {
  id: string;
  username: string;
  role: string;
  developer?: {
    id: string;
    username: string;
  };
  manager?: {
    id: string;
    username: string;
  };
}

export interface InterviewStage {
  id: string;
  job_application_id: string;
  stage_name: string;
  status: string;
  scheduled_at: Date | null;
  notes?: string;
  metadata?: Record<string, any>;
  created_at: string;
  // joined fields:
  title: string;
  company_name: string;
  resume_url: string;
  job_description_url: string;
}
