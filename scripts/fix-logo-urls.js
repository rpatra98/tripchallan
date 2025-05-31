// Script to fix logo URLs for existing companies by adding a leading slash if missing
const { PrismaClient } = require('@prisma/client');


async function fixLogoUrls() {
  console.log('Starting to fix company logo URLs...');
  
  try {
    // Get all companies with logo URLs
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
    
    let updatedCount = 0;
    
    // Process each company
    for (const company of companies) {
      const logoUrl = company.logo;
      
      // Only fix URLs that don't start with a slash and aren't empty
      if (logoUrl && !logoUrl.startsWith('/') && !logoUrl.startsWith('http')) {
        const fixedUrl = `/${logoUrl}`;
        
        // Update the company record
        await // TODO: Replace with Supabase clientcompany.update({
          where: { id: company.id },
          data: { logo: fixedUrl }
        });
        
        console.log(`Fixed logo URL for company ${company.name} (${company.id}): ${logoUrl} → ${fixedUrl}`);
        updatedCount++;
      }
    }
    
    console.log(`Updated ${updatedCount} company logo URLs successfully`);
  } catch (error) {
    console.error('Error fixing logo URLs:', error);
  } finally {
    
  }
}

// Run the function
fixLogoUrls()
  .then(() => console.log('Logo URL fix completed!'))
  .catch(error => console.error('Script failed:', error)); 