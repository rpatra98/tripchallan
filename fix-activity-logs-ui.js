const fs = require('fs');
const path = require('path');

// Update the activity logs page UI
const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let pageContent = fs.readFileSync(pageFilePath, 'utf8');

// Make sure we're importing the necessary components and icons
if (!pageContent.includes('import { RefreshCw')) {
  // Find the existing import for lucide-react icons
  const iconImportMatch = pageContent.match(/import {[\s\S]*?} from "lucide-react";/);
  
  if (iconImportMatch) {
    // Replace with expanded import including the needed icons
    pageContent = pageContent.replace(
      iconImportMatch[0],
      `import { 
  ArrowLeft, 
  Smartphone, 
  Monitor, 
  Filter, 
  RefreshCw,
  Star,
  AlertTriangle,
  X,
  Binoculars,
  Gift,
  ArrowLeftRight
} from "lucide-react";`
    );
    console.log('Updated icon imports');
  } else {
    // Add the import if it doesn't exist
    pageContent = pageContent.replace(
      /import React,.*?\n/,
      `import React, { useState, useEffect, useCallback } from "react";\nimport { 
  ArrowLeft, 
  Smartphone, 
  Monitor, 
  Filter, 
  RefreshCw,
  Star,
  AlertTriangle,
  X,
  Binoculars,
  Gift,
  ArrowLeftRight
} from "lucide-react";\n`
    );
    console.log('Added icon imports');
  }
}

// Add a refresh handler function if it doesn't exist
if (!pageContent.includes('const handleRefresh')) {
  // Find a good spot to add the function - right after the fetchActivityLogs function
  pageContent = pageContent.replace(
    /const fetchActivityLogs = useCallback\(.*?\), \[\]\);/s,
    match => `${match}\n
  // Handler for refreshing the current page
  const handleRefresh = useCallback(() => {
    console.log("Refreshing activity logs...");
    fetchActivityLogs(currentPage);
  }, [fetchActivityLogs, currentPage]);`
  );
  console.log('Added handleRefresh function');
}

// Update the page header to include debug buttons
try {
  pageContent = pageContent.replace(
    /<Typography[^>]*variant="h4"[^>]*>[\s\S]{0,30}Activity Logs[\s\S]{0,30}<\/Typography>/,
    `<Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Activity Logs
        </Typography>
        
        {session?.user?.role === "SUPERADMIN" && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={async () => {
                try {
                  const response = await fetch('/api/debug-logs?createSample=true');
                  if (response.ok) {
                    const result = await response.json();
                    alert(\`Created \${result.createdSampleLogs} sample logs. Refreshing...\`);
                    handleRefresh();
                  } else {
                    alert('Failed to create sample logs');
                  }
                } catch (error) {
                  console.error("Error creating sample logs:", error);
                  alert('Error creating sample logs');
                }
              }}
              startIcon={<Star size={16} />}
            >
              Create Test Logs
            </Button>
            
            <Button
              variant="outlined"
              color="warning"
              onClick={async () => {
                try {
                  setIsLoading(true);
                  const response = await fetch('/api/debug-activity-logs');
                  if (!response.ok) {
                    throw new Error(\`Failed to fetch debug logs: \${response.status}\`);
                  }
                  
                  const data = await response.json();
                  console.log("Debug activity logs response:", data);
                  
                  if (!data.logs || !Array.isArray(data.logs)) {
                    alert('No logs found in debug mode');
                    setLogs([]);
                  } else {
                    setLogs(data.logs);
                    setTotalPages(data.meta?.totalPages || 1);
                    alert(\`Found \${data.logs.length} logs in debug mode\`);
                  }
                } catch (error) {
                  console.error("Error fetching debug logs:", error);
                  alert(\`Error fetching debug logs: \${error.message}\`);
                } finally {
                  setIsLoading(false);
                }
              }}
              startIcon={<AlertTriangle size={16} />}
            >
              Debug Mode
            </Button>
          </Box>
        )}
      </Box>`
  );
  console.log('Updated page header with debug buttons');
} catch (e) {
  console.error('Failed to update page header:', e);
}

