import { v2 as cloudinary } from 'cloudinary';

// Initialize Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

// Function to upload a file buffer to Cloudinary
export const uploadImageBuffer = async (
  buffer: Buffer, 
  folder: string,
  publicId?: string
): Promise<string> => {
  try {
    const uploadOptions: any = {
      folder: `tripchallan/${folder}`,
      resource_type: 'auto',
    };
    
    if (publicId) {
      uploadOptions.public_id = publicId;
    }
    
    // Upload as a data URI
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      ).end(buffer);
    });
    
    // Return the secure URL of the uploaded image
    return result.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw new Error('Failed to upload image to cloud storage');
  }
};

// Function to get an image URL from Cloudinary
export const getImageUrl = (
  sessionId: string,
  imageType: string,
  index?: string | number
): string => {
  const path = index !== undefined 
    ? `tripchallan/sessions/${sessionId}/${imageType}/${index}`
    : `tripchallan/sessions/${sessionId}/${imageType}`;
    
  return cloudinary.url(path, {
    secure: true,
    transformation: [
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ]
  });
};

export default cloudinary; 