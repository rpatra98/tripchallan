import { NextResponse } from "next/server";
import supabase from "@/lib/supabase";

export async function GET() {
  try {
    // Test connection to Supabase
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      console.error("Ping API - Supabase connection error:", error);
      return NextResponse.json({
        status: "error",
        dbConnected: false,
        message: "Database connection failed",
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      status: "ok",
      dbConnected: true,
      message: "System is online",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Ping API error:", error);
    
    return NextResponse.json({
      status: "error",
      dbConnected: false,
      message: "System error occurred",
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 