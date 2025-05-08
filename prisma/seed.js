// JavaScript version of seed.ts for easier execution in Vercel build
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

// Log environment for debugging
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Starting database seeding process...');

// Initialize Prisma client more safely
const initPrisma = () => {
  try {
    // Force the generation of client if needed
    const { execSync } = require('child_process');
    try {
      console.log('Trying to force regenerate Prisma client...');
      execSync('npx prisma generate', { stdio: 'inherit' });
    } catch (genError) {
      console.error('Warning: Could not force regenerate Prisma client:', genError.message);
      // Continue anyway as it might still work
    }

    // Try to initialize with direct path to generated client
    try {
      console.log('Attempting to load Prisma client directly...');
      const GeneratedPrismaClient = require('../node_modules/.prisma/client').PrismaClient;
      return new GeneratedPrismaClient();
    } catch (directError) {
      console.log('Could not load direct client, falling back to standard import:', directError.message);
      // Fall back to standard import
      return new PrismaClient();
    }
  } catch (e) {
    console.error('Failed to initialize PrismaClient:', e);
    throw e;
  }
};

// Enum values from enums.ts
const UserRole = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  COMPANY: 'COMPANY',
  EMPLOYEE: 'EMPLOYEE'
};

async function main() {
  let prisma;
  
  try {
    prisma = initPrisma();
    console.log('PrismaClient initialized successfully');
    
    console.log('Checking for existing SuperAdmin...');
    // Check if SuperAdmin already exists
    const superAdminCount = await prisma.user.count({
      where: {
        role: UserRole.SUPERADMIN,
      },
    });

    if (superAdminCount === 0) {
      console.log('No SuperAdmin found, creating one...');
      // Create initial SuperAdmin user
      const hashedPassword = await bcrypt.hash('superadmin123', 12);
      
      const superAdmin = await prisma.user.create({
        data: {
          name: 'Super Admin',
          email: 'superadmin@cbums.com',
          password: hashedPassword,
          role: UserRole.SUPERADMIN,
          coins: 1000000, // Initial coins set to 1 million
        },
      });

      console.log(`Created SuperAdmin user with id: ${superAdmin.id}`);
    } else {
      console.log('SuperAdmin user already exists, skipping creation');
    }

    console.log('Database seeding completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Error in seed function:', error);
    // Don't throw error to allow build to continue
    return { success: false, error: error.message };
  } finally {
    if (prisma) {
      try {
        console.log('Disconnecting Prisma client...');
        await prisma.$disconnect();
      } catch (e) {
        console.error('Error disconnecting Prisma client:', e);
      }
    }
  }
}

// Only run the main function if this script is executed directly (not imported)
if (require.main === module) {
  console.log('Running seed.js as main module');
  main()
    .catch((e) => {
      console.error('Fatal error during seeding:', e);
      // Don't exit with error code to allow build to continue
      process.exit(0);
    });
} else {
  console.log('seed.js was imported, not running main() automatically');
}

module.exports = main; 