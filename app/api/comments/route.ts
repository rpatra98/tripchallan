import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { fileToBase64 } from "@/lib/utils";

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

    const comments = await prisma.comment.findMany({
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

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
      const existingSession = await prisma.session.findUnique({
        where: { id: sessionId },
      });
      
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
      const comment = await prisma.comment.create({
        data: {
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
      const existingSession = await prisma.session.findUnique({
        where: { id: sessionId },
      });
      
      if (!existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      
      // Create the comment without image
      const comment = await prisma.comment.create({
        data: {
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