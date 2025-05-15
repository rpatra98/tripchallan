const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the file content
let content = fs.readFileSync(filePath, 'utf8');
console.log(`Starting file size: ${content.length} bytes`);

// Focus specifically on removing the remnants of columns definition and the array
const columnEndPattern = /\s+header: "Time",[\s\S]*?},\s*\],/;
if (content.match(columnEndPattern)) {
  content = content.replace(columnEndPattern, "\n");
  console.log("Removed remaining column definition code");
} else {
  console.log("No remaining column definition found");
}

// Save the changes
fs.writeFileSync(filePath, content, 'utf8');
console.log(`Final file size: ${content.length} bytes`);
console.log('Completed final cleanup for ActivityLogs page'); 