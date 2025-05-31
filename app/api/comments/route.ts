import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { fileToBase64 } from "@/lib/utils";

// Configure larger payload size - 10MB
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: '10mb',
  },
};

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const comments = await supabase.from('comments').select('*').{
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await supabase.from('users').select('*').eq('email', session.user.email).single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if the request is multipart/form-data (has files)
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const sessionId = formData.get("sessionId") as string;
      const message = formData.get("message") as string;
      const urgency = formData.get("urgency") as string || "NA";
      const imageFile = formData.get("image") as File | null;
      
      if (!sessionId || !message) {
        return NextResponse.json(
          { error: "Session ID and message are required" },
          { status: 400 }
        );
      }
      
      // Check if the session exists
      const existingSession = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      
      if (!existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      
      let imageUrl = null;
      
      // Process image if available
      if (imageFile) {
        try {
          // Check file size - reject if too large (>5MB)
          const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
          if (imageFile.size > MAX_FILE_SIZE) {
            return NextResponse.json(
              { error: "Image file is too large. Maximum size is 5MB." },
              { status: 413 }
            );
          }
          
          // Convert image to base64 string
          const arrayBuffer = await imageFile.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64Data = buffer.toString('base64');
          const contentType = imageFile.type;
          
          // Store image data in a format compatible with your storage solution
          // Here we're assuming you'll store the base64 data directly
          // In a production app, you'd likely upload to a cloud storage service
          imageUrl = `data:${contentType};base64,${base64Data}`;
        } catch (error) {
          console.error("Error processing image:", error);
          return NextResponse.json(
            { error: "Failed to process image" },
            { status: 500 }
          );
        }
      }
      
      // Create the comment with image if available
      const comment = await supabase.from('comments').insert( {
          sessionId,
          userId: user.id,
          message,
          imageUrl,
          urgency: urgency as any || "NA",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
      
      return NextResponse.json(comment);
    } else {
      // Handle JSON request (backward compatibility)
      const { sessionId, message, urgency = "NA" } = await req.json();
      
      if (!sessionId || !message) {
        return NextResponse.json(
          { error: "Session ID and message are required" },
          { status: 400 }
        );
      }
      
      // Check if the session exists
      const existingSession = await supabase.from('sessions').select('*').eq('id', sessionId).single();
      
      if (!existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      
      // Create the comment without image
      const comment = await supabase.from('comments').insert( {
          sessionId,
          userId: user.id,
          message,
          urgency: urgency as any || "NA",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      });
      
      return NextResponse.json(comment);
    }
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
} 