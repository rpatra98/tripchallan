// Ignore this file - it's just used for copying over to the real file
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
        const transformed = {
          id: log.id || `unknown-${Math.random()}`,
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
        
        console.log("Transformed log:", log.id, "->", transformed.action);
        return transformed;
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
}, [logs]);