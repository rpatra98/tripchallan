const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Extract ActivityLogRow type definition
const activityLogRowMatch = content.match(/type\s+ActivityLogRow\s*=\s*{[\s\S]*?};/);
if (activityLogRowMatch) {
  console.log("ActivityLogRow definition found:");
  console.log(activityLogRowMatch[0]);
} else {
  console.log("ActivityLogRow definition not found");
}

// Export to a separate file for better visibility
const typesPath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'types.ts');
fs.writeFileSync(typesPath, `// Types exported from activity-logs page
${activityLogRowMatch ? activityLogRowMatch[0] : '// ActivityLogRow not found'}
`, 'utf8');

console.log(`Types exported to ${typesPath}`); 