import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { UserRole, EmployeeSubrole } from '@/prisma/enums';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission to upload
    const userRole = session.user.role;
    const userSubrole = session.user.subrole;
    
    // Only operators with edit permission can upload images
    if (!(userRole === UserRole.EMPLOYEE && userSubrole === EmployeeSubrole.OPERATOR)) {
      return NextResponse.json(
        { error: "You don't have permission to upload images" },
        { status: 403 }
      );
    }

    // This is a simplified file upload handler
    // In production, you would use a service like Cloudinary, AWS S3, etc.
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

        // Validate file type    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];    if (!validTypes.includes(file.type)) {      return NextResponse.json(        { error: 'Invalid file type. Only jpeg, png, gif, and webp are allowed.' },        { status: 400 }      );    }    // Validate file size (5MB limit)    const maxSize = 5 * 1024 * 1024; // 5MB    if (file.size > maxSize) {      return NextResponse.json(        { error: 'File too large. Maximum size is 5MB.' },        { status: 400 }      );    }

    // Generate unique filename
    const uniqueId = uuidv4();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${uniqueId}.${fileExtension}`;
    const filePath = join(process.cwd(), 'public', 'uploads', fileName);

    // Convert the file to an ArrayBuffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save the file
    await writeFile(filePath, buffer);

    // Return the file URL
    const fileUrl = `/uploads/${fileName}`;
    
    return NextResponse.json({ url: fileUrl });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
} 