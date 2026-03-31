import type { Vertical, Channel } from "./index";

export interface Account {
  id: string;
  name: string;
  property_url: string | null;
  vertical: Vertical | null;
  channels: Channel[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  contacts?: Contact[];
  jobs_count?: number;
}

export interface Contact {
  id: string;
  account_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

export interface AccountUser {
  id: string;
  account_id: string;
  user_id: string;
  created_at: string;
}
