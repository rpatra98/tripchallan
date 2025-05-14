import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from 'fs';
import path from 'path';
import { UserRole } from "@/prisma/enums";

// Directory for storing uploaded files
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Check if directory exists, if not create it
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const GET = withAuth(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      const { sessionId } = context?.params || {};
      
      if (!sessionId) {
        return NextResponse.json(
          { error: "Session ID is required" },
          { status: 400 }
        );
      }
      
      // Get image type from URL
      const url = new URL(req.url);
      const pathSegments = url.pathname.split('/');
      const imageType = pathSegments[pathSegments.length - 1];

      if (!imageType || imageType === sessionId) {
        return NextResponse.json(
          { error: "Image type is required" },
          { status: 400 }
        );
      }

      // Get the session to verify it exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          company: true,
        }
      });

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Get activity log to find image metadata
      const activityLog = await prisma.activityLog.findFirst({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
          action: 'CREATE',
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (!activityLog || !activityLog.details) {
        return NextResponse.json(
          { error: "Session activity log not found" },
          { status: 404 }
        );
      }

      // Try to find the actual image file
      const imagePath = path.join(UPLOAD_DIR, sessionId, imageType);
      
      if (fs.existsSync(imagePath)) {
        const imageBuffer = fs.readFileSync(imagePath);
        
        // Determine content type (this is a simplified version)
        let contentType = 'image/jpeg';
        
        // You could check file signatures or extensions for better content type detection
        // For now, we'll use a simple approach
        
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      
      // If the file doesn't exist, return a placeholder image
      const placeholderImgPath = path.join(process.cwd(), 'public', 'file.svg'); 
      
      if (fs.existsSync(placeholderImgPath)) {
        const imageBuffer = fs.readFileSync(placeholderImgPath);
        
        // Set appropriate content type
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      
      // If placeholder not found
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    } catch (error) {
      console.error("Error serving image:", error);
      return NextResponse.json(
        { error: "Failed to serve image" },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 