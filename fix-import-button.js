const fs = require('fs');
const path = require('path');

// Fix the import in app/dashboard/activity-logs/page.tsx
const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let pageContent = fs.readFileSync(pageFilePath, 'utf8');

// Check if Button is already imported from @mui/material
if (!pageContent.includes('Button') || !pageContent.includes('import { Box, Typography, Paper, CircularProgress, Alert, Button } from "@mui/material";')) {
  // Add Button to the MUI import
  pageContent = pageContent.replace(
    /import { Box, Typography, Paper, CircularProgress, Alert([^}]*)} from "@mui\/material";/,
    'import { Box, Typography, Paper, CircularProgress, Alert$1, Button } from "@mui/material";'
  );
  
  console.log('Added Button to MUI imports');
}

// Save the updated file
fs.writeFileSync(pageFilePath, pageContent);
console.log('Updated activity-logs page.tsx with Button import'); 