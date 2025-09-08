#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * Comprehensive test runner for wallet integration and end-to-end tests.
 * Provides detailed reporting and handles complex test scenarios.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class IntegrationTestRunner {
  constructor() {
    this.testSuites = [
      {
        name: 'End-to-End Wallet Workflows',
        path: 'tests/e2e/wallet-workflows.test.ts',
        timeout: 120000,
        critical: true
      },
      {
        name: 'Service Integration Tests',
        path: 'tests/integration/service-integration.test.ts',
        timeout: 90000,
        critical: true
      },
      {
        name: 'Database Integration Tests',
        path: 'tests/integration/database.test.ts',
        timeout: 60000,
        critical: true
      },
      {
        name: 'Browser Extension Integration',
        path: 'tests/integration/browser-extension.test.ts',
        timeout: 75000,
        critical: false
      },
      {
        name: 'Real-World Scenarios',
        path: 'tests/integration/real-world-scenarios.test.ts',
        timeout: 180000,
        critical: false
      },
      {
        name: 'Multi-Chain Operations',
        path: 'tests/integration/multi-chain-operations.test.ts',
        timeout: 90000,
        critical: true
      },
      {
        name: 'Cross-Chain Validation',
        path: 'tests/integration/cross-chain-validation.test.ts',
        timeout: 120000,
        critical: false
      }
    ];
    
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      suites: {}
    };
    
    this.startTime = Date.now();
  }

  async runAllTests() {
    console.log('🚀 Starting Wallet Integration Test Suite');
    console.log('=========================================');
    console.log(`Total test suites: ${this.testSuites.length}`);
    console.log(`Start time: ${new Date().toISOString()}\n`);

    // Check prerequisites
    await this.checkPrerequisites();

    // Run critical tests first
    const criticalSuites = this.testSuites.filter(suite => suite.critical);
    const nonCriticalSuites = this.testSuites.filter(suite => !suite.critical);

    console.log('📋 Running Critical Test Suites First...\n');
    await this.runTestSuites(criticalSuites);

    if (this.results.failed === 0) {
      console.log('✅ All critical tests passed. Running non-critical tests...\n');
      await this.runTestSuites(nonCriticalSuites);
    } else {
      console.log('❌ Critical tests failed. Skipping non-critical tests.\n');
      nonCriticalSuites.forEach(suite => {
        this.results.skipped++;
        this.results.suites[suite.name] = { status: 'skipped', reason: 'Critical tests failed' };
      });
    }

    await this.generateReport();
  }

  async runTestSuites(suites) {
    for (const suite of suites) {
      await this.runSingleSuite(suite);
    }
  }

  async runSingleSuite(suite) {
    console.log(`🧪 Running: ${suite.name}`);
    console.log(`   Path: ${suite.path}`);
    console.log(`   Timeout: ${suite.timeout}ms`);
    
    const startTime = Date.now();
    
    try {
      const result = await this.executeJest(suite);
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ ${suite.name} - PASSED (${duration}ms)`);
        this.results.passed++;
        this.results.suites[suite.name] = {
          status: 'passed',
          duration,
          tests: result.tests,
          coverage: result.coverage
        };
      } else {
        console.log(`❌ ${suite.name} - FAILED (${duration}ms)`);
        console.log(`   Error: ${result.error}`);
        this.results.failed++;
        this.results.suites[suite.name] = {
          status: 'failed',
          duration,
          error: result.error,
          tests: result.tests
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`💥 ${suite.name} - ERROR (${duration}ms)`);
      console.log(`   Error: ${error.message}`);
      this.results.failed++;
      this.results.suites[suite.name] = {
        status: 'error',
        duration,
        error: error.message
      };
    }

    console.log(''); // Empty line for spacing
    this.results.total++;
  }

  async executeJest(suite) {
    return new Promise((resolve, reject) => {
      const jestArgs = [
        suite.path,
        '--testTimeout', suite.timeout.toString(),
        '--verbose',
        '--collectCoverage',
        '--coverageDirectory', `coverage/${suite.name.replace(/\s+/g, '-').toLowerCase()}`,
        '--json'
      ];

      const jest = spawn('npx', ['jest', ...jestArgs], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jest.on('close', (code) => {
        try {
          // Try to parse Jest JSON output
          const jsonOutput = this.extractJestJson(stdout);
          
          resolve({
            success: code === 0,
            error: code !== 0 ? stderr || 'Unknown error' : null,
            tests: jsonOutput?.testResults || [],
            coverage: jsonOutput?.coverageMap || null
          });
        } catch (error) {
          resolve({
            success: code === 0,
            error: code !== 0 ? stderr || error.message : null,
            tests: []
          });
        }
      });

      jest.on('error', (error) => {
        reject(error);
      });

      // Set a hard timeout
      const timeout = setTimeout(() => {
        jest.kill('SIGKILL');
        reject(new Error(`Test suite timed out after ${suite.timeout}ms`));
      }, suite.timeout + 10000); // Add 10s buffer

      jest.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  extractJestJson(output) {
    // Jest outputs JSON at the end when --json flag is used
    const lines = output.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.includes('testResults')) {
        try {
          return JSON.parse(line);
        } catch (e) {
          continue;
        }
      }
    }
    return null;
  }

  async checkPrerequisites() {
    console.log('🔍 Checking Prerequisites...');
    
    // Check if Jest is installed
    try {
      const { spawn } = require('child_process');
      await new Promise((resolve, reject) => {
        const jest = spawn('npx', ['jest', '--version'], { stdio: 'pipe' });
        jest.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Jest is available');
            resolve();
          } else {
            reject(new Error('Jest not found'));
          }
        });
      });
    } catch (error) {
      console.log('❌ Jest not available:', error.message);
      process.exit(1);
    }

    // Check if test files exist
    let missingFiles = 0;
    for (const suite of this.testSuites) {
      if (!fs.existsSync(suite.path)) {
        console.log(`❌ Test file missing: ${suite.path}`);
        missingFiles++;
      }
    }

    if (missingFiles > 0) {
      console.log(`❌ ${missingFiles} test files are missing`);
      process.exit(1);
    }

    console.log('✅ All prerequisites met\n');
  }

  async generateReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    console.log('📊 Integration Test Results');
    console.log('==========================');
    console.log(`Total Duration: ${Math.round(totalDuration / 1000)}s`);
    console.log(`Total Suites: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed} ✅`);
    console.log(`Failed: ${this.results.failed} ❌`);
    console.log(`Skipped: ${this.results.skipped} ⏭️`);
    
    const successRate = this.results.total > 0 
      ? Math.round((this.results.passed / this.results.total) * 100)
      : 0;
    console.log(`Success Rate: ${successRate}%`);
    console.log('');

    // Detailed results
    console.log('📋 Detailed Results:');
    console.log('--------------------');
    
    Object.entries(this.results.suites).forEach(([suiteName, result]) => {
      const status = result.status === 'passed' ? '✅' 
                   : result.status === 'failed' ? '❌'
                   : result.status === 'skipped' ? '⏭️'
                   : '💥';
      
      console.log(`${status} ${suiteName}`);
      if (result.duration) {
        console.log(`   Duration: ${Math.round(result.duration / 1000)}s`);
      }
      if (result.tests && result.tests.length > 0) {
        const testsPassed = result.tests.filter(t => t.status === 'passed').length;
        console.log(`   Tests: ${testsPassed}/${result.tests.length} passed`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error.split('\n')[0]}`);
      }
      if (result.reason) {
        console.log(`   Reason: ${result.reason}`);
      }
      console.log('');
    });

    // Generate JSON report
    const report = {
      summary: {
        startTime: this.startTime,
        endTime,
        duration: totalDuration,
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        skipped: this.results.skipped,
        successRate
      },
      suites: this.results.suites,
      environment: {
        node: process.version,
        platform: process.platform,
        cwd: process.cwd()
      }
    };

    // Save report
    const reportDir = 'test-reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportFile = path.join(reportDir, `integration-test-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`📄 Report saved: ${reportFile}`);

    // Generate HTML report if possible
    try {
      await this.generateHtmlReport(report, reportDir);
    } catch (error) {
      console.log(`⚠️  Could not generate HTML report: ${error.message}`);
    }

    // Exit with appropriate code
    if (this.results.failed > 0) {
      console.log('\n❌ Some tests failed. Check the results above.');
      process.exit(1);
    } else if (this.results.passed === 0) {
      console.log('\n⚠️  No tests were run successfully.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed successfully!');
      console.log('\n🚀 Wallet module is ready for production!');
      process.exit(0);
    }
  }

  async generateHtmlReport(report, reportDir) {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wallet Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 5px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #6c757d; margin-top: 5px; }
        .suite { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
        .suite-header { padding: 15px; background: #f8f9fa; border-bottom: 1px solid #ddd; }
        .suite-body { padding: 15px; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .status-skipped { color: #ffc107; }
        .status-error { color: #6f42c1; }
        .progress-bar { width: 100%; height: 20px; background: #e9ecef; border-radius: 10px; overflow: hidden; margin: 10px 0; }
        .progress-fill { height: 100%; transition: width 0.3s ease; }
        .progress-success { background: #28a745; }
        .progress-danger { background: #dc3545; }
        .footer { text-align: center; margin-top: 30px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Wallet Integration Test Report</h1>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <div class="metric">
                <div class="metric-value">${report.summary.total}</div>
                <div class="metric-label">Total Suites</div>
            </div>
            <div class="metric">
                <div class="metric-value status-passed">${report.summary.passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value status-failed">${report.summary.failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value status-skipped">${report.summary.skipped}</div>
                <div class="metric-label">Skipped</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.successRate}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${Math.round(report.summary.duration / 1000)}s</div>
                <div class="metric-label">Duration</div>
            </div>
        </div>

        <div class="progress-bar">
            <div class="progress-fill ${report.summary.successRate >= 80 ? 'progress-success' : 'progress-danger'}" 
                 style="width: ${report.summary.successRate}%"></div>
        </div>

        <h2>Test Suite Details</h2>
        ${Object.entries(report.suites).map(([suiteName, result]) => `
        <div class="suite">
            <div class="suite-header">
                <h3 class="status-${result.status}">
                    ${result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : result.status === 'skipped' ? '⏭️' : '💥'} 
                    ${suiteName}
                </h3>
            </div>
            <div class="suite-body">
                ${result.duration ? `<p><strong>Duration:</strong> ${Math.round(result.duration / 1000)}s</p>` : ''}
                ${result.tests ? `<p><strong>Tests:</strong> ${result.tests.filter(t => t.status === 'passed').length}/${result.tests.length} passed</p>` : ''}
                ${result.error ? `<p><strong>Error:</strong> <code>${result.error}</code></p>` : ''}
                ${result.reason ? `<p><strong>Reason:</strong> ${result.reason}</p>` : ''}
            </div>
        </div>
        `).join('')}

        <div class="footer">
            <p>Report generated by OmniBazaar Wallet Integration Test Runner</p>
            <p>Node.js ${report.environment.node} | ${report.environment.platform}</p>
        </div>
    </div>
</body>
</html>`;

    const htmlFile = path.join(reportDir, `integration-test-report-${Date.now()}.html`);
    fs.writeFileSync(htmlFile, htmlContent);
    console.log(`📄 HTML report saved: ${htmlFile}`);
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.runAllTests().catch(error => {
    console.error('💥 Test runner failed:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTestRunner;