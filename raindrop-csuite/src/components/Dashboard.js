// Dashboard Component
export class Dashboard {
  static render() {
    return `
      <div class="dashboard">
        <header>
          <h1>Virtual C-Suite Dashboard</h1>
          <p>Welcome to your executive management platform</p>
        </header>
        
        <main>
          <section class="metrics">
            <h2>Dashboard</h2>
            <p style="color: var(--text-muted); font-size: 1.1rem;">Welcome to your Virtual C-Suite. Upload your business data to generate strategic insights.</p>
          </section>
          
          <section class="quick-actions">
            <h2>Quick Actions</h2>
            <div class="action-buttons">
              <div class="upload-container" id="dropZone">
                <div class="upload-zone">
                  <span class="upload-icon">📂</span>
                  <h3>Upload Business Data</h3>
                  <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Drag & Drop CSV, TXT, or PDF files here</p>
                  <button class="btn-primary">Select File</button>
                  <input type="file" id="businessData" accept="*" style="display: none">
                </div>
              </div>
            </div>
            <div id="uploadStatus" class="status-message"></div>
          </section>
        </main>

        <style>
          .status-message { margin-top: 1rem; font-weight: bold; }
          .status-message.processing { color: #38bdf8; }
          .status-message.success { color: #4ade80; }
          .status-message.error { color: #f87171; }
        </style>
      </div>
    `;
  }

  static setup() {
    // Drag and Drop Logic
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('businessData');
    const selectButton = document.querySelector('.upload-zone button');
    
    if (!dropZone || !fileInput) return;

    // Fix: Ensure button triggers input
    if (selectButton) {
        selectButton.onclick = () => fileInput.click();
    }

    // Fix: Attach change listener dynamically
    fileInput.onchange = (e) => handleUpload(e.target.files[0]);

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
      dropZone.querySelector('.upload-zone').classList.add('drag-active');
    }

    function unhighlight(e) {
      dropZone.querySelector('.upload-zone').classList.remove('drag-active');
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
      const dt = e.dataTransfer;
      const file = dt.files[0];
      handleUpload(file);
    }

    async function handleUpload(file) {
      if (!file) return;

      const statusDiv = document.getElementById('uploadStatus');
      statusDiv.textContent = 'Uploading and analyzing...';
      statusDiv.className = 'status-message processing';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', 'user-' + Date.now()); 

      try {
        // Use absolute URL for backend
        const response = await fetch('http://localhost:3000/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({})); // Handle non-JSON error response
          throw new Error(err.error || 'Upload failed with status ' + response.status);
        }

        const data = await response.json();
        statusDiv.textContent = 'Analysis started! Request ID: ' + data.requestId;
        statusDiv.className = 'status-message success';
        
        localStorage.setItem('lastRequestId', data.requestId);
        
        pollStatus(data.requestId);

      } catch (error) {
        console.error('Error:', error);
        statusDiv.textContent = 'Upload failed: ' + error.message;
        statusDiv.className = 'status-message error';
      }
    }

    async function pollStatus(requestId) {
      const statusDiv = document.getElementById('uploadStatus');
      const interval = setInterval(async () => {
        try {
          const response = await fetch('http://localhost:3000/status/' + requestId);
          const data = await response.json();

          if (data.status === 'completed') {
            clearInterval(interval);
            statusDiv.innerHTML = 'Analysis complete! <a href="/executives" style="color: #4ade80; text-decoration: underline;">View Executive Report</a>';
            statusDiv.className = 'status-message success';
          } else if (data.status === 'failed') {
            clearInterval(interval);
            statusDiv.textContent = 'Analysis failed: ' + (data.error || 'Unknown error');
            statusDiv.className = 'status-message error';
          } else {
            statusDiv.textContent = 'Analyzing... ' + 
              Object.entries(data.progress || {})
                .filter(([k, v]) => v === 'completed')
                .map(([k]) => k.toUpperCase())
                .join(', ');
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 2000);
    }
  }
}