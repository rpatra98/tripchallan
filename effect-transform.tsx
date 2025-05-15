"use client";

import { useState, useEffect } from 'react';
import { ActivityLog, ActivityLogRow } from './app/dashboard/activity-logs/types';

/**
 * Custom hook to transform activity logs into table-friendly format
 */
export const useTransformLogs = (logs: ActivityLog[] | null | undefined) => {
  const [tableData, setTableData] = useState<ActivityLogRow[]>([]);

  useEffect(() => {
    console.log("Transform effect running. Logs count:", logs?.length || 0);
    
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      console.log("No logs to transform");
      setTableData([]);
      return;
    }
    
    try {
      const formattedData = logs.map(log => ({
        id: log.id || `unknown-${Math.random()}`,
        user: {
          name: log.user?.name || "Unknown User",
          email: log.user?.email || "No email"
        },
        action: log.action || "UNKNOWN",
        details: log.details || {},
        targetUser: log.targetUser ? {
          name: log.targetUser.name || "Unknown",
          email: log.targetUser.email || "No email"
        } : undefined,
        createdAt: log.createdAt || new Date().toISOString(),
        userAgent: log.userAgent || undefined,
        targetResourceType: log.targetResourceType || "UNKNOWN"
      }));
      
      console.log("Transformed data:", formattedData.length, "items");
      setTableData(formattedData);
    } catch (error) {
      console.error("Error transforming logs:", error);
      setTableData([]);
    }
  }, [logs]);

  return { tableData, setTableData };
};

export default useTransformLogs;