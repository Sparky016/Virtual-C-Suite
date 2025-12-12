# Virtual C-Suite

A virtual C-Suite application built on the Raindrop platform for executive management and decision support.

## Quick Reference

**Local Development:**
```bash
npm run dev:all          # Run all services locally with hot reload
npm run dev:upload       # Run upload-api only (port 3000)
npm run dev:coord        # Run analysis-coordinator only (port 3001)
npm run dev:processor    # Run board-meeting-processor only (port 3002)
```

**Production Deployment:**
```bash
npm start                # Deploy and start on Raindrop
npm stop                 # Stop the application
npm restart              # Restart the application
```

**Other Commands:**
```bash
npm test                 # Run tests
npm run build            # Build TypeScript
npm run lint             # Lint code
npm run format           # Format code
```

## Overview

The Virtual C-Suite provides a comprehensive dashboard and executive team interface to help with strategic decision-making, performance monitoring, and team management. It democratizes strategic intelligence for the SME economy by providing an on-demand "Board of Directors" powered by AI.

## Architecture

The system uses a **Scatter-Gather** architecture pattern to parallelize executive analysis, ensuring rapid responses even with complex reasoning models.

```mermaid
graph TD
    User([User]) --> Auth[Firebase Authentication]
    Auth --> UI[Frontend UI (React)]
    
    subgraph "Frontend Components"
        UI --> Chat[Chat Interface]
        UI --> Board[Boardroom Manager]
        UI --> Upload[Data Room / Upload]
        UI --> Brand[Brand Manager]
    end

    subgraph "Raindrop Service Layer (Liquid Metal)"
        Upload -->|File Upload| UploadAPI[Upload API]
        Chat -->|Chat Request| CoordAPI[Analysis Coordinator]
        
        UploadAPI --> InputBucket[("📂 Input Bucket")]
        InputBucket -->|Trigger Event| Observer[("⚡ Raindrop Observer")]
    end

    subgraph "Vultr Cloud Intelligence"
        Observer -->|Promise.all (Parallel)| Scatter[Scatter Execution]
        
        Scatter -- "Analyzes Finances" --> CFO[("📉 CFO Agent")]
        Scatter -- "Analyzes Growth" --> CMO[("🚀 CMO Agent")]
        Scatter -- "Analyzes Ops" --> COO[("⚙️ COO Agent")]
        
        CFO & CMO & COO --> Synthesis[("👔 CEO Agent (Synthesis)")]
    end

    Synthesis --> OutputBucket[("📄 Output Bucket")]
    OutputBucket --> Board
    
    CoordAPI <-->|RAG Context| VectorStore[("🧠 Vultr Vector Store")]
```

### ⚡ Powered By
*   **LiquidMetal Raindrop**: Provides the serverless infrastructure, Observers, and MCP (Model Context Protocol).
*   **Vultr Inference**: Powers the high-speed Llama-3-70b-Instruct models for the agents and RAG capabilities.
*   **Claude Code**: Accelerating development via AI-assisted coding.

### 🚀 Key Features
- **Parallel Processing**: Uses `Promise.all()` in the Raindrop Observer to trigger all board members simultaneously, reducing wait times significantly.
- **RAG Integration**: The Virtual CEO uses Vultr's Vector Store to access your uploaded documents during chat.
- **Real-World Impact**: Generate printable PDF/Markdown reports to take directly to business meetings or bank appointments.

## Features

- **Dashboard**: A dedicated space to interact with the Virtual CEO Agent, discussing your business and uploaded documents.
- **Executive Team**: Virtual C-Suite members for consultation and strategic planning
- **Bring Your Own Key (BYOK)**: Supports custom API keys (e.g., Vultr, SambaNova) which are stored encrypted in the database for maximum security.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Raindrop CLI installed (for production deployment)
- Firebase Account (for authentication)
- Vultr API Key (for inference)
- SambaNova API Key (for inference)
- Claude Code with Raindrop MCP for AI-assisted coding

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.dev.vars` file for local environment variables (copy from `.dev.vars.example` if available)

### Running Locally

For local development, use the dev scripts which run the services with hot reload on Node.js:

**Run all services:**
```bash
npm run dev:all
```

This starts four services in parallel:
- **upload-api** on port 3000
- **analysis-coordinator** on port 3001
- **board-meeting-processor** on port 3002
- **authentication** on port 3003

**Run individual services:**
```bash
npm run dev:upload      # Upload API only (port 3000)
npm run dev:coord       # Analysis Coordinator only (port 3001)
npm run dev:processor   # Board Meeting Processor only (port 3002)
npm run dev:auth        # Authentication only (port 3003)
```

**Note:** Local development uses `@hono/node-server` and runs on Node.js with TypeScript compilation via `tsx`. Changes are automatically reloaded.

## Project Structure

```
raindrop-csuite/
├── virtual-c-suite/         # Main application directory
│   ├── src/                 # Source code
│   ├── db/                  # Database schemas and migrations
│   ├── package.json         # Application dependencies
│   ├── tsconfig.json        # TypeScript configuration
│   └── raindrop.manifest    # Raindrop deployment manifest
├── package.json             # Root package configuration
└── README.md               # This file
```

## Usage

### Dashboard

The dashboard provides:
- The frontend React application

### Executive Team

Access your virtual C-Suite:
- **CEO**: Strategic vision and company leadership
- **CFO**: Financial planning and risk management
- **CMO**: Marketing strategy and brand development
- **COO**: Operations and business efficiency

Each executive provides consultation to the CEO and can be used to generate reports and documents.

## API Reference

The application exposes two main APIs: the **Upload API** (public-facing) and the **Analysis Coordinator API** (internal/private).

### Upload API

Base URL: `http://localhost:3000` (Local)

