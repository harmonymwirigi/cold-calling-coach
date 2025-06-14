
  // cypress.config.js
  const { defineConfig } = require('cypress');
  
  module.exports = defineConfig({
    e2e: {
      baseUrl: 'http://localhost:3000',
      viewportWidth: 1280,
      viewportHeight: 720,
      video: false,
      screenshotOnRunFailure: true,
      setupNodeEvents(on, config) {
        // implement node event listeners here
      },
    },
    component: {
      devServer: {
        framework: 'create-react-app',
        bundler: 'webpack',
      },
    },
  });