// cypress/e2e/auth.cy.js
describe('Authentication Flow', () => {
    beforeEach(() => {
      cy.visit('/');
    });
  
    it('allows user to register', () => {
      cy.get('[data-cy=get-started]').click();
      cy.url().should('include', '/register');
      
      // Fill out registration form
      cy.get('[data-cy=first-name]').type('John');
      cy.get('[data-cy=email]').type('john@example.com');
      cy.get('[data-cy=submit-email]').click();
      
      // Should progress to verification
      cy.contains('We sent a 6-digit code').should('be.visible');
      
      // Fill verification code
      cy.get('[data-cy=verification-code]').type('123456');
      cy.get('[data-cy=verify-code]').click();
      
      // Should progress to profile setup
      cy.contains('Set Up Your Practice Profile').should('be.visible');
      
      // Complete profile
      cy.get('[data-cy=job-title]').select('CEO (Chief Executive Officer)');
      cy.get('[data-cy=industry]').select('Information Technology & Services');
      cy.get('[data-cy=complete-registration]').click();
      
      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
    });
  
    it('allows user to login', () => {
      cy.get('[data-cy=sign-in]').click();
      cy.url().should('include', '/login');
      
      cy.get('[data-cy=email]').type('john@example.com');
      cy.get('[data-cy=password]').type('password123');
      cy.get('[data-cy=login]').click();
      
      cy.url().should('include', '/dashboard');
    });
  });