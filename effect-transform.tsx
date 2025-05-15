// Ignore this file - it's just used for copying over to the real file
// Transform logs to table data format
useEffect(() => {
  if (logs && Array.isArray(logs) && logs.length > 0) {
    try {
      const formattedData = logs.map(log => ({
        id: log.id || `unknown-${Math.random()}`,
        user: {
          name: log.user?.name || "Unknown",
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
      }));
      
      setTableData(formattedData);
    } catch (error) {
      console.error("Error transforming logs:", error);
      setTableData([]);
    }
  } else {
    setTableData([]);
  }
}, [logs]); 
