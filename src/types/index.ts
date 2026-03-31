// ============================================================
// Call Stream AI - Onboarding Platform Types
// ============================================================

// 12 Hospitality Verticals
export type Vertical =
  | "hotel"
  | "resort"
  | "restaurant"
  | "venue"
  | "casino"
  | "stadium"
  | "travel"
  | "rental"
  | "rideshare"
  | "spa"
  | "event_space"
  | "luxury";

// Communication Channels
export type Channel = "voice" | "sms" | "webchat" | "whatsapp";

// Onboarding Job Status
export type JobStatus =
  | "pending"
  | "consent_given"
  | "crawling"
  | "crawl_complete"
  | "uploading"
  | "upload_complete"
  | "extracting"
  | "extraction_complete"
  | "review_pending"
  | "review_in_progress"
  | "approved"
  | "rejected"
  | "error";

// Crawled Page
export interface CrawledPage {
  id: string;
  job_id: string;
  url: string;
  title: string | null;
  content_text: string | null;
  content_html: string | null;
  page_type: string | null; // amenities, floor_plans, pricing, faq, etc.
  status: "pending" | "fetched" | "failed" | "js_fallback";
  fetch_method: "http" | "playwright";
  error_message: string | null;
  created_at: string;
}

// Uploaded File
export interface UploadedFile {
  id: string;
  job_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extracted_text: string | null;
  metadata: Record<string, unknown>;
  processing_status: "pending" | "processing" | "complete" | "failed";
  source_provenance: string;
  created_at: string;
}

// Property Data Schema - the core extraction target
export interface PropertyData {
  id: string;
  job_id: string;

  // Basic Info
  property_name: string | null;
  vertical: Vertical | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  management_company: string | null;

  // Units & Pricing
  unit_types: UnitType[] | null;
  pricing_ranges: PricingRange[] | null;
  specials_promotions: string[] | null;

  // Amenities & Policies
  amenities: string[] | null;
  pet_policy: string | null;
  parking: string | null;
  fees_deposits: FeeDeposit[] | null;
  lease_terms: string[] | null;

  // Operations
  office_hours: string | null;
  application_requirements: string[] | null;
  neighborhood_highlights: string[] | null;

  // Channels
  channels: Channel[];

  // Provenance
  source_urls: string[];
  source_files: string[];
  confidence_score: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface UnitType {
  name: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft_min: number | null;
  sqft_max: number | null;
  description: string | null;
}

export interface PricingRange {
  unit_type: string;
  min_price: number | null;
  max_price: number | null;
  period: string; // nightly, monthly, etc.
}

export interface FeeDeposit {
  name: string;
  amount: string | null;
  description: string | null;
}

// Extraction Field with provenance
export interface ExtractionField {
  field_name: string;
  extracted_value: unknown;
  confidence: number;
  source_snippets: SourceSnippet[];
  status: "pending" | "accepted" | "edited" | "rejected";
  edited_value: unknown | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
}

export interface SourceSnippet {
  text: string;
  source_type: "web" | "file";
  source_id: string;
  source_name: string;
  page_url?: string;
}

// Onboarding Job
export interface OnboardingJob {
  id: string;
  property_url: string;
  property_name: string | null;
  vertical: Vertical | null;
  status: JobStatus;
  consent_given: boolean;
  consent_at: string | null;

  // Crawl stats
  pages_found: number;
  pages_crawled: number;
  pages_failed: number;

  // File stats
  files_uploaded: number;
  files_processed: number;

  // Extraction
  extraction_status: "pending" | "running" | "complete" | "failed";
  extraction_confidence: number | null;

  // Review
  fields_total: number;
  fields_reviewed: number;
  fields_accepted: number;
  fields_edited: number;
  fields_rejected: number;

  created_at: string;
  updated_at: string;
  created_by: string | null;
}

// Onboarding Step
export type OnboardingStep =
  | "consent"
  | "url_input"
  | "file_upload"
  | "processing"
  | "status";

// Vertical metadata
export const VERTICALS: Record<Vertical, { label: string; icon: string; description: string }> = {
  hotel: { label: "Hotel", icon: "🏨", description: "Hotels & lodging properties" },
  resort: { label: "Resort", icon: "🏝️", description: "Resorts & destination properties" },
  restaurant: { label: "Restaurant", icon: "🍽️", description: "Restaurants & dining establishments" },
  venue: { label: "Venue", icon: "🎭", description: "Attractions, theme parks & event spaces" },
  casino: { label: "Casino", icon: "🎰", description: "Casinos & gaming properties" },
  stadium: { label: "Stadium", icon: "🏟️", description: "Stadiums, arenas & concert venues" },
  travel: { label: "Travel", icon: "✈️", description: "Travel agencies & tourism operators" },
  rental: { label: "Rental", icon: "🏠", description: "Short-term rentals, Airbnb & VRBO" },
  rideshare: { label: "Rideshare", icon: "🚗", description: "Transportation & ride-hailing" },
  spa: { label: "Spa", icon: "💆", description: "Spas & wellness centers" },
  event_space: { label: "Event Space", icon: "🎪", description: "Convention centers & event venues" },
  luxury: { label: "Luxury", icon: "⭐", description: "Luxury & boutique properties" },
};

export const CHANNELS: Record<Channel, { label: string; icon: string }> = {
  voice: { label: "Voice AI", icon: "📞" },
  sms: { label: "SMS / Text AI", icon: "💬" },
  webchat: { label: "Webchat AI", icon: "🌐" },
  whatsapp: { label: "WhatsApp AI", icon: "📱" },
};
