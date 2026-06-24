export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  mobile_number?: string;
  role: UserRole;
  created_at: string;
}

export interface Folder {
  id: string;
  user_id: string;
  folder_name: string;
  created_at: string;
}

export interface Photo {
  id: string;
  user_id: string;
  folder_id: string | null;
  file_name: string;
  storage_path: string;
  file_url?: string;
  uploaded_at: string;
}
