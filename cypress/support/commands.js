
// cypress/support/commands.js
Cypress.Commands.add('login', (email, password) => {
    cy.session([email, password], () => {
      cy.visit('/login');
      cy.get('[data-cy=email]').type(email);
      cy.get('[data-cy=password]').type(password);
      cy.get('[data-cy=login]').click();
      cy.url().should('include', '/dashboard');
    });
  });
  
  Cypress.Commands.add('mockAudioPermission', () => {
    cy.window().then((win) => {
      const mockMediaDevices = {
        getUserMedia: cy.stub().resolves({
          getTracks: () => [{ stop: cy.stub() }]
        })
      };
      
      win.navigator.mediaDevices = mockMediaDevices;
    });
  });
  