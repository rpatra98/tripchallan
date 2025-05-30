/**
 * DEPRECATED: This file is no longer used.
 * 
 * The application has been migrated from Prisma to Supabase.
 * Use the Supabase client from @/lib/supabase.ts instead.
 * 
 * Example:
 * import supabase from '@/lib/supabase';
 * 
 * This file is kept only for compatibility with old imports.
 */

console.warn(
  "DEPRECATED: @/lib/prisma is no longer used. The application has been migrated to Supabase. " +
  "Please update your imports to use @/lib/supabase instead."
);

// Return a mock object that logs warnings when used
const mockPrisma = new Proxy({}, {
  get(_, prop) {
    console.warn(`DEPRECATED: Attempt to use prisma.${String(prop)}. Use Supabase client instead.`);
    return () => {
      throw new Error(`Prisma client has been removed. Use Supabase client instead.`);
    };
  }
});

export default mockPrisma; 