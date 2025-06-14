// cypress/e2e/roleplay.cy.js
describe('Roleplay Flow', () => {
    beforeEach(() => {
      // Setup authenticated user
      cy.login('john@example.com', 'password123');
      cy.visit('/dashboard');
    });
  
    it('allows user to start practice mode', () => {
      cy.get('[data-cy=roleplay-1-practice]').click();
      
      // Should navigate to roleplay interface
      cy.url().should('include', '/roleplay/opener/practice');
      cy.contains('Cold Call Practice').should('be.visible');
      
      // Should start call automatically
      cy.contains('Connecting to prospect', { timeout: 5000 }).should('be.visible');
      cy.contains('Connected', { timeout: 10000 }).should('be.visible');
    });
  
    it('completes a full practice call', () => {
      cy.get('[data-cy=roleplay-1-practice]').click();
      
      // Wait for call to connect
      cy.contains('Connected', { timeout: 10000 }).should('be.visible');
      
      // Simulate voice input (in real test, would need to mock audio)
      cy.get('[data-cy=voice-input]').click();
      
      // Mock a successful response
      cy.window().then((win) => {
        win.mockCallResult = { passed: true, score: 3.5 };
      });
      
      // Should show feedback
      cy.contains('Call Passed', { timeout: 15000 }).should('be.visible');
    });
  });