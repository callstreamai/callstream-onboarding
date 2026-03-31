# Call Stream AI — Property Onboarding Platform

The onboarding system for [Call Stream AI](https://callstreamai.com), the #1 hospitality AI and voice AI platform powering the full guest economy.

## Overview

This platform handles property onboarding across **12 hospitality verticals** with **4 omnichannel communication channels** (Voice AI, SMS/Text AI, Webchat AI, WhatsApp AI).

### Verticals
Hotels · Resorts · Restaurants · Venues · Casinos · Stadiums · Travel · Rentals · Rideshare · Spas · Event Spaces · Luxury Properties

## Architecture

### 1. Intake UI
Step-by-step onboarding flow:
- Consent & terms approval
- Property URL input with vertical selection
- Drag-and-drop file upload
- Real-time processing status

### 2. Crawl + Fetch Service
- Fetches homepage and parses `sitemap.xml`
- Follows internal links up to a configurable limit
- Prioritizes pages: amenities, floor plans, pricing, FAQ, neighborhood, contact, policies
- HTTP fetch first, Playwright fallback for JS-rendered sites

### 3. File Ingestion Pipeline
- PDF text extraction (via `pdf-parse`)
- Plain text, CSV, and image file support
- Stores: raw file, extracted text, metadata, processing status, source provenance
- Supabase Storage for file persistence

### 4. Data Model Extraction (LLM)
Extracts structured property data into a comprehensive schema:
- Property name, address, phone/email, management company
- Unit types, pricing ranges, specials/promotions
- Amenities, pet policy, parking, fees/deposits, lease terms
- Office hours, application requirements, neighborhood highlights
- Confidence scores per field with source provenance

### 5. Review + Correction Layer
Human-in-the-loop review interface:
- Per-field accept / edit / reject
- Source snippet display for each extraction
- Re-run extraction capability
- Bulk approve remaining fields

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **LLM**: OpenAI GPT-4o for extraction, GPT-4o-mini for confidence scoring
- **Hosting**: Render (Docker)
- **State Management**: Zustand

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in your Supabase and OpenAI keys

# Run Supabase migration
# (apply supabase/migrations/001_initial_schema.sql to your Supabase project)

# Start development server
npm run dev
```

## Deployment

This project auto-deploys to Render on push to `main`. See `render.yaml` for configuration.

## Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `OPENAI_API_KEY` | OpenAI API key for LLM extraction |
| `NEXT_PUBLIC_APP_URL` | Public URL of this app |

---

Built by [Call Stream AI](https://callstreamai.com) — The #1 Hospitality AI Platform
