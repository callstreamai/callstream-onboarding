// JSON Schema for property data extraction
// This is sent to the LLM as the response format

export const PROPERTY_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    property_name: {
      type: ["string", "null"],
      description: "Official name of the property",
    },
    vertical: {
      type: ["string", "null"],
      enum: [
        "hotel", "resort", "restaurant", "venue", "casino", "stadium",
        "travel", "rental", "rideshare", "spa", "event_space", "luxury", null,
      ],
      description: "Which hospitality vertical this property belongs to",
    },
    address: { type: ["string", "null"], description: "Full street address" },
    city: { type: ["string", "null"] },
    state: { type: ["string", "null"] },
    zip_code: { type: ["string", "null"] },
    phone: { type: ["string", "null"], description: "Primary phone number" },
    email: { type: ["string", "null"], description: "Primary contact email" },
    management_company: {
      type: ["string", "null"],
      description: "Name of the management or parent company",
    },
    unit_types: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          bedrooms: { type: ["number", "null"] },
          bathrooms: { type: ["number", "null"] },
          sqft_min: { type: ["number", "null"] },
          sqft_max: { type: ["number", "null"] },
          description: { type: ["string", "null"] },
        },
        required: ["name"],
      },
      description: "Room types, suite types, or unit types available",
    },
    pricing_ranges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          unit_type: { type: "string" },
          min_price: { type: ["number", "null"] },
          max_price: { type: ["number", "null"] },
          period: { type: "string", description: "nightly, monthly, per event, etc." },
        },
        required: ["unit_type"],
      },
    },
    specials_promotions: {
      type: "array",
      items: { type: "string" },
      description: "Current specials, promotions, or deals",
    },
    amenities: {
      type: "array",
      items: { type: "string" },
      description: "List of all amenities",
    },
    pet_policy: { type: ["string", "null"] },
    parking: { type: ["string", "null"], description: "Parking information and fees" },
    fees_deposits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          amount: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
        },
        required: ["name"],
      },
    },
    lease_terms: {
      type: "array",
      items: { type: "string" },
      description: "Available lease or booking terms",
    },
    office_hours: { type: ["string", "null"] },
    application_requirements: {
      type: "array",
      items: { type: "string" },
    },
    neighborhood_highlights: {
      type: "array",
      items: { type: "string" },
      description: "Notable nearby attractions, restaurants, landmarks",
    },
  },
  required: ["property_name"],
} as const;
