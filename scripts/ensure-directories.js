const fs = require('fs');
const path = require('path');

/**
 * Ensures that all required directories for file uploads exist
 */
function ensureDirectories() {
  const requiredDirs = [
    path.join(process.cwd(), 'public', 'uploads'),
    path.join(process.cwd(), 'public', 'uploads', 'logos'),
    path.join(process.cwd(), 'public', 'uploads', 'documents'),
    path.join(process.cwd(), 'public', 'images'),
  ];

  requiredDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    } else {
      console.log(`Directory already exists: ${dir}`);
    }
  });
}

// Run when script is executed directly
if (require.main === module) {
  ensureDirectories();
}

module.exports = ensureDirectories; 