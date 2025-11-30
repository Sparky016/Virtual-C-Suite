# Virtual C-Suite - Deployment Instructions

## Prerequisites

✅ All code is implemented and TypeScript builds successfully
✅ Raindrop CLI is installed
✅ You are authenticated with Raindrop (`raindrop auth login`)

## Manual Deployment Steps

### Step 1: Open Windows Command Prompt

**DO NOT use Git Bash or PowerShell** - use native Windows Command Prompt:

1. Press `Win + R`
2. Type `cmd` and press Enter
3. Or search for "Command Prompt" in Start menu

### Step 2: Navigate to Project Directory

```cmd
cd "C:\Users\ruanc\source\repos\Virtual C-Suite\raindrop-csuite\virtual-c-suite"
```

### Step 3: Verify Build

```cmd
npm run build
```

Expected output: Build completes successfully with no errors.

### Step 4: Deploy to Raindrop

```cmd
raindrop build deploy --start
```

This command will:
1. Validate the manifest
2. Build the TypeScript code
3. Upload the application to Raindrop
4. Start all services and observers

**Expected deployment time**: 2-5 minutes

### Step 5: Verify Deployment

Once deployment completes, check the status:

```cmd
raindrop build status
```

Expected output:
```
Application: virtual-c-suite
Status: running
Services:
  - upload-api: running
  - analysis-coordinator: running
Observers:
  - board-meeting-processor: active
Database:
  - tracking-db: ready
```

### Step 6: Get Service URLs

```cmd
raindrop build find
```

This will show you the URLs for your services:
- `upload-api` - Your public API endpoint for file uploads

## Testing the Application

### Test 1: Health Check

```cmd
curl https://[upload-api-url]/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-11-30T..."}
```

### Test 2: Upload a Test File

Create a test CSV file (`test-sales.csv`):
```csv
Product,Revenue,Units,Cost
Widget A,5000,100,3000
Widget B,3000,75,2500
Widget C,8000,150,4000
```

Upload it:
```cmd
curl -X POST https://[upload-api-url]/upload ^
  -F "file=@test-sales.csv" ^
  -F "userId=test-user-123"
```

Expected response:
```json
{
  "requestId": "...",
  "status": "processing",
  "message": "File uploaded successfully. Analysis in progress."
}
```

### Test 3: Check Analysis Status

```cmd
curl https://[upload-api-url]/status/[requestId]
```

### Test 4: Retrieve Completed Report

```cmd
curl https://[upload-api-url]/reports/[requestId]
```

Expected response: Full Markdown report with CFO, CMO, COO analyses and CEO synthesis.

## Monitoring Logs

To watch logs in real-time:

```cmd
raindrop logs tail
```

To query recent logs:

```cmd
raindrop logs query --since 5m
```

## Troubleshooting

### Issue: "Application not found"

Run:
```cmd
raindrop build deploy
```

### Issue: "Permission denied"

Make sure you're authenticated:
```cmd
raindrop auth login
```

### Issue: Services not starting

Check logs:
```cmd
raindrop logs query --limit 100
```

### Issue: Database errors

The database migrations run automatically on first deployment. If there are issues:
```cmd
raindrop build status
```

Check for migration errors in the status output.

## Architecture Overview

Once deployed, the application works as follows:

1. **User uploads file** → `POST /upload` on `upload-api`
2. **File stored** → `input-bucket`
3. **Observer triggered** → `board-meeting-processor` activates
4. **Parallel AI analysis** → Three simultaneous calls to SambaNova:
   - CFO: Financial analysis
   - CMO: Marketing analysis
   - COO: Operations analysis
5. **Synthesis** → CEO perspective combines all analyses
6. **Report saved** → `output-bucket` and `tracking-db`
7. **User retrieves** → `GET /reports/:requestId`

## Performance Targets

- **File upload**: < 1 second
- **Observer trigger**: < 1 second
- **Parallel AI analysis**: 4-8 seconds
- **CEO synthesis**: 2-3 seconds
- **Total processing**: < 10 seconds end-to-end

## Next Steps After Deployment

1. **Test with real data** - Upload actual business data files
2. **Monitor performance** - Use `raindrop logs tail` to watch processing
3. **Verify reports** - Check that AI analyses are meaningful and accurate
4. **Frontend development** - Build a UI for easier file uploads
5. **Demo preparation** - Record demo video showing the sub-10-second processing

## Support

- Raindrop docs: https://docs.liquidmetal.ai
- Application logs: `raindrop logs tail`
- Status check: `raindrop build status`
