import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: "Let's Apply - AI Internship Agent",
    version: '1.0.0',
    description:
      'AI agent to evaluate, draft, and auto-fill Internshala internship applications with zero hallucinations.',
    permissions: ['storage', 'sidePanel', 'activeTab', 'scripting'],
    host_permissions: ['*://*.internshala.com/*', 'https://api.groq.com/*'],
    action: {
      default_title: "Open Let's Apply Panel",
    },
    options_ui: {
      open_in_tab: true,
    },
  },
});
