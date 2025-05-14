import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/prisma/enums";

export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      // This is a simple handler for the root endpoint
      return NextResponse.json({
        message: "Images API. Use /api/images/[sessionId]/[imageType] to access session images."
      });
    } catch (error) {
      console.error("Error in images endpoint:", error);
      return NextResponse.json(
        { error: "An error occurred" },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 