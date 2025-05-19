import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { jsPDF } from 'jspdf';
import puppeteer from 'puppeteer';

// Helper function to format dates
const formatDate = (dateString: string | Date) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
};

// Generate PDF report for session
export const GET = withAuth(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      if (!context?.params?.id) {
        return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
      }

      const session = await getServerSession(authOptions);
      const userRole = session?.user.role;
      const userId = session?.user.id;
      const sessionId = context.params.id;

      // Fetch session data
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          seal: {
            include: {
              verifiedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 5,
          },
        },
      });

      if (!sessionData) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Check authorization
      if (![UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY].includes(userRole as UserRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      if (userRole === UserRole.COMPANY && userId !== sessionData.companyId) {
        return NextResponse.json(
          { error: "Unauthorized - You can only download reports for your own sessions" },
          { status: 403 }
        );
      }

      // Launch puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();

      // Set viewport size
      await page.setViewport({ width: 1200, height: 800 });

      // Create HTML content for the session details card
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .card { 
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              padding: 20px;
              margin-bottom: 20px;
            }
            .header {
              background: #1976d2;
              color: white;
              padding: 15px;
              border-radius: 8px 8px 0 0;
              margin: -20px -20px 20px -20px;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-size: 16px;
              font-weight: bold;
              color: #1976d2;
              margin-bottom: 10px;
            }
            .row {
              display: flex;
              margin-bottom: 8px;
            }
            .label {
              width: 200px;
              font-weight: bold;
              color: #666;
            }
            .value {
              flex: 1;
            }
            .status {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              color: white;
              font-size: 12px;
              font-weight: bold;
            }
            .status-COMPLETED { background: #2ecc71; }
            .status-IN_PROGRESS { background: #3498db; }
            .status-PENDING { background: #f39c12; }
            .status-REJECTED { background: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2>Session Details</h2>
              <div class="status status-${sessionData.status}">${sessionData.status.replace(/_/g, ' ')}</div>
            </div>
            
            <div class="section">
              <div class="section-title">Basic Information</div>
              <div class="row">
                <div class="label">Session ID:</div>
                <div class="value">${sessionData.id}</div>
              </div>
              <div class="row">
                <div class="label">Created At:</div>
                <div class="value">${formatDate(sessionData.createdAt)}</div>
              </div>
              <div class="row">
                <div class="label">Source:</div>
                <div class="value">${sessionData.source || 'N/A'}</div>
              </div>
              <div class="row">
                <div class="label">Destination:</div>
                <div class="value">${sessionData.destination || 'N/A'}</div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Company Information</div>
              <div class="row">
                <div class="label">Company Name:</div>
                <div class="value">${sessionData.company.name || 'N/A'}</div>
              </div>
              <div class="row">
                <div class="label">Created By:</div>
                <div class="value">${sessionData.createdBy.name || 'N/A'}</div>
              </div>
              <div class="row">
                <div class="label">Role:</div>
                <div class="value">${sessionData.createdBy.role || 'N/A'}</div>
              </div>
            </div>

            ${sessionData.tripDetails ? `
            <div class="section">
              <div class="section-title">Trip Details</div>
              ${Object.entries(sessionData.tripDetails).map(([key, value]) => `
                <div class="row">
                  <div class="label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</div>
                  <div class="value">${value || 'N/A'}</div>
                </div>
              `).join('')}
            </div>
            ` : ''}

            ${sessionData.seal ? `
            <div class="section">
              <div class="section-title">Seal Information</div>
              <div class="row">
                <div class="label">Barcode:</div>
                <div class="value">${sessionData.seal.barcode || 'N/A'}</div>
              </div>
              <div class="row">
                <div class="label">Status:</div>
                <div class="value">${sessionData.seal.verified ? 'Verified' : 'Not Verified'}</div>
              </div>
              ${sessionData.seal.verified && sessionData.seal.verifiedBy ? `
                <div class="row">
                  <div class="label">Verified By:</div>
                  <div class="value">${sessionData.seal.verifiedBy.name || 'N/A'}</div>
                </div>
                ${sessionData.seal.scannedAt ? `
                  <div class="row">
                    <div class="label">Verified At:</div>
                    <div class="value">${formatDate(sessionData.seal.scannedAt)}</div>
                  </div>
                ` : ''}
              ` : ''}
            </div>
            ` : ''}

            ${sessionData.comments?.length ? `
            <div class="section">
              <div class="section-title">Comments</div>
              ${sessionData.comments.map((comment: { user?: { name?: string }, createdAt: Date, message?: string }) => `
                <div class="row">
                  <div class="label">${comment.user?.name || 'Unknown'} (${formatDate(comment.createdAt)}):</div>
                  <div class="value">${comment.message || '(No text)'}</div>
                </div>
              `).join('')}
            </div>
            ` : ''}
          </div>
        </body>
        </html>
      `;

      // Set the HTML content
      await page.setContent(htmlContent);

      // Wait for the content to be rendered
      await page.waitForSelector('.card');

      // Take a screenshot of the card
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true
      });

      // Close the browser
      await browser.close();

      // Create PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Add the screenshot to the PDF
      doc.addImage(screenshot, 'PNG', 0, 0, 210, 297); // A4 size in mm

      // Generate PDF buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      // Create response
      const response = new NextResponse(pdfBuffer);
      response.headers.set('Content-Type', 'application/pdf');
      response.headers.set('Content-Disposition', `attachment; filename="session-${sessionId}.pdf"`);
      response.headers.set('Content-Length', pdfBuffer.length.toString());
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');

      return response;

    } catch (error: unknown) {
      console.error("Error generating PDF report:", error);
      return NextResponse.json(
        { error: "Failed to generate PDF report", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY]
); 