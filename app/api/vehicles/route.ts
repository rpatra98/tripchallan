import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { VehicleStatus } from "@/lib/enums";

// GET /api/vehicles - Retrieve vehicles for the company
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Ensure user has a company
    if (!session.user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 400 });
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as VehicleStatus | null;
    
    // Build the query
    const query: any = {
      select: '*'
    };
    
    // Apply filters if they exist
    if (status) {
      query.eq = { status };
    }
    
    if (session.user.companyId) {
      query.eq = { ...query.eq, companyId: session.user.companyId };
    }
    
    const { data: vehicles, error } = await supabase.from('vehicles').select('*').apply(query);
    
    if (error) {
      console.error('Error fetching vehicles:', error);
      return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 });
    }

    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Error fetching vehicles:", error);
    return NextResponse.json({ error: "Failed to fetch vehicles" }, { status: 500 });
  }
}

// POST /api/vehicles - Create a new vehicle
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Ensure user has a company
    if (!session.user.companyId) {
      return NextResponse.json({ error: "No company associated with user" }, { status: 400 });
    }
    
    // Check if user is an operator and has permission to create
    if (session.user.role === "EMPLOYEE" && session.user.subrole === "OPERATOR") {
      const permissions = await supabase.from('operatorPermissionss').select('*').eq('userId', session.user.id).single();
      
      if (!permissions?.canCreate) {
        return NextResponse.json({ error: "You don't have permission to create vehicles" }, { status: 403 });
      }
    }
    
    const data = await request.json();
    
    // Validate required fields
    if (!data.numberPlate) {
      return NextResponse.json({ error: "Vehicle number plate is required" }, { status: 400 });
    }
    
    // Check if vehicle with this number plate already exists
    const existingVehicle = await supabase.from('vehicles').select('*').eq('numberPlate', data.numberPlate).single();
    
    if (existingVehicle) {
      return NextResponse.json({ error: "Vehicle with this number plate already exists" }, { status: 409 });
    }
    
    // Create the vehicle
    const { data: vehicle, error: createError } = await supabase
      .from('vehicles')
      .insert({
        numberPlate: data.numberPlate,
        model: data.model || null,
        manufacturer: data.manufacturer || null,
        yearOfMake: data.yearOfMake ? parseInt(data.yearOfMake) : null,
        registrationCertificate: data.registrationCertificate || null,
        status: VehicleStatus.ACTIVE,
        companyId: session.user.companyId,
        createdById: session.user.id
      })
      .select();
    
    if (createError) {
      console.error('Error creating vehicle:', createError);
      return NextResponse.json({ error: 'Failed to create vehicle' }, { status: 500 });
    }
    
    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error("Error creating vehicle:", error);
    return NextResponse.json({ error: "Failed to create vehicle" }, { status: 500 });
  }
} 