# Virtual C-Suite

A virtual C-Suite application built on the Raindrop platform for executive management and decision support.

## Overview

The Virtual C-Suite provides a comprehensive dashboard and executive team interface to help with strategic decision-making, performance monitoring, and team management.

## Features

- **Dashboard**: Real-time KPI monitoring with key performance indicators
- **Executive Team**: Virtual C-Suite members for consultation and strategic planning
- **Quick Actions**: Rapid access to common executive functions
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Raindrop CLI installed
- Node.js (if running locally)

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Authenticate with Raindrop (if needed):
   ```bash
   raindrop auth login
   ```

4. Start the development server:
   ```bash
   npm start
   ```
   or
   ```bash
   raindrop dev
   ```

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

### Building

To build the TypeScript application:

1. Navigate to the virtual-c-suite directory:
   ```bash
   cd virtual-c-suite
   ```

2. Run the build command:
   ```bash
   npm run build
   ```

This will remove the `dist` directory and compile all TypeScript files.

### Deployment

To deploy to Raindrop (run from repository root):

1. Make sure you're authenticated:
   ```bash
   raindrop auth login
   ```

2. Deploy and start the application:
   ```bash
   raindrop build deploy --start
   ```

This command will:
- Validate the manifest
- Build the TypeScript code
- Upload the application to Raindrop
- Start all services and observers (upload-api, analysis-coordinator, board-meeting-processor)
- Initialize database with migrations

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