const { Client } = require('pg');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// Get PostgreSQL connection string from environment variables
let postgresUrl = process.env.POSTGRES_URL_NON_POOLING;

if (!postgresUrl) {
  console.error('Missing PostgreSQL connection string in environment variables');
  process.exit(1);
}

// Make sure sslmode=require is in the connection string
if (!postgresUrl.includes('sslmode=require')) {
  postgresUrl += postgresUrl.includes('?') ? '&sslmode=require' : '?sslmode=require';
}

async function resetDatabase() {
  console.log('🔄 Starting manual database reset process...');
  console.log('Using connection string:', postgresUrl.replace(/:[^:@]+@/, ':****@')); // Log masked URL
  
  const client = new Client({
    connectionString: postgresUrl,
    ssl: { 
      rejectUnauthorized: false 
    }
  });
  
  try {
    // Connect to the database
    await client.connect();
    console.log('✅ Connected to PostgreSQL database');
    
    // Drop and recreate tables (in reverse order to avoid foreign key constraints)
    console.log('Dropping existing tables...');
    
    // List of tables to drop in order to avoid constraint issues
    const tables = [
      'activity_logs',
      'coin_transactions',
      'operator_permissions',
      'seals',
      'comments',
      'sessions',
      'vehicles',
      'users',
      'companies'
    ];
    
    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        console.log(`Dropped table: ${table}`);
      } catch (err) {
        console.error(`Error dropping table ${table}:`, err);
      }
    }
    
    // Create tables
    console.log('Creating tables...');
    
    // Create companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "companies" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" TEXT NOT NULL,
        "contactEmail" TEXT,
        "contactPhone" TEXT,
        "address" TEXT,
        "city" TEXT,
        "state" TEXT,
        "zipCode" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created companies table');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "subrole" TEXT,
        "companyId" UUID REFERENCES "companies"("id"),
        "coins" INTEGER DEFAULT 0,
        "lastLogin" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created users table');
    
    // Create sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL REFERENCES "users"("id"),
        "companyId" UUID REFERENCES "companies"("id"),
        "type" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "startTime" TIMESTAMP WITH TIME ZONE,
        "endTime" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created sessions table');
    
    // Create basic tables for other entities (simplified)
    // Vehicles
    await client.query(`
      CREATE TABLE IF NOT EXISTS "vehicles" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID REFERENCES "users"("id"),
        "companyId" UUID REFERENCES "companies"("id"),
        "registrationNumber" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "make" TEXT,
        "model" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created vehicles table');

    // Activity logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID REFERENCES "users"("id"),
        "action" TEXT NOT NULL,
        "details" JSONB,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created activity_logs table');
    
    // Create SuperAdmin
    console.log('Creating SuperAdmin user...');
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('superadmin123', 12);
    const superAdminId = uuidv4();
    
    // Insert the SuperAdmin
    await client.query(`
      INSERT INTO "users" ("id", "name", "email", "password", "role", "coins", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      superAdminId,
      'Super Admin',
      'superadmin@cbums.com',
      hashedPassword,
      'SUPERADMIN',
      1000000,
      new Date(),
      new Date()
    ]);
    
    console.log('✅ SuperAdmin created successfully with ID:', superAdminId);
    console.log('✅ Database reset and initialization completed successfully');
    
  } catch (error) {
    console.error('Error during database reset:', error);
  } finally {
    // Close the database connection
    await client.end();
    console.log('Database connection closed');
  }
}

// Run the reset operation
resetDatabase().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
}); 