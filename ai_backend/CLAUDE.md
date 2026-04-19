# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Backend service for document processing, PPT analysis, audio transcription, and bidding document analysis. Built with Node.js/Express, uses MySQL via Prisma ORM, and integrates with OpenAI-compatible API endpoints.

## Commands

```bash
# Start server
npm start                    # Production: node server/app.js
npm run dev                  # Development with --watch flag

# Testing & Utilities
npm test                     # Run test-extractor.js
npm run batch                # Batch extract documents
npm run import-bidding       # Import bidding keywords

# Direct execution
node scripts/test-extractor.js
node scripts/batch-extract.js
```

## Architecture

### Backend Structure

```
server/
├── app.js              # Main Express application entry point
├── routes/             # HTTP route handlers
│   ├── index.js        # Admin API router (/api/admin/*)
│   ├── admin/          # Admin panel routes (models, prompts, system)
│   └── *Routes.js      # Feature routes (documents, transcription, etc.)
├── services/           # Business logic layer
├── config/             # Configuration files (aiModels.js, JSON configs)
└── prompts/            # Prompt templates for AI analysis

core/
└── extractors/
    └── DocumentTextExtractor.js  # Core text extraction from PPT JSON

frontend/               # Static HTML/JS served by Express
├── pages/              # Feature pages
└── js/pages/           # Page-specific JavaScript
```

### Key Routes

| Route Prefix | Module | Purpose |
|--------------|--------|---------|
| `/api/admin/*` | routes/index.js | Admin panel (models, prompts, system) |
| `/api/documents` | documentRoutes.js | Document management |
| `/api/ppt-analysis` | pptAnalysisRoutes.js | PPT content analysis |
| `/api/transcription` | transcriptionRoutes.js | Audio transcription |
| `/api/presales-analysis` | presalesAnalysisRoutes.js | Pre-sales analysis |
| `/api/tender-analysis` | tenderAnalysisRoutes.js | Tender document analysis |
| `/api/bid-analysis` | bidAnalysisRoutes.js | Bid document analysis |
| `/api/auto-process` | autoProcessRoutes.js | Automated batch processing |

### Database

- MySQL database via Prisma ORM
- Schema located at: `../online-ppt-backend/prisma/schema.prisma`
- Connection configured in `.env`: `DATABASE_URL`

### AI Model Integration

All AI models use OpenAI-compatible API endpoint. Configuration in `server/config/aiModels.js`:

- **Endpoint**: Configurable via `CUSTOM_OPENAI_BASE_URL` env var
- **Models**: GPT-4o, DeepSeek, Qwen, O1 series, etc.
- **Service**: `server/services/aiServiceUnified.js` provides unified AI calling interface

### DocumentTextExtractor

Core utility for extracting text from PPT JSON documents:

```javascript
const { DocumentTextExtractor } = require('./core/extractors/DocumentTextExtractor')
const extractor = new DocumentTextExtractor()
await extractor.run(inputFile, outputFile)
```

- Extracts text from `slides[].elements[]` in JSON format
- Handles `<span>` HTML tags and HTML entities
- Outputs detailed and merged text formats

## Development Notes

### Request Body Limits

Express is configured with 50MB limit for JSON/urlencoded bodies to support large document uploads:

```javascript
app.use(express.json({ limit: '50mb' }))
```

### BigInt Serialization

Prisma BigInt fields require custom serialization:

```javascript
BigInt.prototype.toJSON = function () { return Number(this) }
```

### Adding New Features

1. Create route handler in `server/routes/newFeatureRoutes.js`
2. Create service in `server/services/newFeatureService.js`
3. Register route in `server/app.js`
4. Create frontend page in `frontend/pages/` and `frontend/js/pages/`

### Static File Serving

- Frontend: `/` -> `frontend/`
- Output files: `/output/*`
- Scraper output: `/scraper_output/*`
- Libraries: `/lib/jszip`, `/lib/docx-preview`

## Environment Variables

Required in `.env`:

```
PORT=3000
DATABASE_URL="mysql://user:pass@host:port/database"
CUSTOM_OPENAI_API_KEY=your-api-key
CUSTOM_OPENAI_BASE_URL=http://your-api-server:port/v1
```