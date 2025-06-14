module.exports = {
  extends: [
    'react-app',
    'react-app/jest'
  ],
  rules: {
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': 'off',
    'no-unused-vars': 'warn',
    'jsx-a11y/anchor-is-valid': 'warn',
    'import/no-anonymous-default-export': 'warn',
    'no-restricted-globals': 'off' // Allow 'self' in service workers
  },
  env: {
    browser: true,
    es6: true,
    node: true,
    serviceworker: true // Add service worker environment
  },
  overrides: [
    {
      files: ['**/serviceWorker.js', '**/sw.js'],
      env: {
        serviceworker: true
      },
      rules: {
        'no-restricted-globals': 'off'
      }
    }
  ]
};