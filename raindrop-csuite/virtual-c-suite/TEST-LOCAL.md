# Local Testing Guide for Virtual C-Suite

## Prerequisites

- Node.js 18+ installed
- Raindrop CLI authenticated
- Windows Command Prompt (not Git Bash)

## Step 1: Validate Build

```cmd
cd "C:\Users\ruanc\source\repos\Virtual C-Suite\raindrop-csuite\virtual-c-suite"
npm run build
```

**Expected:** Build completes with no errors ✓ (Already passed!)

## Step 2: TypeScript Type Check

```cmd
npx tsc --noEmit
```

**Expected:** No output = no type errors ✓ (Already passed!)

## Step 3: Deploy to Raindrop Cloud

Raindrop applications run on the cloud platform. Deploy with:

```cmd
raindrop build deploy --start
```

**What this does:**
- Builds and validates your code
- Uploads to Raindrop platform
- Creates/updates services, buckets, databases
- Starts the application
- **Takes 2-5 minutes**

## Step 4: Check Deployment Status

```cmd
raindrop build status
```

**Expected output:**
```
Application: virtual-c-suite
Status: running
Services: upload-api, board-meeting-processor
```

## Step 5: Get API URLs

```cmd
raindrop build find
```

**Expected output:**
```
Service: upload-api
URL: https://[your-app-id].raindrop.ai
```

**Copy this URL** - you'll need it for testing!

## Step 6: Test API Endpoints

### 6.1 Test Health Check

```cmd
curl https://[your-url]/health
```

**Expected:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-04T..."
}
```

### 6.2 Create Test File

Create `test-sales.csv` with this content:
```csv
Product,Revenue,Cost,Units
Widget A,5000,3000,100
Widget B,3000,2000,75
Widget C,8000,4500,150
```

### 6.3 Test File Upload

```cmd
curl -X POST https://[your-url]/upload ^
  -F "file=@test-sales.csv" ^
  -F "userId=test-user-123"
```

**Expected:**
```json
{
  "requestId": "ABC123XYZ",
  "status": "processing",
  "message": "File uploaded successfully. Analysis in progress."
}
```

**Copy the requestId!**

### 6.4 Check Processing Status

```cmd
curl https://[your-url]/status/ABC123XYZ
```

**Expected (processing):**
```json
{
  "requestId": "ABC123XYZ",
  "status": "processing",
  "progress": {
    "cfo": "completed",
    "cmo": "processing",
    "coo": "completed",
    "synthesis": "pending"
  },
  "createdAt": "2025-12-04T..."
}
```

**Expected (after 5-10 seconds):**
```json
{
  "requestId": "ABC123XYZ",
  "status": "completed",
  "progress": {
    "cfo": "completed",
    "cmo": "completed",
    "coo": "completed",
    "synthesis": "completed"
  },
  "createdAt": "2025-12-04T...",
  "completedAt": "2025-12-04T..."
}
```

### 6.5 Get Final Report

```cmd
curl https://[your-url]/reports/ABC123XYZ
```

**Expected:**
```json
{
  "requestId": "ABC123XYZ",
  "status": "completed",
  "report": "# Virtual C-Suite Strategic Analysis\n\n## CFO Analysis...",
  "completedAt": "2025-12-04T..."
}
```

## Step 7: Test Timeout Detection

### 7.1 Manually Create Stale Request

```cmd
# Connect to database
raindrop build find

# Manually insert old request (for testing)
# This requires database access via Raindrop CLI
```

### 7.2 Check Status (Should Auto-Fail)

```cmd
curl https://[your-url]/status/OLD-REQUEST-ID
```

**Expected:**
```json
{
  "requestId": "OLD-REQUEST-ID",
  "status": "failed",
  "error": "Processing timeout exceeded",
  "message": "Analysis took longer than expected. Please try again."
}
```

## Step 8: View Logs

```cmd
raindrop logs tail
```

**Watch for:**
- File upload events
- AI processing logs
- Error messages (if any)
- Performance timings

## Step 9: Stop Application (When Done Testing)

```cmd
raindrop build stop
```

## Troubleshooting

### Error: "Application not found"
**Solution:** Deploy first with `raindrop build deploy --start`

### Error: "Unauthorized"
**Solution:** Authenticate with `raindrop auth login`

### Error: spawn npx ENOENT
**Solution:** Use Windows Command Prompt, not Git Bash

### Processing Takes Too Long
**Solution:** Check logs with `raindrop logs tail` for errors

### Status Stuck at "processing"
**Solution:** Wait 5 minutes - timeout detection will auto-fail

## Success Criteria

✅ Build completes without errors
✅ Type check passes
✅ Deployment succeeds
✅ Health check returns 200 OK
✅ File upload returns requestId
✅ Status shows progress
✅ Report contains all 4 analyses (CFO, CMO, COO, CEO)
✅ Timeout detection auto-fails old requests

## Architecture Verification

After successful testing, verify:
1. **Event-Driven**: File upload triggers automatic processing
2. **Parallel AI**: All 3 expert analyses run concurrently
3. **Database Tracking**: Status updates in real-time
4. **Error Handling**: Timeouts and failures handled gracefully
5. **REST API**: All endpoints return proper JSON

## Next Steps

Once local testing passes:
1. Update CORS with your frontend URL
2. Consider adding retry logic
3. Implement error bucket (optional)
4. Deploy frontend that calls these APIs

---

**Note:** Raindrop applications are designed for cloud deployment, not local development servers. All testing happens on the Raindrop platform with live services.
