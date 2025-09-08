/**
 * Minimal Provider Manager Test
 * Testing basic functionality without complex dependencies
 */

describe('ProviderManager - Minimal Test', () => {
  it('should be able to import ProviderManager without errors', async () => {
    let providerManagerModule: any;
    
    try {
      providerManagerModule = await import('../../../src/core/providers/ProviderManager');
    } catch (error) {
      console.error('Failed to import ProviderManager:', error);
      throw error;
    }
    
    expect(providerManagerModule).toBeDefined();
    expect(providerManagerModule.ProviderManager).toBeDefined();
    expect(providerManagerModule.providerManager).toBeDefined();
  });
  
  it('should be able to access static methods', async () => {
    const { ProviderManager } = await import('../../../src/core/providers/ProviderManager');
    
    expect(ProviderManager.getSupportedEVMNetworks).toBeDefined();
    const networks = ProviderManager.getSupportedEVMNetworks();
    expect(Array.isArray(networks)).toBe(true);
  });
});