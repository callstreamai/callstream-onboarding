export type UserRole = "admin" | "client";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: { id: string; email: string } | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
}
