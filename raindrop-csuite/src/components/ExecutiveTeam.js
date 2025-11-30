// Executive Team Component
export class ExecutiveTeam {
  static render() {
    return `
      <div class="executive-team">
        <header>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <button onclick="window.history.back()" style="background: none; border: 1px solid rgba(255,255,255,0.2); color: white; padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer;">← Back</button>
            <div>
              <h1>Executive Team</h1>
              <p>Meet your virtual C-Suite</p>
            </div>
          </div>
          <div id="report-status"></div>
        </header>
        
        <main>
          <section class="executive-grid">
            <div class="executive-card">
              <div class="executive-avatar">CEO</div>
              <h3>Chief Executive Officer</h3>
              <span class="role-badge">Strategy</span>
              <p>Strategic vision and company leadership</p>
              <div class="executive-actions">
                <button onclick="playAudio('CEO')">Play Summary</button>
                <button onclick="viewProfile('CEO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">CFO</div>
              <h3>Chief Financial Officer</h3>
              <span class="role-badge">Finance</span>
              <p>Financial planning and risk management</p>
              <div class="executive-actions">
                <button onclick="consultWith('CFO')">Consult</button>
                <button onclick="viewProfile('CFO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">CTO</div>
              <h3>Chief Technology Officer</h3>
              <span class="role-badge">Technology</span>
              <p>Technology strategy and innovation</p>
              <div class="executive-actions">
                <button onclick="consultWith('CTO')">Consult</button>
                <button onclick="viewProfile('CTO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">CMO</div>
              <h3>Chief Marketing Officer</h3>
              <span class="role-badge">Marketing</span>
              <p>Marketing strategy and brand development</p>
              <div class="executive-actions">
                <button onclick="consultWith('CMO')">Consult</button>
                <button onclick="viewProfile('CMO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">COO</div>
              <h3>Chief Operating Officer</h3>
              <span class="role-badge">Operations</span>
              <p>Operations and business efficiency</p>
              <div class="executive-actions">
                <button onclick="consultWith('COO')">Consult</button>
                <button onclick="viewProfile('COO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">CHRO</div>
              <h3>Chief HR Officer</h3>
              <span class="role-badge">People</span>
              <p>Human resources and talent management</p>
              <div class="executive-actions">
                <button onclick="consultWith('CHRO')">Consult</button>
                <button onclick="viewProfile('CHRO')">Profile</button>
              </div>
            </div>
          </section>
          
          <section class="team-overview" id="report-content">
            <h2>Latest Strategic Report</h2>
            <div id="markdown-content">No report generated yet. Upload data in the Dashboard to start.</div>
          </section>
        </main>
        </main>
      </div>
    `;
  }

  static setup() {
    // Load report on mount
    loadReport();

    // Expose functions to window for onclick handlers
    window.playAudio = playAudio;
    window.consultWith = consultWith;
    window.viewProfile = viewProfile;

    async function loadReport() {
      const requestId = localStorage.getItem('lastRequestId');
      if (!requestId) {
        document.getElementById('markdown-content').innerHTML = '<p class="placeholder-text">No report generated yet. Upload data in the Dashboard to start.</p>';
        return;
      }

      try {
        const response = await fetch('http://localhost:3000/reports/' + requestId);
        const data = await response.json();
        
        if (data.status === 'completed' && data.report) {
          // Parse Markdown to HTML using Marked.js
          const htmlContent = marked.parse(data.report);
          const contentDiv = document.getElementById('markdown-content');
          contentDiv.innerHTML = `<div class="report-document">${htmlContent}</div>`;
          
          // Trigger MathJax to render any formulas
          if (window.MathJax) {
            window.MathJax.typesetPromise([contentDiv]);
          }
          
          // Check for audio link in report (simple parsing)
          const audioMatch = data.report.match(/\[Play Audio\]\((.*?)\)/);
          if (audioMatch) {
            window.audioUrl = audioMatch[1];
            // Update CEO button to indicate audio is ready
            const ceoBtn = document.querySelector('button[onclick="playAudio(\'CEO\')"]');
            if (ceoBtn) ceoBtn.innerText = '▶ Play Summary';
          }
        }
      } catch (e) {
        console.error('Failed to load report:', e);
        document.getElementById('markdown-content').innerHTML = '<p class="error-text">Error loading report. Please try again.</p>';
      }
    }

    function playAudio(role) {
      if (role === 'CEO' && window.audioUrl) {
        const btn = document.querySelector('button[onclick="playAudio(\'CEO\')"]');
        const originalText = btn ? btn.innerText : 'Play Summary';
        
        if (btn) btn.innerText = '🔊 Playing...';
        
        const audio = new Audio(window.audioUrl);
        audio.play().catch(e => alert('Error playing audio: ' + e.message));
        
        audio.onended = () => {
          if (btn) btn.innerText = originalText;
        };
      } else {
        alert('Audio summary is not available yet. Please wait for the report to fully load.');
      }
    }

    function consultWith(role) {
      const responses = {
        'CFO': 'Based on the current fiscal data, I recommend we hold off on major capital expenditures until Q3.',
        'CTO': 'Our tech stack is stable, but we should consider upgrading our cloud infrastructure to reduce latency.',
        'CMO': 'The latest social media trends suggest a pivot to video content. I will draft a proposal.',
        'COO': 'Supply chain logistics are looking good, but we have a bottleneck in distribution center B.',
        'CHRO': 'Employee satisfaction is up, but we need to address the gap in mid-level management training.'
      };
      
      const msg = responses[role] || 'I am analyzing the latest data. Please check back in a moment.';
      alert(`${role} says:\n\n"${msg}"`);
    }
    
    function viewProfile(role) {
      alert(`Viewing detailed profile for ${role}.\n\n(This feature would open a modal with bio and credentials)`);
    }
  }
}