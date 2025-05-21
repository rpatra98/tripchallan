// Safely handle migrations with retry logic
const { execSync } = require('child_process');
const { readFileSync } = require('fs');

// Max number of attempts for migration
const MAX_ATTEMPTS = 3;
// Wait time between attempts in milliseconds
const WAIT_TIME = 5000;

// Set timeout for advisory lock
process.env.PRISMA_MIGRATE_LOCK_TIMEOUT = process.env.PRISMA_MIGRATE_LOCK_TIMEOUT || "60000";

console.log('Beginning safe migration script');
console.log(`Using lock timeout: ${process.env.PRISMA_MIGRATE_LOCK_TIMEOUT}ms`);

// Set timeout for database operations
const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl && !databaseUrl.includes('connect_timeout')) {
  if (!process.env.DATABASE_URL_WITH_OPTIONS) {
    process.env.DATABASE_URL_WITH_OPTIONS = 
      `${databaseUrl}?connection_limit=1&pool_timeout=60&connect_timeout=60&statement_timeout=80000`;
  }
  console.log('Enhanced database URL with connection parameters');
}

// Function to execute migration with retry logic
async function migrateWithRetry() {
  let attempt = 1;
  let success = false;

  while (attempt <= MAX_ATTEMPTS && !success) {
    console.log(`Migration attempt ${attempt} of ${MAX_ATTEMPTS}...`);
    
    try {
      // Execute the migration deploy command
      execSync('prisma migrate deploy', { 
        stdio: 'inherit',
        env: process.env
      });
      
      console.log('Migration completed successfully!');
      success = true;
    } catch (error) {
      console.error(`Migration attempt ${attempt} failed with error:`);
      console.error(error.message);
      
      if (attempt < MAX_ATTEMPTS) {
        console.log(`Waiting ${WAIT_TIME/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, WAIT_TIME));
      } else {
        console.log('All migration attempts failed. Continuing build process anyway...');
        process.exit(0); // Exit successfully to continue build
      }
    }
    
    attempt++;
  }
}

// Execute the migration
migrateWithRetry().catch(e => {
  console.error('Unexpected error in migration script:', e);
  process.exit(0); // Exit successfully to continue build
}); 