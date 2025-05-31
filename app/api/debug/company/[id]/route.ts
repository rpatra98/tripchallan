import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const companyId = params.id;
  
  try {
    // Find the company in the database
    const company = await supabase.from('users').select('*').eq('id', companyId).single();

    // Find a company by UUID format if not found
    const companyByFormat = !company 
      ? await supabase.from('users').findFirst({
          where: {
            role: UserRole.COMPANY,
            id: {
              contains: companyId.replace(/-/g, '')
            }
          }
        })
      : null;

    // Check other database tables for any reference to this ID
    const anyReference = await supabase.from('users').findFirst({
      where: {
        id: companyId
      }
    });

    // Return detailed response
    return NextResponse.json({
      debug: {
        searchedForId: companyId,
        exactMatch: !!company,
        similarMatch: !!companyByFormat,
        anyMatch: !!anyReference
      },
      company,
      companyByFormat,
      anyReference
    });
  } catch (error) {
    console.error("Debug API error:", error);
    return NextResponse.json(
      { 
        error: "Error fetching company data",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 