# Cloudinary Integration for Image Storage

This document describes how images are stored and retrieved in the TripChallan application.

## Overview

The application uses different approaches for storing images based on the environment:

- **Development environment**: Images are stored in the local filesystem under the `uploads` directory.
- **Production environment**: Images are stored in Cloudinary, a cloud-based image management service.

## Configuration

To set up Cloudinary integration, you need to add the following environment variables:

```
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

You can obtain these credentials by signing up for a Cloudinary account at [cloudinary.com](https://cloudinary.com).

## Image Storage

When a user uploads images during session creation:

1. The frontend collects images from form inputs
2. Images are sent to the server as part of the form data
3. In production:
   - Images are uploaded to Cloudinary
   - The URLs are stored in the database as part of an activity log entry
4. In development:
   - Images are saved to the local filesystem

## Image Retrieval

When a request comes in to `/api/images/[sessionId]/[imageType]/[index]`:

1. In production:
   - The system first looks for stored Cloudinary URLs in the activity logs
   - If found, it redirects to the Cloudinary URL
   - If not found, it generates a Cloudinary URL based on the path pattern
   - If that fails, it falls back to a placeholder image
2. In development:
   - The system attempts to read the file from the local filesystem
   - If not found, it falls back to a placeholder image

## Implementation Details

- The Cloudinary configuration is in `lib/cloudinary.ts`
- Image upload logic is in the session creation endpoint (`app/api/sessions/route.ts`)
- Image serving logic is in the images API endpoint (`app/api/images/[...path]/route.ts`)

## Image URL Structure

Images in Cloudinary follow this structure:
- `tripchallan/sessions/[sessionId]/[imageType]` for single images
- `tripchallan/sessions/[sessionId]/[imageType]/[index]` for array-based images

Where:
- `sessionId` is the unique ID of the session
- `imageType` is one of: `gpsImei`, `vehicleNumber`, `driver`, `sealing`, `vehicle`, `additional`
- `index` is the numerical index for arrays of images (sealing, vehicle, additional)

## Troubleshooting

If images are not displaying correctly:

1. Check that Cloudinary credentials are set correctly in environment variables
2. Verify that images were successfully uploaded (check activity logs)
3. Ensure that the URLs generated match the expected Cloudinary structure
4. Check the browser console and server logs for errors 