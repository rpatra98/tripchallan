// Direct check using SQL
const { Client } = require('pg');

async function directCheck() {
  // Get database URL from env
  const databaseUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
  
  if (!databaseUrl) {
    console.error('No database URL found in environment variables');
    return;
  }
  
  console.log(`Connecting to database...`);
  const client = new Client({ 
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false // Needed for Supabase connections
    }
  });
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Check if the users table exists
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables in database:');
    tablesResult.rows.forEach(row => console.log(` - ${row.table_name}`));
    
    // Check if the superadmin user exists
    const userResult = await client.query(`
      SELECT id, name, email, role 
      FROM users 
      WHERE email = 'superadmin@cbums.com'
    `);
    
    if (userResult.rows.length === 0) {
      console.log('SuperAdmin user not found in database');
      
      // Create a new superadmin user
      console.log('Creating SuperAdmin user...');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('superadmin123', 12);
      
      const insertResult = await client.query(`
        INSERT INTO users (id, name, email, password, role, coins, "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(),
          'Super Admin',
          'superadmin@cbums.com',
          $1,
          'SUPERADMIN',
          1000000,
          NOW(),
          NOW()
        )
        RETURNING id, name, email, role
      `, [hashedPassword]);
      
      console.log('SuperAdmin user created:', insertResult.rows[0]);
    } else {
      console.log('SuperAdmin user found:', userResult.rows[0]);
      
      // Update the password
      console.log('Updating SuperAdmin password...');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('superadmin123', 12);
      
      await client.query(`
        UPDATE users
        SET password = $1
        WHERE email = 'superadmin@cbums.com'
      `, [hashedPassword]);
      
      console.log('Password updated successfully');
    }
  } catch (error) {
    console.error('Error during direct check:', error);
  } finally {
    await client.end();
    console.log('Disconnected from database');
  }
}

// Load environment variables from .env file
require('dotenv').config();

directCheck()
  .then(() => console.log('Direct check complete'))
  .catch(err => console.error('Direct check failed:', err)); 