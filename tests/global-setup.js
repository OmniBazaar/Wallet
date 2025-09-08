/**
 * Global Setup for Blockchain and Security Testing
 * 
 * This script runs once before all tests to set up the testing environment
 * for comprehensive blockchain and security validation.
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('🔧 Setting up blockchain and security test environment...');
  
  try {
    // Create test results directory
    const testResultsDir = path.join(__dirname, '..', 'test-results');
    await fs.mkdir(testResultsDir, { recursive: true });
    
    // Create temporary test databases directory
    const tempDbDir = path.join(__dirname, 'temp-dbs');
    await fs.mkdir(tempDbDir, { recursive: true });
    
    // Set up environment variables for testing
    process.env.NODE_ENV = 'test';
    process.env.TEST_DATABASE_PATH = tempDbDir;
    process.env.TEST_ENCRYPTION_KEY = 'test-encryption-key-for-security-tests';
    process.env.DISABLE_NETWORK_REQUESTS = 'true'; // Disable real network requests
    process.env.MOCK_BLOCKCHAIN_RESPONSES = 'true';
    
    // Security testing environment variables
    process.env.ENABLE_SECURITY_AUDIT_LOGS = 'true';
    process.env.STRICT_VALIDATION_MODE = 'true';
    process.env.TEST_TIMEOUT_MS = '60000';
    
    // Performance testing variables
    process.env.PERFORMANCE_MONITORING = 'true';
    process.env.MEMORY_LEAK_DETECTION = 'true';
    
    // Create test configuration file
    const testConfig = {
      version: '1.0.0',
      environment: 'blockchain-security-testing',
      timestamp: new Date().toISOString(),
      features: {
        securityTesting: true,
        blockchainTesting: true,
        performanceTesting: true,
        integrationTesting: true
      },
      timeouts: {
        default: 60000,
        blockchain: 30000,
        security: 10000,
        performance: 120000
      },
      limits: {
        maxMemoryUsage: '1GB',
        maxTestDuration: '10m',
        maxConcurrentOperations: 100
      }
    };
    
    await fs.writeFile(
      path.join(testResultsDir, 'test-config.json'),
      JSON.stringify(testConfig, null, 2)
    );
    
    // Initialize mock blockchain data
    const mockBlockchainData = {
      networks: {
        ethereum: {
          chainId: 1,
          name: 'Ethereum Mainnet',
          rpcUrl: 'mock://ethereum-mainnet',
          blockNumber: 18000000
        },
        sepolia: {
          chainId: 11155111,
          name: 'Ethereum Sepolia',
          rpcUrl: 'mock://ethereum-sepolia',
          blockNumber: 4000000
        },
        polygon: {
          chainId: 137,
          name: 'Polygon',
          rpcUrl: 'mock://polygon-mainnet',
          blockNumber: 48000000
        },
        bitcoin: {
          network: 'mainnet',
          blockHeight: 800000
        },
        solana: {
          cluster: 'mainnet-beta',
          slot: 200000000
        }
      },
      accounts: {
        test: {
          mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
          addresses: {
            ethereum: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
            bitcoin: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
            solana: '3J98t1WpEZ73CNmQviecrnyiWrnqRhDJrYr'
          }
        }
      }
    };
    
    await fs.writeFile(
      path.join(testResultsDir, 'mock-blockchain-data.json'),
      JSON.stringify(mockBlockchainData, null, 2)
    );
    
    // Set up security test fixtures
    const securityTestData = {
      validMnemonics: [
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal will',
        'letter advice cage absurd amount doctor acoustic avoid letter advice cage absurd amount doctor acoustic avoid letter always'
      ],
      invalidMnemonics: [
        'invalid mnemonic phrase',
        'abandon abandon abandon invalid',
        '', // empty
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon' // missing word
      ],
      testPasswords: {
        weak: ['123', 'password', 'abc'],
        strong: ['StrongP@ssw0rd123!', 'MySecurePassword2024$', 'Tr0ub4dor&3']
      },
      maliciousInputs: [
        '<script>alert("xss")</script>',
        '../../etc/passwd',
        'SELECT * FROM users;',
        '${process.env.PRIVATE_KEY}',
        'javascript:alert(1)',
        'DROP TABLE users;'
      ]
    };
    
    await fs.writeFile(
      path.join(testResultsDir, 'security-test-data.json'),
      JSON.stringify(securityTestData, null, 2)
    );
    
    console.log('✅ Test environment setup complete');
    console.log(`📁 Test results directory: ${testResultsDir}`);
    console.log(`🗄️  Temporary databases: ${tempDbDir}`);
    
  } catch (error) {
    console.error('❌ Failed to set up test environment:', error);
    throw error;
  }
};