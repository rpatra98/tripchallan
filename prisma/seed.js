// JavaScript version of seed.ts for easier execution in Vercel build
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

// Log environment for debugging
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Starting database seeding process...');

let prisma;
try {
  prisma = new PrismaClient();
  console.log('PrismaClient initialized successfully');
} catch (e) {
  console.error('Failed to initialize PrismaClient:', e);
  process.exit(1);
}

// Enum values from enums.ts
const UserRole = {
  SUPERADMIN: 'SUPERADMIN',
  ADMIN: 'ADMIN',
  COMPANY: 'COMPANY',
  EMPLOYEE: 'EMPLOYEE'
};

async function main() {
  try {
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
    throw error;
  }
}

// Only run the main function if this script is executed directly (not imported)
if (require.main === module) {
  console.log('Running seed.js as main module');
  main()
    .catch((e) => {
      console.error('Fatal error during seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      console.log('Disconnecting Prisma client...');
      await prisma.$disconnect();
    });
} else {
  console.log('seed.js was imported, not running main() automatically');
}

module.exports = main; 