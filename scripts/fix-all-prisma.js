#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Starting to replace Prisma client imports with Supabase...');

// Define the paths to search in
const searchPaths = [
  './app',
  './components',
  './lib',
];

// Function to find all TypeScript/JavaScript files in a directory recursively
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (
      file.endsWith('.ts') || 
      file.endsWith('.tsx') || 
      file.endsWith('.js') || 
      file.endsWith('.jsx')
    ) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Process each file and replace the Prisma imports and usage
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if the file contains Prisma imports or references
    if (
      content.includes('@/lib/prisma') || 
      content.includes('@prisma/client') ||
      content.includes('prisma.')
    ) {
      console.log(`Processing ${filePath}`);
      
      let updatedContent = content;
      
      // Replace prisma client import
      updatedContent = updatedContent.replace(
        /import\s+(?:prisma|client|db|\{\s*prisma\s*\}|\{\s*PrismaClient\s*\})\s+from\s+["']@\/lib\/prisma["'];?/g,
        'import { supabase } from "@/lib/supabase";'
      );
      
      // Replace Prisma types import
      updatedContent = updatedContent.replace(
        /import\s+\{\s*Prisma(?:,\s*[^}]+)?\s*\}\s+from\s+["']@prisma\/client["'];?/g,
        '// Supabase types are used instead of Prisma types'
      );
      
      // Replace common Prisma client patterns with Supabase equivalents
      // findUnique -> select().eq().single()
      updatedContent = updatedContent.replace(
        /prisma\.(\w+)\.findUnique\(\s*\{\s*where:\s*\{\s*([^:]+):\s*([^,\s}]+)[^}]*\}\s*[^}]*\}\s*\)/g, 
        'supabase.from(\'$1s\').select(\'*\').eq(\'$2\', $3).single()'
      );
      
      // findMany -> select()
      updatedContent = updatedContent.replace(
        /prisma\.(\w+)\.findMany\(/g, 
        'supabase.from(\'$1s\').select(\'*\').'
      );
      
      // create -> insert()
      updatedContent = updatedContent.replace(
        /prisma\.(\w+)\.create\(\s*\{\s*data:/g, 
        'supabase.from(\'$1s\').insert('
      );
      
      // update -> update()
      updatedContent = updatedContent.replace(
        /prisma\.(\w+)\.update\(\s*\{\s*where:\s*\{\s*([^:]+):\s*([^,\s}]+)[^}]*\}\s*,\s*data:/g, 
        'supabase.from(\'$1s\').update('
      );
      
      // delete -> delete()
      updatedContent = updatedContent.replace(
        /prisma\.(\w+)\.delete\(\s*\{\s*where:\s*\{\s*([^:]+):\s*([^,\s}]+)[^}]*\}\s*\}\s*\)/g, 
        'supabase.from(\'$1s\').delete().eq(\'$2\', $3)'
      );
      
      // Simple table name conversions (handle more complex ones manually)
      updatedContent = updatedContent.replace(/prisma\.(user|company|session|vehicle|seal|activityLog|coinTransaction|operatorPermission)/g, 
        (match, tableName) => {
          // Convert PascalCase or camelCase to snake_case for Supabase tables
          const snakeCaseTable = tableName
            .replace(/([A-Z])/g, '_$1')
            .toLowerCase()
            .replace(/^_/, '');
          
          return `supabase.from('${snakeCaseTable}s')`;
        }
      );
      
      // Write the updated content back to the file if changes were made
      if (content !== updatedContent) {
        fs.writeFileSync(filePath, updatedContent, 'utf8');
        console.log(`✅ Updated ${filePath}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
    return false;
  }
}

// Main execution
let totalFiles = 0;
let updatedFiles = 0;

searchPaths.forEach(searchPath => {
  console.log(`Searching in ${searchPath}...`);
  const files = findFiles(searchPath);
  totalFiles += files.length;
  
  files.forEach(file => {
    const wasUpdated = processFile(file);
    if (wasUpdated) {
      updatedFiles++;
    }
  });
});

console.log(`\n🎉 Finished updating ${updatedFiles} out of ${totalFiles} files.`);
console.log('Prisma client usage has been converted to Supabase where possible.'); 