#### General
- `GET /health`
  - Check API health status.

#### Analysis Operations
- `POST /upload`
  - Upload a file for analysis.
  - **Body (multipart/form-data)**:
    - `file`: The document file (PDF, DOCX, TXT).
    - `userId`: ID of the uploading user.
  - **Response**: Returns a `requestId` to track the analysis.

- `GET /status/:requestId`
  - Check the status of an ongoing analysis.
  - **Params**: `requestId`
  - **Response**: Usage status (e.g., `processing`, `completed`, `failed`) and progress.

- `GET /reports/:requestId`
  - Retrieve the final analysis report.
  - **Params**: `requestId`
  - **Response**: The markdown content of the final report.

### Analysis Coordinator API

Base URL: `http://localhost:3001` (Local)

#### General
- `GET /health`
  - Check API health status.
- `GET /api/config`
  - Get service configuration and available resources status.

#### Document Management
- `GET /api/documents`
  - List documents in the input bucket.
  - **Query**: `prefix` (optional), `limit` (optional).

- `GET /api/documents/:key`
  - Download a specific document.

- `POST /api/documents/search`
  - Search document content.
  - **Body (JSON)**: `query`, `page`, `pageSize`, `requestId`.

- `POST /api/documents/chat`
  - Chat with a specific document (RAG).
  - **Body (JSON)**: `objectId` (file key), `query`.

#### Cache Operations
- `POST /api/cache`
  - Store a value in the KV cache.
  - **Body (JSON)**: `key`, `value`, `ttl` (optional).

- `GET /api/cache/:key`
  - Retrieve a value from the KV cache.

## Development

### Local Development vs Production

This application has two distinct runtime environments:

- **Local Development**: Runs on Node.js using `@hono/node-server` (see `src/*/local.ts` files)
- **Production**: Runs on Cloudflare Workers via Raindrop platform (see `src/*/index.ts` files)

The separation ensures Node.js-specific code doesn't interfere with the Cloudflare Workers build and the desired stateless architecture.

### Building for Production

To build the TypeScript application:

```bash
npm run build
```

This will remove the `dist` directory and compile all TypeScript files. The build output is ready for deployment to the Raindrop platform.

### Deploying to Production

**Prerequisites:**
- Authenticate with Raindrop first:
  ```bash
  raindrop auth login
  ```

**Deploy and start:**
```bash
npm start
```
or
```bash
raindrop build deploy --start
```

This command will:
- Validate the raindrop.manifest
- Build the TypeScript code for Cloudflare Workers
- Bundle handlers without Node.js dependencies
- Upload the application to Raindrop
- Start all services and observers (upload-api, analysis-coordinator, board-meeting-processor)
- Initialize database with migrations

**Stop the application:**
```bash
npm stop
```

**Restart the application:**
```bash
npm restart
```

### Checking Deployment Status

After deployment, verify the application is running:
```bash
raindrop build status
```

View the public API URL:
```bash
raindrop build find
```

Monitor logs in real-time:
```bash
raindrop logs tail
```

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Code Quality

Format code:
```bash
npm run format
```

Lint code:
```bash
npm run lint
```

## Configuration

The application is configured through multiple files:

- **raindrop.manifest**: Defines services, observers, databases, and buckets
- **tsconfig.json**: TypeScript compiler configuration
- **package.json**: Dependencies and build scripts
- **Output directory**: `virtual-c-suite/dist/`

### Key Services

- **upload-api**: Public API for file uploads (Hono-based)
- **analysis-coordinator**: Private service for coordinating AI analysis
- **board-meeting-processor**: Observer that processes uploaded files
- **tracking-db**: SQL database for request tracking
- **input-bucket/output-bucket**: File storage buckets

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support with Raindrop platform issues, visit the official Raindrop documentation.

For application-specific issues, please open an issue in this repository.