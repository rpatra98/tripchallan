#!/usr/bin/env node

// This script fixes logo URLs in the database by ensuring they all have a leading slash
// It also verifies that all required directories exist

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Required directories for the application
const REQUIRED_DIRECTORIES = [
  path.join('public', 'uploads'),
  path.join('public', 'uploads', 'logos'),
  path.join('public', 'uploads', 'documents'),
  path.join('public', 'images'),
];

// Create a placeholder logo file if it doesn't exist
async function createPlaceholderLogo() {
  const placeholderPath = path.join(process.cwd(), 'public', 'placeholder-logo.png');
  
  try {
    await fs.promises.access(placeholderPath);
    console.log('✓ Placeholder logo already exists');
  } catch (error) {
    // Create a simple text file as placeholder
    try {
      // Copy from txt if it exists
      const txtPath = path.join(process.cwd(), 'public', 'placeholder-logo.txt');
      try {
        await fs.promises.access(txtPath);
        await fs.promises.copyFile(txtPath, placeholderPath);
        console.log('✓ Copied placeholder logo from .txt file');
      } catch (err) {
        // Create empty file
        await fs.promises.writeFile(placeholderPath, 'PLACEHOLDER');
        console.log('✓ Created empty placeholder logo file');
      }
    } catch (createErr) {
      console.error('✗ Failed to create placeholder logo file:', createErr);
    }
  }
}

// Ensure all required directories exist
async function ensureDirectoriesExist() {
  console.log('Checking for required directories...');
  
  const cwd = process.cwd();
  
  for (const dir of REQUIRED_DIRECTORIES) {
    const fullPath = path.join(cwd, dir);
    
    try {
      await fs.promises.access(fullPath);
      console.log(`✓ Directory exists: ${dir}`);
    } catch (error) {
      try {
        await fs.promises.mkdir(fullPath, { recursive: true });
        console.log(`✓ Created directory: ${dir}`);
      } catch (mkdirError) {
        console.error(`✗ Failed to create directory ${dir}:`, mkdirError);
      }
    }
  }
}

// Fix all company logo URLs in the database
async function fixLogoUrls() {
  
  
  try {
    console.log('Fixing company logo URLs...');
    
    // Get all companies with logos
    const companies = await // TODO: Replace with Supabase clientcompany.findMany({
      where: {
        logo: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        logo: true
      }
    });
    
    console.log(`Found ${companies.length} companies with logos`);
    
    // Track changes
    let updatedCount = 0;
    
    // Process each company
    for (const company of companies) {
      const originalLogo = company.logo;
      
      // Skip null logos
      if (!originalLogo) continue;
      
      // Ensure URL has a leading slash if it doesn't start with http
      let fixedLogo = originalLogo;
      
      if (!fixedLogo.startsWith('/') && !fixedLogo.startsWith('http')) {
        fixedLogo = `/${fixedLogo}`;
        
        // Update the company record
        await // TODO: Replace with Supabase clientcompany.update({
          where: { id: company.id },
          data: { logo: fixedLogo }
        });
        
        console.log(`Fixed logo URL for company ${company.name} (${company.id}): ${originalLogo} → ${fixedLogo}`);
        updatedCount++;
      }
      
      // Check if the logo file exists
      const logoPath = path.join(process.cwd(), 'public', fixedLogo.startsWith('/') ? fixedLogo.substring(1) : fixedLogo);
      
      try {
        await fs.promises.access(logoPath);
        console.log(`✓ Logo file exists for ${company.name}: ${logoPath}`);
      } catch (error) {
        console.warn(`✗ Logo file NOT FOUND for ${company.name}: ${logoPath}`);
      }
    }
    
    console.log(`Updated ${updatedCount} company logo URLs successfully`);
  } catch (error) {
    console.error('Error fixing logo URLs:', error);
  } finally {
    
  }
}

// Run all operations
async function main() {
  try {
    // 1. Ensure all directories exist
    await ensureDirectoriesExist();
    
    // 2. Create placeholder logo
    await createPlaceholderLogo();
    
    // 3. Fix logo URLs in database
    await fixLogoUrls();
    
    console.log('✅ Image path fix completed!');
  } catch (error) {
    console.error('Error during image path fixing:', error);
    process.exit(1);
  }
}

// Run the script
main(); 