const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

console.log(`File size before cleanup: ${content.length} bytes`);

// 1. Remove SearchableTable from imports
content = content.replace(
  /import \{\n([\s\S]*?)(\n\s*SearchableTable,)?([\s\S]*?)\n\} from "@\/components\/ui";/,
  (match, beforeSearchable, searchablePart, afterSearchable) => {
    if (!searchablePart) return match; // If SearchableTable isn't there, don't change anything
    return `import {\n${beforeSearchable}${afterSearchable}\n} from "@/components/ui";`;
  }
);

// 2. Remove the columns definition that's no longer needed
content = content.replace(
  /\/\/ Column definition for the activity logs table\nconst columns = \[([\s\S]*?)\];/,
  "// Table structure is defined inline in the render method"
);

// Save the changes
fs.writeFileSync(filePath, content, 'utf8');
console.log(`File size after cleanup: ${content.length} bytes`);
console.log('Cleaned up Activity Logs page: removed unused imports and column definitions'); 