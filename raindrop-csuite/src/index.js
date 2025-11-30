import { Dashboard } from './components/Dashboard.js';
import { ExecutiveTeam } from './components/ExecutiveTeam.js';
import { TestRunner } from './components/TestRunner.js';

const routes = {
  '/': Dashboard,
  '/executives': ExecutiveTeam,
  '/tests': TestRunner
};

function navigate(path) {
  window.history.pushState({}, '', path);
  handleRoute();
}

function handleRoute() {
  const path = window.location.pathname;
  const Component = routes[path] || Dashboard;
  document.getElementById('app').innerHTML = Component.render();
  
  // Initialize component logic if available
  if (Component.setup) {
    Component.setup();
  }
  
  // Update active nav state
  document.querySelectorAll('nav button').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('onclick').includes(path)) {
      btn.classList.add('active');
    }
  });
}

window.onpopstate = handleRoute;
window.navigate = navigate; // Expose to global scope for onclick handlers

// Initial load
handleRoute();

// Application is running via handleRoute()
console.log('Virtual C-Suite is running!');