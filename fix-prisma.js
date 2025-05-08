const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Ensure the script is run from the project root
console.log('Starting Prisma fix...');

// Clean up existing Prisma client
console.log('Cleaning up existing Prisma client...');
try {
  if (fs.existsSync('./node_modules/.prisma')) {
    execSync('rimraf ./node_modules/.prisma', { stdio: 'inherit' });
  }
  if (fs.existsSync('./node_modules/@prisma')) {
    execSync('rimraf ./node_modules/@prisma', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Error cleaning up folders:', error.message);
  // Continue anyway
}

// Reinstall @prisma/client
console.log('Reinstalling @prisma/client...');
try {
  execSync('npm install @prisma/client', { stdio: 'inherit' });
} catch (error) {
  console.error('Error reinstalling @prisma/client:', error.message);
  process.exit(1);
}

// Run prisma generate
console.log('Generating Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
} catch (error) {
  console.error('Error generating Prisma client:', error.message);
  process.exit(1);
}

console.log('Prisma fix completed successfully!');
console.log('You can now run "node add-user.js" or "npm run db:seed"'); 