// Update the empty state UI with additional debug options
try {
  // Find the empty state alert component
  const emptyStateRegex = /logs\.length === 0 \? \(\s*<Alert[^>]*>[\s\S]*?<\/Alert>\s*\) : \(/;
  const emptyStateMatch = pageContent.match(emptyStateRegex);
  
  if (emptyStateMatch) {
    pageContent = pageContent.replace(
      emptyStateMatch[0],
      `logs?.length === 0 ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">
            <Typography variant="body1" sx={{ mb: 1 }}>No activity logs found. This could be because:</Typography>
            <ul>
              <li>There are no activities recorded yet in the system</li>
              <li>Your user role doesn't have permission to view these logs</li>
              <li>There was an error retrieving the data</li>
            </ul>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleRefresh}
                startIcon={<RefreshCw size={16} />}
              >
                Refresh Activity Logs
              </Button>
              {session?.user?.role === "SUPERADMIN" && (
                <>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/debug-logs?createSample=true');
                        if (response.ok) {
                          const result = await response.json();
                          alert(\`Created \${result.createdSampleLogs} sample logs. Refreshing...\`);
                          handleRefresh();
                        } else {
                          alert('Failed to create sample logs');
                        }
                      } catch (error) {
                        console.error("Error creating sample logs:", error);
                        alert('Error creating sample logs');
                      }
                    }}
                    startIcon={<Star size={16} />}
                  >
                    Create Test Logs
                  </Button>
                  
                  <Button
                    variant="outlined"
                    color="warning"
                    onClick={async () => {
                      try {
                        setIsLoading(true);
                        const response = await fetch('/api/debug-activity-logs');
                        if (!response.ok) {
                          throw new Error(\`Failed to fetch debug logs: \${response.status}\`);
                        }
                        
                        const data = await response.json();
                        console.log("Debug activity logs response:", data);
                        
                        if (!data.logs || !Array.isArray(data.logs)) {
                          alert('No logs found in debug mode');
                          setLogs([]);
                        } else {
                          setLogs(data.logs);
                          setTotalPages(data.meta?.totalPages || 1);
                          alert(\`Found \${data.logs.length} logs in debug mode\`);
                        }
                      } catch (error) {
                        console.error("Error fetching debug logs:", error);
                        alert(\`Error fetching debug logs: \${error.message}\`);
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    startIcon={<AlertTriangle size={16} />}
                  >
                    Debug Mode
                  </Button>
                </>
              )}
            </Box>
          </Alert>
        </Box>
      ) : (`
    );
    console.log('Updated empty state UI with debug options');
  } else {
    console.warn('Could not find empty state alert to update');
  }
} catch (e) {
  console.error('Failed to update empty state UI:', e);
}

// Ensure the useEffect for data transformation is robust
try {
  const transformEffectRegex = /useEffect\(\(\) => {[\s\S]*?if \(logs[\s\S]*?setTableData[\s\S]*?}, \[logs\]\);/;
  const transformEffectMatch = pageContent.match(transformEffectRegex);
  
  if (transformEffectMatch) {
    pageContent = pageContent.replace(
      transformEffectMatch[0],
      `useEffect(() => {
    console.log("Transform effect running. Logs count:", logs?.length);
    
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      console.log("No logs to transform");
      setTableData([]);
      return;
    }
    
    try {
      // Validate logs data structure before processing
      const validLogs = logs.filter(log => {
        if (!log || typeof log !== 'object') {
          console.warn("Invalid log entry:", log);
          return false;
        }
        return true;
      });
      
      if (validLogs.length === 0) {
        console.warn("No valid logs to display");
        setTableData([]);
        return;
      }
      
      console.log("Transforming", validLogs.length, "valid logs");
      
      const formattedData = validLogs.map(log => {
        try {
          return {
            id: log.id || \`unknown-\${Math.random()}\`,
            user: {
              name: log.user?.name || "Unknown User",
              email: log.user?.email || "No email"
            },
            action: log.action || "UNKNOWN",
            details: {
              ...(log.details || {}),
              // Keep amount as is - it can be string or number
              amount: log.details?.amount !== undefined ? log.details.amount : undefined
            },
            targetUser: log.targetUser ? {
              name: log.targetUser.name || "Unknown",
              email: log.targetUser.email || "No email"
            } : undefined,
            createdAt: log.createdAt || new Date().toISOString(),
            userAgent: log.userAgent || undefined,
            targetResourceType: log.targetResourceType || "UNKNOWN"
          };
        } catch (itemError) {
          console.error("Error processing log item:", itemError, log);
          return null;
        }
      }).filter(Boolean); // Remove any null entries
      
      console.log("Successfully transformed", formattedData.length, "entries");
      setTableData(formattedData);
    } catch (error) {
      console.error("Error in logs transformation:", error);
      setTableData([]);
    }
  }, [logs]);`
    );
    console.log('Updated transform effect with improved error handling');
  } else {
    console.warn('Could not find transform effect to update');
  }
} catch (e) {
  console.error('Failed to update transform effect:', e);
}

// Also update the effect-transform.tsx file to match the changes above
try {
  const effectTransformPath = path.join('effect-transform.tsx');
  
  if (fs.existsSync(effectTransformPath)) {
    let effectTransformContent = fs.readFileSync(effectTransformPath, 'utf8');
    
    effectTransformContent = `// Ignore this file - it's just used for copying over to the real file
// Transform logs to table data format
useEffect(() => {
  console.log("Transform effect running. Logs count:", logs?.length);
  
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    console.log("No logs to transform");
    setTableData([]);
    return;
  }
  
  try {
    // Validate logs data structure before processing
    const validLogs = logs.filter(log => {
      if (!log || typeof log !== 'object') {
        console.warn("Invalid log entry:", log);
        return false;
      }
      return true;
    });
    
    if (validLogs.length === 0) {
      console.warn("No valid logs to display");
      setTableData([]);
      return;
    }
    
    console.log("Transforming", validLogs.length, "valid logs");
    
    const formattedData = validLogs.map(log => {
      try {
        return {
          id: log.id || \`unknown-\${Math.random()}\`,
          user: {
            name: log.user?.name || "Unknown User",
            email: log.user?.email || "No email"
          },
          action: log.action || "UNKNOWN",
          details: {
            ...(log.details || {}),
            // Keep amount as is - it can be string or number
            amount: log.details?.amount !== undefined ? log.details.amount : undefined
          },
          targetUser: log.targetUser ? {
            name: log.targetUser.name || "Unknown",
            email: log.targetUser.email || "No email"
          } : undefined,
          createdAt: log.createdAt || new Date().toISOString(),
          userAgent: log.userAgent || undefined,
          targetResourceType: log.targetResourceType || "UNKNOWN"
        };
      } catch (itemError) {
        console.error("Error processing log item:", itemError, log);
        return null;
      }
    }).filter(Boolean); // Remove any null entries
    
    console.log("Successfully transformed", formattedData.length, "entries");
    setTableData(formattedData);
  } catch (error) {
    console.error("Error in logs transformation:", error);
    setTableData([]);
  }
}, [logs]);`;
    
    fs.writeFileSync(effectTransformPath, effectTransformContent);
    console.log('Updated effect-transform.tsx file');
  } else {
    console.warn('effect-transform.tsx file does not exist');
  }
} catch (e) {
  console.error('Failed to update effect-transform.tsx:', e);
}

// Save the updated activity logs page
fs.writeFileSync(pageFilePath, pageContent);
console.log('Updated activity logs page with debug mode functionality and improved error handling'); 