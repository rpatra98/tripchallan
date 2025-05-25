"use client";

import { useState, useCallback, useEffect } from 'react';

export default function useSessionSeals(sessionId: string) {
  const [sessionSeals, setSessionSeals] = useState<any[]>([]);
  const [loadingSeals, setLoadingSeals] = useState(false);
  const [sealsError, setSealsError] = useState("");
  
  // Function to fetch session seals
  const fetchSessionSeals = useCallback(async () => {
    if (!sessionId) return;
    
    setLoadingSeals(true);
    setSealsError("");
    
    try {
      console.log("Fetching seals for session ID:", sessionId);
      const response = await fetch(`/api/sessions/${sessionId}/seals`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`API Error (${response.status}):`, errorData);
        throw new Error(`Failed to fetch session seals: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }
      
      const data = await response.json();
      console.log("Session seals received:", data);
      setSessionSeals(data);
    } catch (err) {
      console.error("Error fetching session seals:", err);
      setSealsError(err instanceof Error ? err.message : "Failed to fetch seals");
    } finally {
      setLoadingSeals(false);
    }
  }, [sessionId]);
  
  // Fetch seals on mount and when sessionId changes
  useEffect(() => {
    if (sessionId) {
      fetchSessionSeals();
    }
  }, [sessionId, fetchSessionSeals]);
  
  return {
    sessionSeals,
    loadingSeals,
    sealsError,
    fetchSessionSeals
  };
} 