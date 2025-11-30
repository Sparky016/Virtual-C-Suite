const http = require('http');

const PORT = 3000;

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Normalize URL to strip /api prefix
  const url = req.url.replace(/^\/api/, '');

  // /upload endpoint
  if (url === '/upload' && req.method === 'POST') {
    let body = [];
    req.on('data', (chunk) => {
      body.push(chunk);
    });
    
    req.on('end', () => {
      const bodyBuffer = Buffer.concat(body);
      
      // Check for large file (simulated > 10MB)
      if (bodyBuffer.length > 10 * 1024 * 1024) {
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload Too Large' }));
        return;
      }

      const bodyString = bodyBuffer.toString();

      // Simple mock validation based on filename in multipart body
      if (bodyString.includes('filename="malware.exe"')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid file type' }));
        return;
      }

      if (bodyString.includes('filename="empty.txt"')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File is empty' }));
        return;
      }
      
      // SUCCESS RESPONSE
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        requestId: 'req-' + Date.now(),
        status: 'processing',
        message: 'Upload successful'
      }));
    });
    return;
  }

  // /status/:requestId endpoint
  if (url.startsWith('/status/') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      requestId: url.split('/')[2],
      status: 'completed',
      progress: { cfo: 'completed', cmo: 'completed', coo: 'completed', synthesis: 'completed' }
    }));
    return;
  }

  // /reports/:requestId endpoint
  if (url.startsWith('/reports/') && req.method === 'GET') {
    // Generate a realistic-looking report
    const reportDate = new Date().toLocaleDateString();
    const revenue = Math.floor(Math.random() * 500000) + 500000;
    const growth = (Math.random() * 15 + 5).toFixed(1);
    
    const report = `
# Strategic Board Meeting Report
**Date:** ${reportDate}

## 📊 Executive Summary
The board has reviewed the Q4 performance data. Overall, the company is showing strong resilience with a projected revenue of **$${revenue.toLocaleString()}** and a **${growth}%** year-over-year growth.

## 🗣️ C-Suite Insights

### 💰 CFO (Financial)
*   **Revenue Analysis**: Sales in the "Coffee" category have outperformed expectations by 15%.
*   **Cost Management**: Operational costs have stabilized, though "Rent" remains a significant overhead.
*   **Projection Model**: Our growth formula $$G = \\frac{R_t - R_{t-1}}{R_{t-1}} \\times 100$$ indicates a steady upward trend.
*   **Recommendation**: Reallocate 10% of the surplus budget to marketing initiatives.

### 📣 CMO (Marketing)
*   **Campaign Performance**: The recent "Morning Brew" campaign drove a 20% increase in foot traffic.
*   **Customer Sentiment**: Positive sentiment is at an all-time high of 88%.
*   **Strategy**: We should double down on social media engagement for the upcoming holiday season.

### ⚙️ COO (Operations)
*   **Supply Chain**: Coffee bean supply is stable, but pastry ingredients are seeing price volatility.
*   **Efficiency**: Staff scheduling optimization has reduced overtime costs by 5%.

## 🎯 CEO's Strategic Directive
"Team, these numbers are promising. Let's focus our efforts on the high-margin 'Pastry' category while maintaining our dominance in coffee. I want a detailed expansion plan on my desk by next Monday."

[Play Audio](https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3)
`;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      requestId: url.split('/')[2],
      status: 'completed',
      report: report,
      completedAt: new Date().toISOString()
    }));
    return;
  }

  // /run-tests endpoint (New!)
  if (url === '/run-tests' && req.method === 'POST') {
    const { exec } = require('child_process');
    // Run vitest in json mode
    exec('npx vitest run --reporter=json', { cwd: __dirname }, (error, stdout, stderr) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      // Vitest JSON output is usually in stdout, but if it fails entirely it might be in stderr
      // We'll try to parse stdout.
      try {
        const jsonStart = stdout.indexOf('{');
        const jsonReport = stdout.substring(jsonStart);
        res.end(jsonReport);
      } catch (e) {
        // Fallback if JSON parsing fails
        res.end(JSON.stringify({ 
          success: false, 
          message: 'Could not parse test results', 
          rawOutput: stdout + stderr 
        }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Virtual C-Suite Backend running at http://localhost:${PORT}`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n\x1b[31m%s\x1b[0m', 'Error: Port 3000 is already in use!');
    console.error('\x1b[33m%s\x1b[0m', 'Please close any other "Virtual C-Suite Backend" terminal windows and try again.\n');
    process.exit(1);
  }
});
