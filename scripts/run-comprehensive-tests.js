#!/usr/bin/env node

/**
 * Comprehensive Blockchain Platform and Security Test Runner
 * 
 * This script runs all comprehensive tests for the wallet system including:
 * - Multi-blockchain platform testing
 * - Security infrastructure validation
 * - Financial operations security
 * - Edge case and error handling
 * - Performance and stress testing
 * - Integration validation
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log(`
🚀 OmniWallet Comprehensive Test Suite
=====================================

Running blockchain platform and security validation tests...
This may take several minutes to complete.
`);

const testSuites = [
  {
    name: 'Multi-Blockchain Platform Tests',
    path: 'tests/blockchain/multi-blockchain-platform.test.ts',
    description: 'Testing blockchain integrations and cross-chain operations',
    critical: true
  },
  {
    name: 'Security Infrastructure Tests',
    path: 'tests/security/security-infrastructure.test.ts',
    description: 'Validating cryptographic security and keyring protection',
    critical: true
  },
  {
    name: 'Financial Operations Security Tests',
    path: 'tests/security/financial-operations-security.test.ts',
    description: 'Testing transaction security and fund protection',
    critical: true
  },
  {
    name: 'Edge Cases and Error Handling Tests',
    path: 'tests/error-handling/edge-cases-errors.test.ts',
    description: 'Validating resilience under adverse conditions',
    critical: false
  },
  {
    name: 'Performance and Stress Tests',
    path: 'tests/performance/stress-testing.test.ts',
    description: 'Testing scalability and resource management',
    critical: false
  },
  {
    name: 'Comprehensive Integration Tests',
    path: 'tests/integration/comprehensive-validation.test.ts',
    description: 'End-to-end system validation and integration',
    critical: true
  }
];

async function runTestSuite(suite) {
  console.log(`\n🔬 Running: ${suite.name}`);
  console.log(`📝 ${suite.description}`);
  console.log(`${suite.critical ? '🚨 CRITICAL' : '⚡ PERFORMANCE'} test suite\n`);

  const startTime = Date.now();
  
  try {
    const result = execSync(
      `npx jest --config=tests/jest.blockchain-security.config.js --testPathPattern="${suite.path}" --verbose`,
      { 
        stdio: 'inherit',
        cwd: process.cwd(),
        timeout: 300000 // 5 minute timeout per suite
      }
    );
    
    const duration = Date.now() - startTime;
    console.log(`✅ ${suite.name} completed in ${(duration / 1000).toFixed(1)}s\n`);
    
    return { success: true, duration, suite: suite.name };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ${suite.name} failed after ${(duration / 1000).toFixed(1)}s`);
    console.log(`Error: ${error.message}\n`);
    
    return { success: false, duration, suite: suite.name, error: error.message };
  }
}

async function generateTestReport(results) {
  const reportData = {
    timestamp: new Date().toISOString(),
    totalSuites: results.length,
    passedSuites: results.filter(r => r.success).length,
    failedSuites: results.filter(r => !r.success).length,
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
    results: results,
    summary: {
      criticalTestsPassed: results
        .filter(r => testSuites.find(s => s.name === r.suite)?.critical)
        .every(r => r.success),
      performanceTestsPassed: results
        .filter(r => !testSuites.find(s => s.name === r.suite)?.critical)
        .every(r => r.success),
      overallStatus: results.every(r => r.success) ? 'PASSED' : 'FAILED'
    }
  };

  // Ensure test-results directory exists
  const testResultsDir = path.join(process.cwd(), 'test-results');
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }

  // Write detailed report
  const reportPath = path.join(testResultsDir, 'comprehensive-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

  return { reportData, reportPath };
}

function printSummary(reportData) {
  console.log(`
📊 TEST EXECUTION SUMMARY
========================

Total Test Suites: ${reportData.totalSuites}
✅ Passed: ${reportData.passedSuites}
❌ Failed: ${reportData.failedSuites}
⏱️  Total Duration: ${(reportData.totalDuration / 1000).toFixed(1)}s

🔒 Critical Security Tests: ${reportData.summary.criticalTestsPassed ? '✅ PASSED' : '❌ FAILED'}
⚡ Performance Tests: ${reportData.summary.performanceTestsPassed ? '✅ PASSED' : '❌ FAILED'}

Overall Status: ${reportData.summary.overallStatus === 'PASSED' ? '🎉 ALL TESTS PASSED' : '🚨 TESTS FAILED'}
`);

  if (reportData.summary.overallStatus === 'FAILED') {
    console.log('❌ FAILED TEST SUITES:');
    reportData.results
      .filter(r => !r.success)
      .forEach(r => {
        const suite = testSuites.find(s => s.name === r.suite);
        console.log(`   • ${r.suite} ${suite?.critical ? '(CRITICAL)' : '(PERFORMANCE)'}`);
        if (r.error) {
          console.log(`     Error: ${r.error.slice(0, 100)}...`);
        }
      });
  }

  console.log(`\n📄 Detailed report saved to: test-results/comprehensive-test-report.json`);
}

async function main() {
  const startTime = Date.now();
  const results = [];

  // Check if required dependencies are installed
  try {
    execSync('npx jest --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Jest is not installed. Please run: npm install --save-dev jest');
    process.exit(1);
  }

  console.log('🔧 Initializing test environment...\n');

  // Run each test suite
  for (const suite of testSuites) {
    const result = await runTestSuite(suite);
    results.push(result);

    // If a critical test fails, consider stopping (but continue for now)
    if (!result.success && suite.critical) {
      console.log(`⚠️  Critical test suite failed: ${suite.name}`);
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log(`\n🏁 All test suites completed in ${(totalDuration / 1000).toFixed(1)}s`);

  // Generate and display report
  const { reportData, reportPath } = await generateTestReport(results);
  printSummary(reportData);

  // Exit with appropriate code
  const exitCode = reportData.summary.overallStatus === 'PASSED' ? 0 : 1;
  
  if (exitCode === 0) {
    console.log('\n🎉 Comprehensive testing completed successfully!');
    console.log('✅ The wallet system is validated for production use.');
  } else {
    console.log('\n🚨 Testing completed with failures!');
    console.log('❌ Review failed tests before deploying to production.');
  }

  process.exit(exitCode);
}

// Handle script interruption
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Test execution interrupted by user');
  console.log('🧹 Cleaning up...');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Test execution terminated');
  process.exit(143);
});

// Run the main function
main().catch((error) => {
  console.error('\n❌ Fatal error running tests:', error);
  process.exit(1);
});