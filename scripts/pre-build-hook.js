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

// Get the absolute path to our scripts
const scriptsDir = path.join(process.cwd(), 'scripts');
const fixEnumsScript = path.join(scriptsDir, 'fix-all-enums.js');
const fixPrismaScript = path.join(scriptsDir, 'fix-all-prisma.js');

// Check if the scripts exist
const fixEnumsExists = fs.existsSync(fixEnumsScript);
const fixPrismaExists = fs.existsSync(fixPrismaScript);

// Run the scripts if they exist
let success = true;

if (fixEnumsExists) {
  success = runScript('./fix-all-enums.js') && success;
} else {
  console.error(`❌ Error: ${fixEnumsScript} does not exist!`);
  success = false;
}

if (fixPrismaExists) {
  success = runScript('./fix-all-prisma.js') && success;
} else {
  console.error(`❌ Error: ${fixPrismaScript} does not exist!`);
  success = false;
}

// Direct search and replace as a fallback
console.log('📍 Performing direct search and replace as fallback...');

// Search for all files with @/prisma/enums imports
try {
  // Find all TypeScript and JavaScript files
  const findCmd = 'find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | grep -v "node_modules"';
  const files = execSync(findCmd, { encoding: 'utf-8' })
    .trim()
    .split('\n')
    .filter(Boolean);

  let updatedCount = 0;

  // Process each file
  files.forEach(filePath => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Replace @/prisma/enums with @/lib/enums
      if (content.includes('@/prisma/enums')) {
        const updatedContent = content.replace(/@\/prisma\/enums/g, '@/lib/enums');
        fs.writeFileSync(filePath, updatedContent, 'utf-8');
        console.log(`✅ Updated imports in ${filePath}`);
        updatedCount++;
      }
      
      // Replace Prisma imports
      if (content.includes('@/lib/prisma')) {
        const updatedContent = content.replace(
          /import\s+(?:prisma|client|db|\{\s*prisma\s*\}|\{\s*PrismaClient\s*\})\s+from\s+["']@\/lib\/prisma["'];?/g,
          'import { supabase } from "@/lib/supabase";'
        );
        
        if (content !== updatedContent) {
          fs.writeFileSync(filePath, updatedContent, 'utf-8');
          console.log(`✅ Updated Prisma imports in ${filePath}`);
          updatedCount++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error);
    }
  });
  
  console.log(`📊 Updated ${updatedCount} files with direct replacements.`);
} catch (error) {
  console.error('❌ Error performing direct replacements:', error);
}

console.log('🏁 Pre-build hook completed.');

// Exit with appropriate code
process.exit(success ? 0 : 1); 