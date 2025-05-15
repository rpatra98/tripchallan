const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the original content
let content = fs.readFileSync(filePath, 'utf8');
console.log(`Original file size: ${content.length} bytes`);

// First pass: Remove the unused "columns" array definition, which is conflicting
// with the direct table rendering approach
if (content.includes("// Column definition for the activity logs table")) {
  const columnsDefStart = content.indexOf("// Column definition for the activity logs table");
  const exportFunctionStart = content.indexOf("export default function ActivityLogsPage");
  
  if (columnsDefStart !== -1 && exportFunctionStart !== -1) {
    // Remove everything between these points
    content = content.substring(0, columnsDefStart) + 
              content.substring(exportFunctionStart);
    console.log("Removed conflicting columns definition");
  }
}

// Fix any other TypeScript errors if needed
// (We'll handle these if they appear after the first fix)

// Save the file
fs.writeFileSync(filePath, content, 'utf8');
console.log(`New file size: ${content.length} bytes`);
console.log('Fixed TypeScript errors in the activity logs page'); 