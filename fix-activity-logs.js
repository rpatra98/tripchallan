const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the entire content of the file
const originalContent = fs.readFileSync(filePath, 'utf8');
console.log(`Original file size: ${originalContent.length} bytes`);

// 1. Fix the imports - remove SearchableTable
let newContent = originalContent.replace(
  /import \{[\s\S]*?SearchableTable,[\s\S]*?\} from "@\/components\/ui";/,
  `import {
  DataTable,
  Card,
  CardContent,
  Skeleton,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  DatePicker,
} from "@/components/ui";`
);

// 2. Remove the columns variable and its remnants
const columnsRegex = /\/\/ (Column definition for the activity logs table|Table structure is defined inline in the render method)[\s\S]*?cell: \(\{ row \}: RowProps\) => \{[\s\S]*?accessorKey: "createdAt",/;
newContent = newContent.replace(columnsRegex, '');

// Write the changes back to the file
fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`New file size: ${newContent.length} bytes`);
console.log('Fixed ActivityLogs page by removing unused imports and column definitions'); 