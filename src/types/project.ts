export type MilestoneStatus = "pending" | "in_progress" | "complete" | "skipped";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type NotificationType = "mention" | "task_assigned" | "task_due" | "milestone_complete" | "comment" | "system";

export interface Milestone {
  id: string;
  job_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  status: MilestoneStatus;
  target_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  job_id: string;
  milestone_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  created_by: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  assignee_name?: string;
  assignee_email?: string;
}

export interface Comment {
  id: string;
  job_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  created_at: string;
  updated_at: string;
  // Joined
  author_name?: string;
  author_email?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

// Default milestones for new onboarding projects
export const DEFAULT_MILESTONES = [
  { name: "Kickoff", description: "Account created, onboarding initiated", sort_order: 0 },
  { name: "Website Crawl", description: "Property website crawled and indexed", sort_order: 1 },
  { name: "Document Upload", description: "All property documents uploaded and processed", sort_order: 2 },
  { name: "AI Extraction", description: "LLM data extraction complete", sort_order: 3 },
  { name: "Data Review", description: "Extracted data reviewed and corrected", sort_order: 4 },
  { name: "Agent Configuration", description: "AI agent configured with property data", sort_order: 5 },
  { name: "Testing", description: "Agent tested across all channels", sort_order: 6 },
  { name: "Go Live", description: "Property AI agent live in production", sort_order: 7 },
];
