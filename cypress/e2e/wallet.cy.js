describe('OmniCoin Wallet', () => {
    beforeEach(() => {
        // Mock wallet connection
        cy.window().then((win) => {
            win.ethereum = {
                request: cy.stub().resolves(['0x123']),
                on: cy.stub(),
                removeListener: cy.stub(),
            };
        });
    });

    describe('Standalone Wallet', () => {
        beforeEach(() => {
            cy.visit('/wallet');
        });

        it('connects wallet successfully', () => {
            cy.get('[data-testid="connect-wallet"]').click();
            cy.get('[data-testid="wallet-address"]').should('contain', '0x123');
        });

        it('switches network', () => {
            cy.get('[data-testid="network-selector"]').select('polygon');
            cy.get('[data-testid="network-selector"]').should('have.value', 'polygon');
        });

        it('displays token balance', () => {
            cy.get('[data-testid="token-balance"]').should('be.visible');
        });

        it('shows transaction history', () => {
            cy.get('[data-testid="history-tab"]').click();
            cy.get('[data-testid="transaction-list"]').should('be.visible');
        });
    });

    describe('Integrated Wallet', () => {
        beforeEach(() => {
            cy.visit('/');
            cy.get('[data-testid="wallet-tab"]').click();
        });

        it('displays wallet interface', () => {
            cy.get('[data-testid="integrated-wallet"]').should('be.visible');
        });

        it('manages tokens', () => {
            cy.get('[data-testid="tokens-tab"]').click();
            cy.get('[data-testid="token-list"]').should('be.visible');
        });

        it('handles token transfers', () => {
            cy.get('[data-testid="send-token"]').click();
            cy.get('[data-testid="transfer-form"]').should('be.visible');
        });
    });

    describe('Error Handling', () => {
        it('displays error boundary on failure', () => {
            cy.window().then((win) => {
                win.ethereum.request.rejects(new Error('Connection failed'));
            });
            cy.visit('/wallet');
            cy.get('[data-testid="error-boundary"]').should('be.visible');
        });

        it('shows loading state during operations', () => {
            cy.window().then((win) => {
                win.ethereum.request.callsFake(() => new Promise(resolve => setTimeout(resolve, 1000)));
            });
            cy.visit('/wallet');
            cy.get('[data-testid="loading-spinner"]').should('be.visible');
        });
    });

    describe('Responsive Design', () => {
        it('adapts to mobile viewport', () => {
            cy.viewport('iphone-6');
            cy.visit('/wallet');
            cy.get('[data-testid="wallet-container"]').should('have.css', 'max-width', '100vw');
        });

        it('maintains functionality on tablet', () => {
            cy.viewport('ipad-2');
            cy.visit('/wallet');
            cy.get('[data-testid="network-selector"]').should('be.visible');
        });
    });
}); 