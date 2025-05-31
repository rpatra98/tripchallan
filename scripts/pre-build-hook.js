#!/usr/bin/env node

console.log('🔄 Running pre-build hook to ensure all Prisma/Neon code is removed...');

// Import required modules
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Function to run a script and handle errors
function runScript(scriptPath) {
  try {
    console.log(`Running script: ${scriptPath}`);
    require(scriptPath);
    console.log(`✅ Successfully ran ${scriptPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error running ${scriptPath}:`, error);
    return false;
  }
}

// List of scripts to run in order
const scripts = [
  './setup-exec-function.js',
  './fix-columns.js',
  './fix-superadmin.js',
  './fix-foreign-keys.js',
  './fix-all-enums.js',
  './fix-all-prisma.js',
  './run-coin-transaction-fix.js'
];

// Run the scripts if they exist
let success = true;

for (const scriptName of scripts) {
  const scriptPath = path.join(__dirname, scriptName);
  
  if (fs.existsSync(scriptPath)) {
    const result = runScript(scriptPath);
    if (!result) {
      console.warn(`⚠️ Warning: Script ${scriptName} failed, but continuing with build process.`);
      // We don't set success = false because we want to continue the build even if a script fails
    }
  } else {
    console.warn(`⚠️ Warning: Script ${scriptName} not found, skipping.`);
  }
}

console.log('✅ Pre-build hook completed.');
process.exit(success ? 0 : 1); 