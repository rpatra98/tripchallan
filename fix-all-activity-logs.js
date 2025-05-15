const fs = require('fs');
const path = require('path');

// Fix the issues in app/dashboard/activity-logs/page.tsx
const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let pageContent = fs.readFileSync(pageFilePath, 'utf8');

// 1. Fix the ActivityLogsResponse interface and Zod schema syntax
const fixedPageContent = pageContent
  // Fix the interface closing bracket and remove the extra semicolon after Zod schema
  .replace(
    /interface ActivityLogsResponse {[\s\S]*?}\n\n\/\/ Zod schemas[\s\S]*?};/,
    `interface ActivityLogsResponse {
  logs: ActivityLog[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }
}

// Zod schemas for runtime validation
const UserSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  role: z.string().nullable().optional()
});

const ActivityLogDetailsSchema = z.record(z.unknown()).optional().nullable();

const ActivityLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  targetResourceType: z.string().nullable().optional(),
  targetResourceId: z.string().nullable().optional(),
  userId: z.string(),
  createdAt: z.string().or(z.date()),
  userAgent: z.string().nullable().optional(),
  details: ActivityLogDetailsSchema,
  user: UserSchema.nullable().optional(),
  targetUser: UserSchema.nullable().optional()
});

const MetaSchema = z.object({
  currentPage: z.number().default(1),
  totalPages: z.number().default(1),
  totalItems: z.number().default(0),
  itemsPerPage: z.number().default(10),
  hasNextPage: z.boolean().default(false),
  hasPrevPage: z.boolean().default(false)
});

const ActivityLogsResponseSchema = z.object({
  logs: z.array(ActivityLogSchema).nullable().default([]),
  meta: MetaSchema.default({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false
  })
})`
  )

  // 2. Fix the ActivityLogDetails type definition to accept string or number for amount
  .replace(
    /type ActivityLogDetails = {[\s\S]*?};/,
    `type ActivityLogDetails = {
  device?: string;
  reasonText?: string;
  amount?: string | number;
  recipientName?: string;
  [key: string]: unknown;
};`
  )

  // 3. Fix the ActivityLogRow type to make targetResourceType required
  .replace(
    /type ActivityLogRow = {[\s\S]*?};/,
    `type ActivityLogRow = {
  id: string;
  user: {
    name: string;
    email: string;
  };
  action: string;
  details: ActivityLogDetails;
  targetUser?: {
    name: string;
    email: string;
  };
  createdAt: string;
  userAgent?: string;
  targetResourceType: string;  // Changed from optional to required
};`
  )

  // 4. Fix the useEffect transform logic to handle edge cases
  .replace(
    /useEffect\(\) => {[\s\S]*?setTableData\(\[\]\);[\s\S]*?}\s*\}, \[logs\]\);/,
    `useEffect(() => {
    console.log("Transform effect running. Logs length:", logs?.length || 0);
    
    if (logs && Array.isArray(logs) && logs.length > 0) {
      try {
        // Safely transform the logs data to prevent crashes
        const formattedData = logs.map(log => {
          try {
            if (!log) {
              console.warn("Encountered null log entry");
              return null;
            }
            
            // Create a safe version of the log entry with fallbacks for all fields
            return {
              id: log.id || \`unknown-\${Math.random()}\`,
              user: {
                name: log.user?.name || "Unknown User",
                email: log.user?.email || "No email"
              },
              action: log.action || "UNKNOWN",
              details: {
                ...(log.details || {}),
                // Handle amount as either string or number
                amount: log.details?.amount !== undefined 
                  ? log.details.amount 
                  : undefined
              },
              targetUser: log.targetUser
                ? {
                    name: log.targetUser.name || "Unknown",
                    email: log.targetUser.email || "No email"
                  }
                : undefined,
              createdAt: log.createdAt || new Date().toISOString(),
              userAgent: log.userAgent || undefined,
              targetResourceType: log.targetResourceType || "UNKNOWN"
            };
          } catch (itemError) {
            console.error("Error processing log item:", itemError);
            return null;
          }
        }).filter(Boolean); // Remove any null entries
        
        console.log("Successfully transformed", formattedData.length, "log entries");
        setTableData(formattedData);
      } catch (error) {
        console.error("Error in logs transformation:", error);
        setTableData([]);
      }
    } else {
      console.log("No logs to transform or logs is not an array");
      setTableData([]);
    }
  }, [logs]);`
  )

  // 5. Fix component declaration to use export default
  .replace(
    /function ActivityLogsPage\(\) {/g,
    `export default function ActivityLogsPage() {`
  )

  // 6. Remove the duplicate return statement if it exists
  .replace(
    /return \([\s\S]*?\);[\s\S]*?return \(/,
    `return (`
  );

// Save the fixed page file
fs.writeFileSync(pageFilePath, fixedPageContent);
console.log('Fixed issues in activity-logs/page.tsx');

// Update app-new.tsx file to match
const appNewFilePath = 'app-new.tsx';
const appNewContent = `// Ignore this file - it's just used for copying over to the real file
type ActivityLogDetails = {
  device?: string;
  reasonText?: string;
  amount?: string | number;  // Accept both string and number
  recipientName?: string;
  [key: string]: unknown;
};

type ActivityLogRow = {
  id: string;
  user: {
    name: string;
    email: string;
  };
  action: string;
  details: ActivityLogDetails;
  targetUser?: {
    name: string;
    email: string;
  };
  createdAt: string;
  userAgent?: string;
  targetResourceType: string;  // Required, not optional
}; 
`;

fs.writeFileSync(appNewFilePath, appNewContent);
console.log('Updated app-new.tsx');

// Update effect-transform.tsx file to handle both string and number for amount
const effectFilePath = 'effect-transform.tsx';
const effectContent = `// Ignore this file - it's just used for copying over to the real file
// Transform logs to table data format
useEffect(() => {
  if (logs && Array.isArray(logs) && logs.length > 0) {
    try {
      const formattedData = logs.map(log => ({
        id: log.id || \`unknown-\${Math.random()}\`,
        user: {
          name: log.user?.name || "Unknown",
          email: log.user?.email || "No email"
        },
        action: log.action || "UNKNOWN",
        details: { 
          ...(log.details || {}),
          // Keep amount as is - it can be string or number
          amount: log.details?.amount !== undefined ? log.details.amount : undefined
        },
        targetUser: log.targetUser ? {
          name: log.targetUser.name || "Unknown",
          email: log.targetUser.email || "No email"
        } : undefined,
        createdAt: log.createdAt || new Date().toISOString(),
        userAgent: log.userAgent || undefined,
        targetResourceType: log.targetResourceType || "UNKNOWN"
      }));
      
      setTableData(formattedData);
    } catch (error) {
      console.error("Error transforming logs:", error);
      setTableData([]);
    }
  } else {
    setTableData([]);
  }
}, [logs]); 
`;

fs.writeFileSync(effectFilePath, effectContent);
console.log('Updated effect-transform.tsx');

console.log('All activity logs related files have been fixed.'); 