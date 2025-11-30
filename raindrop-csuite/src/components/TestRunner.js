export class TestRunner {
  static render() {
    return `
      <div class="test-runner">
        <header>
          <h1>System Diagnostics</h1>
          <p>Run automated tests to verify system integrity</p>
        </header>
        
        <main>
          <div class="card">
            <div class="test-controls">
              <button class="btn-primary" onclick="runTests()" id="runTestsBtn">Run System Tests</button>
              <span id="testStatus" class="status-badge">Ready</span>
            </div>
            
            <div id="testResults" class="test-results-container">
              <p class="placeholder-text">Click "Run System Tests" to start diagnostics.</p>
            </div>
          </div>
        </main>

        <script>
              console.error(e);
              resultsDiv.innerHTML = '<div class="error-message">Failed to run tests. Ensure Backend is running.</div>';
              status.textContent = 'Error';
              status.className = 'status-badge error';
            } finally {
              btn.disabled = false;
            }
          }

          function displayResults(data) {
            const resultsDiv = document.getElementById('testResults');
            
            if (!data.testResults) {
               resultsDiv.innerHTML = '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
               return;
            }

            let html = '<div class="test-summary">';
            html += '<div class="summary-item success">Passed: ' + data.numPassedTests + '</div>';
            html += '<div class="summary-item error">Failed: ' + data.numFailedTests + '</div>';
            html += '<div class="summary-item">Total: ' + data.numTotalTests + '</div>';
            html += '</div>';

            html += '<div class="test-list">';
            
            data.testResults.forEach(suite => {
              suite.assertionResults.forEach(test => {
                const statusIcon = test.status === 'passed' ? '✅' : '❌';
                const statusClass = test.status;
                html += \`
                  <div class="test-item \${statusClass}">
                    <span class="test-icon">\${statusIcon}</span>
                    <span class="test-name">\${test.title}</span>
                    <span class="test-duration">\${test.duration || 0}ms</span>
                  </div>
                \`;
              });
            });
            
            html += '</div>';
            resultsDiv.innerHTML = html;
          }
        </script>
        <style>
          .test-controls {
            display: flex;
            align-items: center;
            gap: 1rem;
            margin-bottom: 2rem;
          }
          .test-results-container {
            background: #f8fafc;
            border-radius: 8px;
            padding: 1rem;
            min-height: 200px;
            max-height: 500px;
            overflow-y: auto;
          }
          .test-summary {
            display: flex;
            gap: 2rem;
            margin-bottom: 1rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #e2e8f0;
            font-weight: bold;
          }
          .summary-item.success { color: #16a34a; }
          .summary-item.error { color: #dc2626; }
          
          .test-item {
            display: flex;
            align-items: center;
            padding: 0.75rem;
            border-bottom: 1px solid #e2e8f0;
            background: white;
          }
          .test-item:last-child { border-bottom: none; }
          .test-item.failed { background: #fef2f2; }
          
          .test-icon { margin-right: 1rem; }
          .test-name { flex: 1; font-weight: 500; }
          .test-duration { color: #94a3b8; font-size: 0.875rem; }
        </style>
      </div>
    `;
  }
}
