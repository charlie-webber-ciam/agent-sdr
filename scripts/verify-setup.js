#!/usr/bin/env node

/**
 * Setup Verification Script
 * Checks if the Auth0 SDR Research Agent is properly configured
 */

const { existsSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

console.log('\nAuth0 SDR Research Agent - Setup Verification');
console.log('='.repeat(50));
console.log('');

let allChecksPassed = true;

function checkPass(message) {
  console.log(`✓ ${message}`);
}

function checkFail(message) {
  console.log(`✗ ${message}`);
  allChecksPassed = false;
}

function checkWarn(message) {
  console.log(`⚠ ${message}`);
}

// Check 1: Node.js version
try {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.split('.')[0].substring(1));

  if (majorVersion >= 18) {
    checkPass(`Node.js version: ${nodeVersion} (OK)`);
  } else {
    checkFail(`Node.js version: ${nodeVersion} (Need 18+ or 20+)`);
  }
} catch (error) {
  checkFail('Could not determine Node.js version');
}

// Check 2: npm version
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf-8' }).trim();
  const majorVersion = parseInt(npmVersion.split('.')[0]);

  if (majorVersion >= 9) {
    checkPass(`npm version: ${npmVersion} (OK)`);
  } else {
    checkWarn(`npm version: ${npmVersion} (Recommended: 9+)`);
  }
} catch (error) {
  checkFail('npm not found or not accessible');
}

// Check 3: Dependencies installed
const nodeModulesPath = join(process.cwd(), 'node_modules');
if (existsSync(nodeModulesPath)) {
  checkPass('Dependencies installed');
} else {
  checkFail('Dependencies not installed (run: npm install)');
}

// Check 4: Environment file
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  checkPass('Environment file exists (.env.local)');

  // Check 5: OpenAI API key
  try {
    require('dotenv').config({ path: envPath });

    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      const key = process.env.OPENAI_API_KEY;
      const maskedKey = key.substring(0, 8) + '...' + key.substring(key.length - 4);
      checkPass(`OpenAI API key configured (${maskedKey})`);

      // Validate key format
      if (key.startsWith('sk-')) {
        checkPass('API key format valid');
      } else {
        checkWarn('API key format unusual (should start with sk-)');
      }
    } else {
      checkFail('OpenAI API key not configured in .env.local');
    }
  } catch (error) {
    checkWarn('Could not verify API key (dotenv not installed yet)');
  }
} else {
  checkFail('Environment file not found (run: cp .env.example .env.local)');
}

// Check 6: Data directory
const dataDir = join(process.cwd(), 'data');
if (existsSync(dataDir)) {
  checkPass('Data directory exists');
} else {
  checkWarn('Data directory not found (will be created on first run)');
}

// Check 7: Database file
const dbPath = join(dataDir, 'accounts.db');
if (existsSync(dbPath)) {
  checkPass('Database file exists');
} else {
  checkWarn('Database not initialized yet (will be created on first run)');
}

// Check 8: Required packages
const requiredPackages = [
  'next',
  '@openai/agents',
  'better-sqlite3',
  'csv-parse',
];

let missingPackages = [];
requiredPackages.forEach(pkg => {
  try {
    require.resolve(pkg);
  } catch (error) {
    missingPackages.push(pkg);
  }
});

if (missingPackages.length === 0) {
  checkPass('All required packages available');
} else {
  checkFail(`Missing packages: ${missingPackages.join(', ')}`);
}

// Check 9: Key files exist
const requiredFiles = [
  'package.json',
  'next.config.ts',
  'app/page.tsx',
  'lib/db.ts',
  'lib/schema.sql',
];

let missingFiles = [];
requiredFiles.forEach(file => {
  if (!existsSync(join(process.cwd(), file))) {
    missingFiles.push(file);
  }
});

if (missingFiles.length === 0) {
  checkPass('All required files present');
} else {
  checkFail(`Missing files: ${missingFiles.join(', ')}`);
}

// Check 10: Port availability (optional)
try {
  const net = require('net');
  const server = net.createServer();

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      checkWarn('Port 3000 already in use (use PORT=3001 npm run dev)');
    }
  });

  server.once('listening', () => {
    checkPass('Port 3000 available');
    server.close();
  });

  server.listen(3000, '127.0.0.1');
} catch (error) {
  checkWarn('Could not check port availability');
}

// Summary
console.log('');
console.log('='.repeat(50));

if (allChecksPassed) {
  console.log('✓ All checks passed!\n');
  console.log('You\'re ready to start the application with: npm run dev');
  console.log('Then open: http://localhost:3000\n');
  process.exit(0);
} else {
  console.log('✗ Some checks failed\n');
  console.log('Please fix the issues above and run this script again.');
  console.log('For help, see SETUP_GUIDE.md or TROUBLESHOOTING.md\n');
  process.exit(1);
}
