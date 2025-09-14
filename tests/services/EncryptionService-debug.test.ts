/**
 * Debug test for the decryption issue
 */

import { EncryptionService } from '../../src/services/EncryptionService';

describe('EncryptionService Debug', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    service = new EncryptionService();
    await service.init();
  });

  it('should fail decryption with wrong password - DEBUG', async () => {
    const testData = 'Secret information';
    const correctPassword = 'correctPassword';
    const wrongPassword = 'wrongPassword';

    console.log('=== DEBUG: Starting encryption ===');
    const encrypted = await service.encrypt(testData, correctPassword);
    console.log('Encrypted:', JSON.stringify(encrypted, null, 2));

    console.log('\n=== DEBUG: Attempting decryption with wrong password ===');
    try {
      const result = await service.decrypt(encrypted, wrongPassword);
      console.log('❌ SECURITY BUG: Decryption succeeded!');
      console.log('Result type:', typeof result);
      console.log('Result:', result);
      console.log('Result as string:', new TextDecoder().decode(result));

      // Force test to fail
      throw new Error('Decryption should have failed with wrong password!');
    } catch (error) {
      if (error.message.includes('Decryption failed')) {
        console.log('✅ Correctly threw error:', error.message);
      } else {
        console.log('❌ Unexpected error:', error.message);
        throw error;
      }
    }
  });
});