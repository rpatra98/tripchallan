import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

// List of required directories for the application
const REQUIRED_DIRECTORIES = [
  ['public', 'uploads'],
  ['public', 'uploads', 'logos'],
  ['public', 'uploads', 'documents'],
  ['public', 'images'],
];

// Create directories on GET request
export async function GET() {
  try {
    // Create each directory if it doesn't exist
    for (const dirPath of REQUIRED_DIRECTORIES) {
      const fullPath = path.join(process.cwd(), ...dirPath);
      
      try {
        await fs.mkdir(fullPath, { recursive: true });
        console.log(`✅ Directory exists or was created: ${fullPath}`);
      } catch (err) {
        console.error(`❌ Failed to create directory: ${fullPath}`, err);
      }
    }
    
    return NextResponse.json({ 
      status: 'success', 
      message: 'Server initialization completed successfully',
      directories: REQUIRED_DIRECTORIES.map(d => path.join(...d))
    });
  } catch (error) {
    console.error('Error during server initialization:', error);
    return NextResponse.json(
      { status: 'error', message: 'Server initialization failed' },
      { status: 500 }
    );
  }
}

// Called automatically when the application starts up
export async function POST() {
  // Same functionality as GET
  return GET();
} 