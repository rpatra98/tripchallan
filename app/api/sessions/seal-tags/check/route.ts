import { NextRequest, NextResponse } from 'next/server';
import { supabase } from "@/lib/supabase";
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the tagId from the query parameters
    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get('tagId');

    if (!tagId) {
      return NextResponse.json({ error: 'Tag ID is required' }, { status: 400 });
    }

    // Check if the seal tag exists in any session
    const { data: existingSealTag, error: sealError } = await supabase
      .from('seals')
      .select('*')
      .eq('barcode', tagId)
      .single();
    
    if (sealError && !sealError.message?.includes('No rows found')) {
      console.error('Error checking seal tag:', sealError);
      return NextResponse.json({ error: 'Failed to check seal tag' }, { status: 500 });
    }

    // Return whether the tag exists
    return NextResponse.json({ exists: !!existingSealTag });
  } catch (error) {
    console.error('Error checking seal tag existence:', error);
    return NextResponse.json(
      { error: 'An error occurred while checking the seal tag' },
      { status: 500 }
    );
  }
} 