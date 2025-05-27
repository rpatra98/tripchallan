#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Required directories that should exist
const REQUIRED_DIRECTORIES = [
  path.join('public', 'uploads'),
  path.join('public', 'uploads', 'logos'),
  path.join('public', 'uploads', 'documents'),
  path.join('public', 'images'),
];

/**
 * Creates all required directories for the application
 */
function ensureDirectoriesExist() {
  console.log('Checking for required directories...');
  
  const cwd = process.cwd();
  let success = true;
  
  for (const dir of REQUIRED_DIRECTORIES) {
    const fullPath = path.join(cwd, dir);
    
    try {
      if (!fs.existsSync(fullPath)) {
        console.log(`Creating directory: ${fullPath}`);
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`✅ Created: ${dir}`);
      } else {
        console.log(`✅ Already exists: ${dir}`);
      }
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error);
      success = false;
    }
  }
  
  return success;
}

// When run directly
if (require.main === module) {
  const success = ensureDirectoriesExist();
  
  if (success) {
    console.log('✅ All required directories exist or were created successfully.');
    process.exit(0);
  } else {
    console.error('❌ Some directories could not be created.');
    process.exit(1);
  }
}

module.exports = ensureDirectoriesExist; 