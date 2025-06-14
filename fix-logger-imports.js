// Run this script with: node fix-logger-imports.js
const fs = require('fs');
const path = require('path');

// Files that need logger import
const filesToFix = [
  'src/__tests__/components/ui/ErrorBoundary.jsx',
  'src/__tests__/contexts/AuthContext.test.jsx',
  'src/__tests__/contexts/ProgressContext.jsx',
  'src/hooks/useLocalStorage.js',
  'src/hooks/usePWA.js',
  'src/hooks/useVoice.js',
  'src/pages/api/send-email.js',
  'src/utils/analytics.js',
  'src/utils/apiClient.js',
  'src/utils/cache.js',
  'src/utils/errorHandler.js',
  'src/utils/offline.js',
  'src/utils/performance.js'
];

// Function to add logger import to a file
function addLoggerImport(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if logger import already exists
    if (content.includes("import logger from") || content.includes("import * as logger")) {
      console.log(`✅ Logger already imported in: ${filePath}`);
      return;
    }

    // Calculate relative path to logger
    const fileDir = path.dirname(filePath);
    const loggerPath = path.relative(fileDir, 'src/utils/logger').replace(/\\/g, '/');
    const importStatement = `import logger from '${loggerPath.startsWith('.') ? loggerPath : './' + loggerPath}';\n`;

    // Add import after existing imports or at the beginning
    const lines = content.split('\n');
    let insertIndex = 0;
    
    // Find the last import statement
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ') || lines[i].trim().startsWith('const ') && lines[i].includes('require(')) {
        insertIndex = i + 1;
      } else if (lines[i].trim() === '' && insertIndex > 0) {
        break;
      }
    }

    lines.splice(insertIndex, 0, importStatement);
    const newContent = lines.join('\n');

    fs.writeFileSync(filePath, newContent);
    console.log(`✅ Added logger import to: ${filePath}`);
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
  }
}

// Run the fixes
console.log('🔧 Adding logger imports...\n');
filesToFix.forEach(addLoggerImport);
console.log('\n✅ Logger import fixes complete!');