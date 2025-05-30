const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

// Function to log messages to both console and a log file
function log(message, isError = false) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  
  // Log to console
  if (isError) {
    console.error(logMessage);
  } else {
    console.log(logMessage);
  }
  
  // Also log to a file
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const logFile = path.join(logDir, 'db-init.log');
  fs.appendFileSync(logFile, logMessage + '\n');
}

// Function to safely parse connection string
function parseConnectionString(url) {
  try {
    // This is a simple parser for PostgreSQL connection strings
    const regex = /postgres:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?/;
    const match = url.match(regex);
    
    if (!match) {
      log('Failed to parse connection string', true);
      return null;
    }
    
    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: match[4],
      database: match[5],
      ssl: { rejectUnauthorized: false }
    };
  } catch (error) {
    log(`Error parsing connection string: ${error.message}`, true);
    return null;
  }
}

async function resetDatabase() {
  log('🔄 Starting database reset and initialization...');
  
  // Get connection details from environment
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  
  if (!connectionString) {
    log('Missing POSTGRES_URL_NON_POOLING environment variable', true);
    process.exit(1);
  }
  
  // Parse the connection string into individual parameters
  const connectionConfig = parseConnectionString(connectionString);
  
  if (!connectionConfig) {
    log('Invalid connection string format', true);
    process.exit(1);
  }
  
  log(`Connecting to PostgreSQL at ${connectionConfig.host}:${connectionConfig.port}/${connectionConfig.database}`);
  
  const client = new Client(connectionConfig);
  
  try {
    // Connect to the database
    await client.connect();
    log('✅ Connected to PostgreSQL database');
    
    // List of tables to drop in correct order (to avoid foreign key constraint issues)
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
    
    // Drop existing tables
    log('Dropping existing tables...');
    for (const table of tables) {
      try {
        await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
        log(`Dropped table: ${table}`);
      } catch (err) {
        log(`Error dropping table ${table}: ${err.message}`, true);
      }
    }
    
    // Create tables
    log('Creating tables...');
    
    // Companies table
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
        "isActive" BOOLEAN DEFAULT TRUE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log('Created companies table');
    
    // Users table
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
    log('Created users table');
    
    // Vehicles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "vehicles" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "registrationNumber" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "make" TEXT,
        "model" TEXT,
        "userId" UUID REFERENCES "users"("id"),
        "companyId" UUID REFERENCES "companies"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log('Created vehicles table');
    
    // Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'PENDING',
        "startTime" TIMESTAMP WITH TIME ZONE,
        "endTime" TIMESTAMP WITH TIME ZONE,
        "userId" UUID NOT NULL REFERENCES "users"("id"),
        "companyId" UUID REFERENCES "companies"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log('Created sessions table');
    
    // Comments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "comments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "content" TEXT NOT NULL,
        "sessionId" UUID REFERENCES "sessions"("id"),
        "userId" UUID REFERENCES "users"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log('Created comments table');
    
    // Seals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "seals" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "sealNumber" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "sessionId" UUID REFERENCES "sessions"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log('Created seals table');
    
    // Operator permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "operator_permissions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID REFERENCES "users"("id"),
        "permission" TEXT NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log('Created operator_permissions table');
    
    // Coin transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "coin_transactions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "amount" INTEGER NOT NULL,
        "type" TEXT NOT NULL,
        "description" TEXT,
        "userId" UUID REFERENCES "users"("id"),
        "senderUserId" UUID REFERENCES "users"("id"),
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log('Created coin_transactions table');
    
    // Activity logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" UUID REFERENCES "users"("id"),
        "action" TEXT NOT NULL,
        "details" JSONB,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    log('Created activity_logs table');
    
    // Create SuperAdmin user
    log('Creating SuperAdmin user...');
    
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
    
    log(`✅ SuperAdmin created successfully with ID: ${superAdminId}`);
    
    // Grant permissions
    log('Setting up database permissions...');
    
    try {
      // Grant schema usage
      await client.query(`
        GRANT USAGE ON SCHEMA public TO postgres;
        GRANT USAGE ON SCHEMA public TO anon;
        GRANT USAGE ON SCHEMA public TO authenticated;
        GRANT USAGE ON SCHEMA public TO service_role;
      `);
      
      // Grant table permissions
      await client.query(`
        GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
        GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
      `);
      
      // Grant sequence permissions
      await client.query(`
        GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
      `);
      
      log('✅ Database permissions set up successfully');
    } catch (permError) {
      log(`Warning: Could not set all permissions: ${permError.message}`, true);
      log('This may not be a problem if you are not a database admin user');
    }
    
    log('✅ Database initialization completed successfully');
    
  } catch (error) {
    log(`Error during database reset: ${error.message}`, true);
    if (error.stack) {
      log(`Stack trace: ${error.stack}`, true);
    }
    process.exit(1);
  } finally {
    // Close the database connection
    await client.end();
    log('Database connection closed');
  }
}

// Run the reset operation
resetDatabase().then(() => {
  log('✅ Database reset and initialization completed successfully');
  process.exit(0);
}).catch(err => {
  log(`Fatal error: ${err.message}`, true);
  process.exit(1);
}); 