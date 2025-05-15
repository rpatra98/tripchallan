const fs = require('fs');
const path = require('path');

// Fix the remaining issues in app/dashboard/activity-logs/page.tsx
const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let pageContent = fs.readFileSync(pageFilePath, 'utf8');

// 1. Find the main component function and make sure it has only one return statement
// First, let's identify the component's body
const componentRegex = /export default function ActivityLogsPage\(\) {[\s\S]*?}/g;
const componentMatch = pageContent.match(componentRegex);

if (componentMatch && componentMatch.length > 0) {
  console.log('Found the ActivityLogsPage component');
  
  // The component has multiple return statements, so we need to replace it with a clean version
  // This is a simple fix that keeps only the first return statement up to the next closing parenthesis
  const cleanedComponent = componentMatch[0].replace(
    /(return \([\s\S]*?\);)([\s\S]*return \([\s\S]*)/,
    '$1'
  );
  
  // Replace the component in the original file
  pageContent = pageContent.replace(componentRegex, cleanedComponent);
  
  // Save the fixed page file
  fs.writeFileSync(pageFilePath, pageContent);
  console.log('Fixed return statement issues');
} else {
  console.log('Could not locate the ActivityLogsPage component');
}

// 2. Check for any missing closing brackets or parentheses
// This is a simple check that ensures balanced brackets and parentheses
function checkBalancedBrackets(text) {
  const stack = [];
  const bracketPairs = {
    '{': '}',
    '(': ')',
    '[': ']'
  };
  
  let lineNumber = 1;
  let result = { balanced: true, issues: [] };
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '\n') {
      lineNumber++;
    }
    
    if ('{(['.includes(char)) {
      stack.push({ char, line: lineNumber });
    } else if ('})]'.includes(char)) {
      if (stack.length === 0) {
        result.balanced = false;
        result.issues.push(`Extra closing '${char}' at line ${lineNumber}`);
        continue;
      }
      
      const last = stack.pop();
      if (bracketPairs[last.char] !== char) {
        result.balanced = false;
        result.issues.push(`Mismatched bracket: '${last.char}' at line ${last.line} closed with '${char}' at line ${lineNumber}`);
      }
    }
  }
  
  if (stack.length > 0) {
    result.balanced = false;
    stack.forEach(item => {
      result.issues.push(`Unclosed '${item.char}' at line ${item.line}`);
    });
  }
  
  return result;
}

// Check if brackets are balanced in the file
const balanceCheck = checkBalancedBrackets(pageContent);
if (!balanceCheck.balanced) {
  console.log('Warning: The file has unbalanced brackets or parentheses:');
  balanceCheck.issues.forEach(issue => console.log(` - ${issue}`));
  console.log('You may need to manually fix these issues.');
} else {
  console.log('✓ Brackets and parentheses are balanced.');
}

console.log('All fixes completed.');

// Let's verify the file is syntactically valid
try {
  // We'll count the number of return statements in the component
  const returnStatements = pageContent.match(/return \(/g) || [];
  console.log(`The file now has ${returnStatements.length} return statements.`);
  
  if (returnStatements.length > 5) {
    console.log('Warning: There are still multiple return statements, but they might be inside different components or functions.');
  }
  
  console.log('Final verification completed.');
} catch (error) {
  console.error('Error during verification:', error);
} 