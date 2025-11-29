// Virtual C-Suite - Main Entry Point
import { App } from '@raindrop/core';
import { Router } from '@raindrop/router';
import { Dashboard } from './components/Dashboard';
import { ExecutiveTeam } from './components/ExecutiveTeam';

const app = new App({
  name: 'Virtual C-Suite',
  version: '1.0.0'
});

const router = new Router();

// Define routes
router.get('/', () => {
  return Dashboard.render();
});

router.get('/executives', () => {
  return ExecutiveTeam.render();
});

app.use(router);

// Start the application
app.start().then(() => {
  console.log('Virtual C-Suite is running!');
}).catch(error => {
  console.error('Failed to start application:', error);
});

export { app };