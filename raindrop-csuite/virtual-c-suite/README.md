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

The Virtual C-Suite provides a comprehensive dashboard and executive team interface to help with strategic decision-making, performance monitoring, and team management.

## Features

- **Dashboard**: Real-time KPI monitoring with key performance indicators
- **Executive Team**: Virtual C-Suite members for consultation and strategic planning
- **Quick Actions**: Rapid access to common executive functions
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Raindrop CLI installed (for production deployment)

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

This starts three services in parallel:
- **upload-api** on port 3000
- **analysis-coordinator** on port 3001
- **board-meeting-processor** on port 3002

**Run individual services:**
```bash
npm run dev:upload      # Upload API only (port 3000)
npm run dev:coord       # Analysis Coordinator only (port 3001)
npm run dev:processor   # Board Meeting Processor only (port 3002)
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
- Key performance indicators (Revenue, Active Users, Customer Satisfaction, Team Size)
- Quick action buttons for common tasks
- Real-time metrics with trend indicators

### Executive Team

Access your virtual C-Suite:
- **CEO**: Strategic vision and company leadership
- **CFO**: Financial planning and risk management
- **CTO**: Technology strategy and innovation
- **CMO**: Marketing strategy and brand development
- **COO**: Operations and business efficiency
- **CHRO**: Human resources and talent management

Each executive provides consultation services and detailed profiles.

## Development

### Local Development vs Production

This application has two distinct runtime environments:

- **Local Development**: Runs on Node.js using `@hono/node-server` (see `src/*/local.ts` files)
- **Production**: Runs on Cloudflare Workers via Raindrop platform (see `src/*/index.ts` files)

The separation ensures Node.js-specific code doesn't interfere with the Cloudflare Workers build.

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