#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Verifying Prisma removal...');

// Check for remaining Prisma directories
const prismaDirs = [
  'prisma',
  'app/generated/prisma',
  'node_modules/.prisma',
  'node_modules/@prisma'
];

// Check for remaining Prisma files
const prismaFiles = [
  'setup-prisma.js',
  'prisma.schema',
  '.env.prisma'
];

// Check for Prisma references in files
const filesToCheck = [
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'middleware.ts',
  'app/api/session/create/route.ts'
];

let hasIssues = false;

// Check directories
console.log('\nChecking for Prisma directories...');
prismaDirs.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  if (fs.existsSync(fullPath)) {
    console.error(`❌ Found Prisma directory: ${dir}`);
    hasIssues = true;
  }
});

// Check files
console.log('\nChecking for Prisma files...');
prismaFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    console.error(`❌ Found Prisma file: ${file}`);
    hasIssues = true;
  }
});

// Check for Prisma references in files
console.log('\nChecking for Prisma references in files...');
filesToCheck.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const prismaReferences = [
      '@prisma/client',
      'prisma',
      'PrismaClient',
      'prisma:',
      'prisma.',
      'from "@prisma/',
      'from \'@prisma/'
    ];
    
    prismaReferences.forEach(ref => {
      if (content.includes(ref)) {
        console.error(`❌ Found Prisma reference in ${file}: ${ref}`);
        hasIssues = true;
      }
    });
  }
});

// Check for Prisma in node_modules
console.log('\nChecking node_modules for Prisma packages...');
try {
  const npmList = execSync('npm list --depth=0', { encoding: 'utf8' });
  if (npmList.includes('@prisma/client') || npmList.includes('prisma')) {
    console.error('❌ Found Prisma packages in node_modules');
    hasIssues = true;
  }
} catch (error) {
  console.error('Error checking node_modules:', error.message);
}

if (!hasIssues) {
  console.log('\n✅ No Prisma code found! The cleanup was successful.');
} else {
  console.log('\n❌ Found remaining Prisma code. Please run the cleanup script again.');
  process.exit(1);
} 