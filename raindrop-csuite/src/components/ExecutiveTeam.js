// Executive Team Component
export class ExecutiveTeam {
  static render() {
    return `
      <div class="executive-team">
        <header>
          <h1>Executive Team</h1>
          <p>Meet your virtual C-Suite</p>
        </header>
        
        <main>
          <section class="team-grid">
            <div class="executive-card">
              <div class="executive-avatar">CEO</div>
              <h3>Chief Executive Officer</h3>
              <p>Strategic vision and company leadership</p>
              <div class="executive-actions">
                <button onclick="consultWith('CEO')">Consult</button>
                <button onclick="viewProfile('CEO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">CFO</div>
              <h3>Chief Financial Officer</h3>
              <p>Financial planning and risk management</p>
              <div class="executive-actions">
                <button onclick="consultWith('CFO')">Consult</button>
                <button onclick="viewProfile('CFO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">CTO</div>
              <h3>Chief Technology Officer</h3>
              <p>Technology strategy and innovation</p>
              <div class="executive-actions">
                <button onclick="consultWith('CTO')">Consult</button>
                <button onclick="viewProfile('CTO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">CMO</div>
              <h3>Chief Marketing Officer</h3>
              <p>Marketing strategy and brand development</p>
              <div class="executive-actions">
                <button onclick="consultWith('CMO')">Consult</button>
                <button onclick="viewProfile('CMO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">COO</div>
              <h3>Chief Operating Officer</h3>
              <p>Operations and business efficiency</p>
              <div class="executive-actions">
                <button onclick="consultWith('COO')">Consult</button>
                <button onclick="viewProfile('COO')">Profile</button>
              </div>
            </div>
            
            <div class="executive-card">
              <div class="executive-avatar">CHRO</div>
              <h3>Chief HR Officer</h3>
              <p>Human resources and talent management</p>
              <div class="executive-actions">
                <button onclick="consultWith('CHRO')">Consult</button>
                <button onclick="viewProfile('CHRO')">Profile</button>
              </div>
            </div>
          </section>
          
          <section class="team-overview">
            <h2>Team Capabilities</h2>
            <ul>
              <li>Strategic planning and decision support</li>
              <li>Financial analysis and budget optimization</li>
              <li>Technology roadmap and digital transformation</li>
              <li>Marketing campaigns and customer acquisition</li>
              <li>Operational efficiency and process improvement</li>
              <li>Talent management and organizational development</li>
            </ul>
          </section>
        </main>
      </div>
    `;
  }
}