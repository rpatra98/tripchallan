#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Directories and files to remove
const pathsToRemove = [
  'prisma',
  'app/generated/prisma',
  'node_modules/.prisma',
  'node_modules/@prisma',
  'setup-prisma.js',
  'prisma.schema',
  '.env.prisma'
];

// Files to clean up (remove Prisma imports and references)
const filesToClean = [
  'scripts/fix-logo-urls.js',
  'scripts/fix-image-paths.js',
  'scripts/verify-login.js',
  'scripts/setup-prisma.js',
  'middleware.ts',
  'app/api/session/create/route.ts'
];

console.log('🧹 Starting Prisma cleanup...');

// Remove directories and files
pathsToRemove.forEach(item => {
  const fullPath = path.join(process.cwd(), item);
  try {
    if (fs.existsSync(fullPath)) {
      if (fs.lstatSync(fullPath).isDirectory()) {
        console.log(`Removing directory: ${item}`);
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        console.log(`Removing file: ${item}`);
        fs.unlinkSync(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error removing ${item}:`, error.message);
  }
});

// Clean up files with Prisma references
filesToClean.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  try {
    if (fs.existsSync(filePath)) {
      console.log(`Cleaning up file: ${file}`);
      let content = fs.readFileSync(filePath, 'utf8');
      
      // Remove Prisma imports and references
      content = content
        .replace(/import\s*{\s*PrismaClient\s*}\s*from\s*['"]@prisma\/client['"];?/g, '')
        .replace(/const\s+prisma\s*=\s*new\s+PrismaClient\(\);?/g, '')
        .replace(/await\s+prisma\.\$disconnect\(\);?/g, '')
        .replace(/await\s+prisma\.\$connect\(\);?/g, '')
        .replace(/prisma\./g, '// TODO: Replace with Supabase client')
        .replace(/from\s*['"]@prisma\/client['"]/g, '')
        .replace(/from\s*['"]\.\.\/\.\.\/prisma\/enums['"]/g, 'from "@/lib/enums"');
      
      fs.writeFileSync(filePath, content);
    }
  } catch (error) {
    console.error(`Error cleaning up ${file}:`, error.message);
  }
});

// Remove Prisma dependencies from package.json
try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    console.log('Updating package.json...');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    // Remove Prisma-related dependencies
    const dependenciesToRemove = [
      '@prisma/client',
      'prisma',
      '@prisma/adapter-neon',
      '@prisma/adapter-planetscale',
      '@prisma/adapter-libsql',
      '@prisma/adapter-d1',
      '@prisma/adapter-pg',
      '@prisma/adapter-pg-worker'
    ];
    
    dependenciesToRemove.forEach(dep => {
      delete packageJson.dependencies[dep];
      delete packageJson.devDependencies[dep];
    });
    
    // Remove Prisma-related scripts
    const scriptsToRemove = [
      'prisma:generate',
      'prisma:migrate',
      'prisma:studio',
      'prisma:format',
      'prisma:validate',
      'prisma:db:push',
      'prisma:db:pull'
    ];
    
    scriptsToRemove.forEach(script => {
      delete packageJson.scripts[script];
    });
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }
} catch (error) {
  console.error('Error updating package.json:', error.message);
}

// Clean npm cache and node_modules
console.log('Cleaning npm cache and node_modules...');
try {
  execSync('npm cache clean --force');
  execSync('rm -rf node_modules');
  execSync('npm install');
} catch (error) {
  console.error('Error cleaning npm cache:', error.message);
}

console.log('✅ Prisma cleanup completed!');
console.log('\nNext steps:');
console.log('1. Review the changes made to your files');
console.log('2. Run "npm install" to update dependencies');
console.log('3. Test your application to ensure everything works with Supabase');
console.log('4. Remove any remaining Prisma references in your code'); 