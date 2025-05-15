const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Add zod imports
if (!content.includes('import { z }')) {
  const importStatements = content.split('\n').filter(line => line.startsWith('import '));
  const lastImport = importStatements[importStatements.length - 1];
  const importIndex = content.indexOf(lastImport) + lastImport.length;
  
  content = content.slice(0, importIndex) + 
    '\nimport { z } from "zod";' +
    content.slice(importIndex);
}

// Add zod schemas to validate the API response
const interfaceDefinitions = content.match(/interface ActivityLogsResponse \{[\s\S]*?\}/);
if (interfaceDefinitions && !content.includes('const ActivityLogSchema')) {
  const interfaceIndex = content.indexOf(interfaceDefinitions[0]) + interfaceDefinitions[0].length;
  
  const zodSchemas = `

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
});
`;
  
  content = content.slice(0, interfaceIndex) + zodSchemas + content.slice(interfaceIndex);
}

// Replace the fetch response handling with zod validation
const fetchResponse = /const data: ActivityLogsResponse = await response\.json\(\);[\s\S]*?setError\(""\);/;
const zodValidatedFetch = `const rawData = await response.json();
      
      // Validate and parse the response data using zod
      const validationResult = ActivityLogsResponseSchema.safeParse(rawData);
      
      if (!validationResult.success) {
        console.error("API response validation failed:", validationResult.error);
        const issuesList = validationResult.error.issues.map(issue => \`\${issue.path.join('.')}: \${issue.message}\`).join(', ');
        setError(\`Data validation failed: \${issuesList}\`);
        setLogs([]);
        setTotalPages(1);
        return;
      }
      
      const data = validationResult.data;
      console.log("Validated API Response:", {
        logsCount: data.logs?.length || 0,
        totalPages: data.meta?.totalPages || 0,
        totalItems: data.meta?.totalItems || 0
      });
      
      setLogs(data.logs || []);
      setTotalPages(data.meta?.totalPages || 1);
      setError("");`;

content = content.replace(fetchResponse, zodValidatedFetch);

// Save the changes
fs.writeFileSync(filePath, content);

console.log('Added zod validation to activity logs API response'); 