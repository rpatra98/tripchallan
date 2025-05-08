// Re-export types from next/server with fallbacks for better compatibility
import type { NextRequest as OriginalNextRequest, NextResponse as OriginalNextResponse } from 'next/server';

export type NextRequest = OriginalNextRequest | Request;
export type NextResponse = OriginalNextResponse | Response;

// Define interface for API route context parameters
export interface RouteContext {
  params: Record<string, string>;
} 