"use client";

import { useState, useEffect, useMemo, useContext } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  InputAdornment,
  IconButton,
  FormHelperText,
  Chip
} from "@mui/material";
import { 
  ArrowBack, 
  ArrowForward, 
  PhotoCamera, 
  QrCode 
} from "@mui/icons-material";
import Link from "next/link";
import { EmployeeSubrole } from "@/prisma/enums";
import { SessionUpdateContext } from "@/app/dashboard/layout";
import ClientSideQrScanner from "@/app/components/ClientSideQrScanner";
import SimpleQrScanner from "@/app/components/SimpleQrScanner";

type CompanyType = {
  id: string;
  name: string;
};

type LoadingDetailsForm = {
  transporterName: string;
  materialName: string;
  receiverPartyName: string;
  vehicleNumber: string;
  gpsImeiNumber: string;
  driverName: string;
  driverContactNumber: string;
  loadingSite: string;
  loaderName: string;
  challanRoyaltyNumber: string;
  doNumber: string;
  freight: number;
  qualityOfMaterials: string;
  tpNumber: string;
  grossWeight: number;
  tareWeight: number;
  netMaterialWeight: number;
  loaderMobileNumber: string;
  timestamps: Record<string, string>;
};

type SealTagsForm = {
  sealTagIds: string[];
  sealTagScanned: boolean;
  manualSealTagId: string;
  timestamps: Record<string, string>;
};

type ImagesForm = {
  gpsImeiPicture: File | null;
  vehicleNumberPlatePicture: File | null;
  driverPicture: File | null;
  sealingImages: File[];
  vehicleImages: File[];
  additionalImages: File[];
  qrCodeData: string;
  manualQrData: string;
  scannedCodes: string[];
  qrCodeImage: File | null;
  timestamps: Record<string, string>;
};

// const FileUploadHelp = () => (
//   <Box sx={{ mt: 1, mb: 2, p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
//     <Typography variant="body2" color="info.contrastText">
//       <strong>File Upload Tips:</strong>
//       <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
//         <li>Maximum file size: 5MB per image</li>
//         <li>Maximum 5 images per category</li>
//         <li>Reduce image size before uploading to avoid errors</li>
//         <li>Recommended image resolution: 1280x960 or smaller</li>
//       </ul>
//     </Typography>
//   </Box>
// );

const ImageProcessingInfo = () => (
  <Box sx={{ mt: 2, mb: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
    <Typography variant="body2" color="success.contrastText">
      <strong>Improved Image Storage:</strong> Images are automatically compressed and stored securely in the database. 
      This ensures they will always display correctly on all devices, even when viewing past trips.
    </Typography>
  </Box>
);

// const ImageErrorDisplay = ({ show }: { show: boolean }) => {
//   if (!show) return null;
  
//   return (
//     <Box sx={{ mt: 2, mb: 3, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
//       <Typography variant="subtitle2" color="error.contrastText" gutterBottom>
//         <strong>Image Upload Requirements:</strong>
//       </Typography>
//       <Typography variant="body2" component="div" color="error.contrastText">
//         <ul style={{ marginTop: '8px', paddingLeft: '20px', marginBottom: '4px' }}>
//           <li>Each image must be smaller than 5MB</li>
//           <li>Total upload size must be under 20MB</li>
//           <li>Maximum 5 images per category</li>
//           <li>Recommended resolution: 1280x960 or smaller</li>
//           <li>Try reducing image quality if needed</li>
//         </ul>
//       </Typography>
//       <Typography variant="body2" color="error.contrastText" sx={{ mt: 1 }}>
//         If you're having trouble, try using the camera at a lower resolution or use an image compression app before uploading.
//       </Typography>
//     </Box>
//   );
// };

// Convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

async function resizeImage(file: File, maxWidth = 1280, maxHeight = 1280, quality = 0.8/*, maxSizeInMB = 2*/): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Calculate the new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * maxHeight / height);
            height = maxHeight;
          }
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with quality setting
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob conversion failed'));
            return;
          }
          
          // // Check if the size is still too large
          // if (blob.size > maxSizeInMB * 1024 * 1024) { // This line and the block below should be commented
          //   // If still too large, try with lower quality
          //   if (quality > 0.4) {
          //     resizeImage(file, maxWidth, maxHeight, quality - 0.1 /*, maxSizeInMB*/) // maxSizeInMB commented
          //       .then(resolve)
          //       .catch(reject);
          //   } else {
          //     // Reduce dimensions further if quality reduction isn't enough
          //     resizeImage(file, Math.round(maxWidth * 0.7), Math.round(maxHeight * 0.7), 0.6 /*, maxSizeInMB*/) // maxSizeInMB commented
          //       .then(resolve)
          //       .catch(reject);
          //   }
          //   return;
          // }
          
          // Convert blob to file
          const resizedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          
          resolve(resizedFile);
        }, 'image/jpeg', quality);
      };
      img.onerror = (error) => {
        reject(error);
      };
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
}

export default function CreateSessionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Step 1: Seal Tags (now the first step)
  const [sealTags, setSealTags] = useState<SealTagsForm>({
    sealTagIds: [],
    sealTagScanned: false,
    manualSealTagId: "",
    timestamps: {}
  });
  
  // Step 2: Loading Details (now the second step)
  const [loadingDetails, setLoadingDetails] = useState<LoadingDetailsForm>({
    transporterName: "",
    materialName: "",
    receiverPartyName: "",
    vehicleNumber: "",
    gpsImeiNumber: "",
    driverName: "",
    driverContactNumber: "",
    loadingSite: "",
    loaderName: "",
    challanRoyaltyNumber: "",
    doNumber: "",
    freight: 0,
    qualityOfMaterials: "",
    tpNumber: "",
    grossWeight: 0,
    tareWeight: 0,
    netMaterialWeight: 0,
    loaderMobileNumber: "",
    timestamps: {}
  });

  // Step 3: Images & Verification
  const [imagesForm, setImagesForm] = useState<ImagesForm>({
    gpsImeiPicture: null,
    vehicleNumberPlatePicture: null,
    driverPicture: null,
    sealingImages: [],
    vehicleImages: [],
    additionalImages: [],
    qrCodeData: "",
    manualQrData: "",
    scannedCodes: [],
    qrCodeImage: null,
    timestamps: {}
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Calculate net weight automatically
  useEffect(() => {
    if (loadingDetails.grossWeight && loadingDetails.tareWeight) {
      const netWeight = loadingDetails.grossWeight - loadingDetails.tareWeight;
      setLoadingDetails(prev => ({
        ...prev,
        netMaterialWeight: netWeight > 0 ? netWeight : 0,
        timestamps: {
          ...prev.timestamps,
          netMaterialWeight: new Date().toISOString()
        }
      }));
    }
  }, [loadingDetails.grossWeight, loadingDetails.tareWeight]);

  useEffect(() => {
    // Check if user is an operator
    if (status === "authenticated" && session?.user) {
      if (
        session.user.role !== "EMPLOYEE" || 
        session.user.subrole !== EmployeeSubrole.OPERATOR
      ) {
        router.push("/dashboard");
      } else {
        // Check if operator has permission to create sessions
        fetch('/api/employees/' + session.user.id + '/permissions')
          .then(response => response.json())
          .then(data => {
            if (!data.canCreate) {
              setError("You don't have permission to create new trips. Please contact your administrator.");
              setTimeout(() => {
                router.push("/dashboard");
              }, 3000);
            }
          })
          .catch(err => {
            console.error("Error fetching permissions:", err);
          });
      }
    }
  }, [status, session, router]);

  // Get user coin balance
  const [userCoins, setUserCoins] = useState<number | null>(null);
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      fetch('/api/users/' + session.user.id)
        .then(response => response.json())
        .then(data => {
          if (data && typeof data.coins === 'number') {
            setUserCoins(data.coins);
          }
        })
        .catch(err => {
          console.error("Error fetching user data:", err);
        });
    }
  }, [status, session]);

  const handleLoadingDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLoadingDetails(prev => ({
      ...prev,
      [name]: value,
      timestamps: {
        ...prev.timestamps,
        [name]: new Date().toISOString()
      }
    }));
    
    // Clear validation error when field is modified
    if (validationErrors[name]) {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: keyof ImagesForm) => {
    if (!e.target.files?.length) return;
    
    // // Maximum file size: 5MB
    // const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes
    
    if (fieldName === 'sealingImages' || fieldName === 'vehicleImages' || fieldName === 'additionalImages') {
      // Filter out files that are too large
      const filesArray = Array.from(e.target.files)/*.filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          setValidationErrors(prev => ({
            ...prev,
            [fieldName]: `One or more files exceed the maximum size of 5MB. Please use smaller images.`
          }));
          return false;
        }
        return true;
      })*/;
      
      if (filesArray.length > 0) {
        setImagesForm(prev => ({
          ...prev,
          [fieldName]: [...prev[fieldName] as File[], ...filesArray],
          timestamps: {
            ...prev.timestamps,
            [fieldName]: new Date().toISOString()
          }
        }));
      }
    } else {
      // Check single file size
      const file = e.target.files[0];
      // if (file.size > MAX_FILE_SIZE) {
      //   setValidationErrors(prev => ({
      //     ...prev,
      //     [fieldName]: `File is too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is 5MB.`
      //   }));
      //   return;
      // }
      
      setImagesForm(prev => ({
        ...prev,
        [fieldName]: file,
        timestamps: {
          ...prev.timestamps,
          [fieldName]: new Date().toISOString()
        }
      }));
    }
    
    // Clear validation error when file is uploaded
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const newErrors = {...prev};
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  const handleAddQrCode = () => {
    if (imagesForm.manualQrData) {
      setImagesForm(prev => ({
        ...prev,
        scannedCodes: [...prev.scannedCodes, prev.manualQrData],
        manualQrData: "",
        timestamps: {
          ...prev.timestamps,
          scannedCodes: new Date().toISOString()
        }
      }));
    }
  };

  // Add a handler for adding seal tags
  const handleAddSealTag = () => {
    if (!sealTags.manualSealTagId) return;
    
    // Check if tag is already in the list
    if (sealTags.sealTagIds.includes(sealTags.manualSealTagId)) {
      setError("Tag ID already used");
      setTimeout(() => setError(""), 3000);
      return;
    }
    
    setSealTags(prev => ({
      ...prev,
      sealTagIds: [...prev.sealTagIds, prev.manualSealTagId],
      manualSealTagId: "",
      timestamps: {
        ...prev.timestamps,
        [prev.manualSealTagId]: new Date().toISOString()
      }
    }));
  };

  // Handle removing a seal tag
  const handleRemoveSealTag = (tagId: string) => {
    setSealTags(prev => {
      const updatedSealTagIds = prev.sealTagIds.filter(id => id !== tagId);
      const { [tagId]: _, ...updatedTimestamps } = prev.timestamps;
      
      return {
        ...prev,
        sealTagIds: updatedSealTagIds,
        timestamps: updatedTimestamps
      };
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (step === 0) {
      // Validate Seal Tags
      if (sealTags.sealTagIds.length === 0) {
        newErrors.sealTagIds = "At least one seal tag ID is required";
      }
      
      if (sealTags.sealTagIds.length > 40) {
        newErrors.sealTagIds = "Maximum of 40 seal tags allowed";
      }
      
      // Check for minimum number of tags (minimum 20 required)
      if (sealTags.sealTagIds.length < 20) {
        newErrors.sealTagIds = "Minimum of 20 seal tags required";
      }
    } else if (step === 1) {
      // Validate Loading Details
      if (!loadingDetails.transporterName.trim()) {
        newErrors.transporterName = "Transporter name is required";
      }
      
      if (!loadingDetails.materialName.trim()) {
        newErrors.materialName = "Material name is required";
      }
      
      if (!loadingDetails.receiverPartyName.trim()) {
        newErrors.receiverPartyName = "Receiver party name is required";
      }
      
      if (!loadingDetails.vehicleNumber.trim()) {
        newErrors.vehicleNumber = "Vehicle number is required";
      }
      
      if (!loadingDetails.gpsImeiNumber) {
        newErrors.gpsImeiNumber = "GPS IMEI number is required";
      }
      
      if (!loadingDetails.driverName.trim()) {
        newErrors.driverName = "Driver name is required";
      }
      
      if (!loadingDetails.driverContactNumber.trim()) {
        newErrors.driverContactNumber = "Driver contact number is required";
      } else if (!/^\d{10}$/.test(loadingDetails.driverContactNumber)) {
        newErrors.driverContactNumber = "Contact number must be 10 digits";
      }
      
      if (!loadingDetails.loadingSite.trim()) {
        newErrors.loadingSite = "Loading site is required";
      }
      
      if (!loadingDetails.loaderName.trim()) {
        newErrors.loaderName = "Loader name is required";
      }
      
      if (!loadingDetails.challanRoyaltyNumber.trim()) {
        newErrors.challanRoyaltyNumber = "Challan royalty number is required";
      }
      
      if (!loadingDetails.doNumber.trim()) {
        newErrors.doNumber = "DO number is required";
      }
      
      if (loadingDetails.freight <= 0) {
        newErrors.freight = "Freight must be greater than zero";
      }
      
      if (!loadingDetails.tpNumber.trim()) {
        newErrors.tpNumber = "TP number is required";
      }
      
      if (loadingDetails.grossWeight <= 0) {
        newErrors.grossWeight = "Gross weight must be greater than zero";
      }
      
      if (loadingDetails.tareWeight <= 0) {
        newErrors.tareWeight = "Tare weight must be greater than zero";
      }
      
      if (!loadingDetails.loaderMobileNumber.trim()) {
        newErrors.loaderMobileNumber = "Loader mobile number is required";
      } else if (!/^\d{10}$/.test(loadingDetails.loaderMobileNumber)) {
        newErrors.loaderMobileNumber = "Mobile number must be 10 digits";
      }
    } else if (step === 2) {
      // Validate Images & Verification
      if (!imagesForm.gpsImeiPicture) newErrors.gpsImeiPicture = "GPS IMEI picture is required";
      if (!imagesForm.vehicleNumberPlatePicture) newErrors.vehicleNumberPlatePicture = "Vehicle number plate picture is required";
      if (!imagesForm.driverPicture) newErrors.driverPicture = "Driver's picture is required";
      if (imagesForm.sealingImages.length === 0) newErrors.sealingImages = "At least one sealing image is required";
      if (imagesForm.vehicleImages.length === 0) newErrors.vehicleImages = "At least one vehicle image is required";
    }
    
    setValidationErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prevStep => prevStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateStep(activeStep)) {
      return;
    }
    
    // // Validate image size and count before proceeding
    // const validation = validateImageSizeAndCount(
    //   imagesForm.gpsImeiPicture,
    //   imagesForm.vehicleNumberPlatePicture,
    //   imagesForm.driverPicture,
    //   imagesForm.sealingImages,
    //   imagesForm.vehicleImages,
    //   imagesForm.additionalImages
    // );
    
    // if (!validation.valid) {
    //   setError(validation.message);
    //   setErrorDetails(validation.details);
    //   return;
    // }
    
    setError("");
    setErrorDetails("");
    setIsSubmitting(true);

    try {
      // Create form data to handle file uploads
      const formData = new FormData();
      
      // Add loading details
      Object.entries(loadingDetails).forEach(([key, value]) => {
        if (key !== 'timestamps') {
          formData.append(key, String(value));
        }
      });
      
      // Add timestamps for loading details
      formData.append('loadingDetailsTimestamps', JSON.stringify(loadingDetails.timestamps));
      
      // Add seal tags data
      formData.append('sealTagIds', JSON.stringify(sealTags.sealTagIds));
      formData.append('sealTagTimestamps', JSON.stringify(sealTags.timestamps));
      
      // Prepare base64 image data
      const imageBase64Data: Record<string, any> = {};
      
      // Convert individual images to base64
      if (imagesForm.gpsImeiPicture) {
        try {
          // Resize the image first
          const resizedImage = await resizeImage(imagesForm.gpsImeiPicture, 1280, 1280, 0.8/*, 2*/);
          const base64Data = await fileToBase64(resizedImage);
          imageBase64Data.gpsImeiPicture = {
            data: base64Data.split(',')[1], // Remove data URL prefix
            contentType: resizedImage.type,
            name: resizedImage.name
          };
          formData.append('gpsImeiPicture', resizedImage);
        } catch (error) {
          console.error("Error processing GPS IMEI image:", error);
          setError("Error processing GPS IMEI image. Please try again."); // Generic error
          // setErrorDetails("Images need to be under 5MB each, and the total size of all images should be under 20MB.");
          setIsSubmitting(false);
          return;
        }
      }
      
      if (imagesForm.vehicleNumberPlatePicture) {
        try {
          const resizedImage = await resizeImage(imagesForm.vehicleNumberPlatePicture, 1280, 1280, 0.8/*, 2*/);
          const base64Data = await fileToBase64(resizedImage);
          imageBase64Data.vehicleNumberPlatePicture = {
            data: base64Data.split(',')[1],
            contentType: resizedImage.type,
            name: resizedImage.name
          };
          formData.append('vehicleNumberPlatePicture', resizedImage);
        } catch (error) {
          console.error("Error processing vehicle number plate image:", error);
          setError("Error processing vehicle number plate image. Please try again."); // Generic error
          // setErrorDetails("Images need to be under 5MB each, and the total size of all images should be under 20MB.");
          setIsSubmitting(false);
          return;
        }
      }
      
      if (imagesForm.driverPicture) {
        try {
          const resizedImage = await resizeImage(imagesForm.driverPicture, 1280, 1280, 0.8/*, 2*/);
          const base64Data = await fileToBase64(resizedImage);
          imageBase64Data.driverPicture = {
            data: base64Data.split(',')[1],
            contentType: resizedImage.type,
            name: resizedImage.name
          };
          formData.append('driverPicture', resizedImage);
        } catch (error) {
          console.error("Error processing driver picture:", error);
          setError("Error processing driver picture. Please try again."); // Generic error
          // setErrorDetails("Images need to be under 5MB each, and the total size of all images should be under 20MB.");
          setIsSubmitting(false);
          return;
        }
      }
      
      // Process array images
      imageBase64Data.sealingImages = [];
      imageBase64Data.vehicleImages = [];
      imageBase64Data.additionalImages = [];
      
      // Add multiple files - limit the number of files to reduce payload size
      const maxImagesPerCategory = 5; // Limit to 5 images per category
      
      // Process sealing images
      for (let i = 0; i < Math.min(imagesForm.sealingImages.length, maxImagesPerCategory); i++) {
        try {
          const file = imagesForm.sealingImages[i];
          const resizedImage = await resizeImage(file, 1280, 1280, 0.8/*, 2*/);
          const base64Data = await fileToBase64(resizedImage);
          imageBase64Data.sealingImages.push({
            data: base64Data.split(',')[1],
            contentType: resizedImage.type,
            name: resizedImage.name
          });
          formData.append(`sealingImages[${i}]`, resizedImage);
        } catch (error) {
          console.error(`Error processing sealing image ${i}:`, error);
          setError(`Error processing sealing image ${i}. Please try again.`); // Generic error
          // setErrorDetails("Images need to be under 5MB each, and the total size of all images should be under 20MB.");
          setIsSubmitting(false);
          return;
        }
      }
      
      // Process vehicle images
      for (let i = 0; i < Math.min(imagesForm.vehicleImages.length, maxImagesPerCategory); i++) {
        try {
          const file = imagesForm.vehicleImages[i];
          const resizedImage = await resizeImage(file, 1280, 1280, 0.8/*, 2*/);
          const base64Data = await fileToBase64(resizedImage);
          imageBase64Data.vehicleImages.push({
            data: base64Data.split(',')[1],
            contentType: resizedImage.type,
            name: resizedImage.name
          });
          formData.append(`vehicleImages[${i}]`, resizedImage);
        } catch (error) {
          console.error(`Error processing vehicle image ${i}:`, error);
          setError(`Error processing vehicle image ${i}. Please try again.`); // Generic error
          // setErrorDetails("Images need to be under 5MB each, and the total size of all images should be under 20MB.");
          setIsSubmitting(false);
          return;
        }
      }
      
      // Process additional images
      for (let i = 0; i < Math.min(imagesForm.additionalImages.length, maxImagesPerCategory); i++) {
        try {
          const file = imagesForm.additionalImages[i];
          const resizedImage = await resizeImage(file, 1280, 1280, 0.8/*, 2*/);
          const base64Data = await fileToBase64(resizedImage);
          imageBase64Data.additionalImages.push({
            data: base64Data.split(',')[1],
            contentType: resizedImage.type,
            name: resizedImage.name
          });
          formData.append(`additionalImages[${i}]`, resizedImage);
        } catch (error) {
          console.error(`Error processing additional image ${i}:`, error);
          setError(`Error processing additional image ${i}. Please try again.`); // Generic error
          // setErrorDetails("Images need to be under 5MB each, and the total size of all images should be under 20MB.");
          setIsSubmitting(false);
          return;
        }
      }
      
      // Add the base64 image data to the form
      formData.append('imageBase64Data', JSON.stringify(imageBase64Data));
      
      // Add QR code data
      formData.append('scannedCodes', JSON.stringify(imagesForm.scannedCodes));
      
      // Add timestamps for images form
      formData.append('imagesFormTimestamps', JSON.stringify(imagesForm.timestamps));

      // Send the request without Content-Type header to allow browser to set correct boundary for FormData
      const response = await fetch("/api/sessions", {
        method: "POST",
        body: formData,
        // Do not set Content-Type header as browser will set it automatically for FormData
      });

      // Handle different error response types
      if (!response.ok) {
        // For 413 Payload Too Large errors
        // if (response.status === 413) {
        //   throw new Error("Files are too large. Please use smaller images (under 5MB each) or fewer images.");
        // }
        
        // Try to parse the error as JSON
        let errorData;
        try {
          errorData = await response.json();
          let mainError = errorData.error || "Failed to create trip";
          let detailsError = "";
          
          // Extract the main error from potentially longer message
          if (mainError.includes(":")) {
            const parts = mainError.split(":");
            mainError = parts[0].trim();
            detailsError = parts.slice(1).join(":").trim();
          }
          
          throw new Error(mainError, { cause: detailsError });
        } catch (jsonError) {
          // If we can't parse JSON, use the status text
          if (response.status === 500) {
            throw new Error("Server error: Could not process the request.", 
              { cause: "An unexpected error occurred on the server. Please check server logs for details or try again later." });
          } else {
            throw new Error(`Server error: ${response.status} ${response.statusText}.`, 
              { cause: "An unexpected server error occurred." });
          }
        }
      }
      
      const data = await response.json();

      // Refresh the user session to update coin balance
      await refreshUserSession();

      // Redirect to the sessions page on success
      router.push("/dashboard/sessions");
    } catch (err) {
      const error = err as Error;
      console.error("Error submitting form:", error);
      setError(error.message || "An unknown error occurred");
      
      // Check if we have detailed error information
      // if (error.cause) {
      //   setErrorDetails(error.cause as string);
      // } // else if (error.message.includes("smaller images") || error.message.includes("too large")) {
        // setErrorDetails("Try reducing image size or using fewer images. Each image should be under 5MB, and total upload should be under 20MB.");
      } finally {
      setIsSubmitting(false);
    }
  };

  const steps = ['Seal Tags', 'Loading Details', 'Images & Verification'];

  // Add these new state variables for QR scanning
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTitle, setScannerTitle] = useState("Scan QR/Barcode");
  const [scannerType, setScannerType] = useState<"sealTag" | "qrCode">("sealTag");

  // Function to handle QR scan result
  const handleScanComplete = (data: string) => {
    if (scannerType === "sealTag") {
      // Check if already scanned
      if (sealTags.sealTagIds.includes(data)) {
        setError("Tag ID already used");
        setTimeout(() => setError(""), 3000);
        return;
      }
      
      setSealTags(prev => ({
        ...prev,
        sealTagIds: [...prev.sealTagIds, data],
        timestamps: {
          ...prev.timestamps,
          [data]: new Date().toISOString()
        }
      }));
    } else if (scannerType === "qrCode") {
      if (!imagesForm.scannedCodes.includes(data)) {
        setImagesForm(prev => ({
          ...prev,
          scannedCodes: [...prev.scannedCodes, data],
          timestamps: {
            ...prev.timestamps,
            scannedCodes: new Date().toISOString()
          }
        }));
      }
    }
  };

  // Open camera scanner
  const openScanner = (type: "sealTag" | "qrCode") => {
    setScannerType(type);
    setScannerTitle(type === "sealTag" ? "Scan Seal Tag" : "Scan QR Code");
    setScannerOpen(true);
  };

  // Close camera scanner
  const closeScanner = () => {
    setScannerOpen(false);
  };

  if (status === "loading") {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box mb={3}>
        <Button
          component={Link}
          href="/dashboard/sessions"
          startIcon={<ArrowBack />}
        >
          Back to Sessions
        </Button>
      </Box>

      {/* QR scanner component has been integrated directly in the button below */}

      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Create New Trip
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography fontWeight="medium">
              {error}
            </Typography>
            {errorDetails && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                {errorDetails}
              </Typography>
            )}
          </Alert>
        )}
        
        {/* <ImageErrorDisplay show={!!error && (error.includes("image") || error.includes("large") || errorDetails.includes("image") || errorDetails.includes("MB"))} /> */}

        {/* Coin notice */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography fontWeight="medium">
            Creating a new session costs 1 coin from your balance.
            {userCoins !== null && (
              <> Your current balance: <strong>{userCoins} {userCoins === 1 ? 'coin' : 'coins'}</strong>.</>
            )}
            {userCoins !== null && userCoins < 1 && (
              <Box mt={1}>
                <Typography color="error" fontWeight="bold">
                  You don't have enough coins to create a session. Please contact an administrator to allocate more coins.
                </Typography>
              </Box>
            )}
          </Typography>
        </Alert>

        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={handleSubmit}>
          {activeStep === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Seal Tags
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Scan or manually enter seal tags. A minimum of 20 seal tags is required. Each tag must be unique and will be registered to this session.
                </Typography>
                
                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                  </Alert>
                )}
              </Box>
              
              <Box sx={{ width: '100%', display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Scan QR/Barcode
                  </Typography>
                  <ClientSideQrScanner
                    onScan={(data) => {
                      // Check if already scanned
                      if (sealTags.sealTagIds.includes(data)) {
                        setError("Tag ID already used");
                        setTimeout(() => setError(""), 3000);
                        return;
                      }
                      
                      setSealTags(prev => ({
                        ...prev,
                        sealTagIds: [...prev.sealTagIds, data],
                        timestamps: {
                          ...prev.timestamps,
                          [data]: new Date().toISOString()
                        }
                      }));
                    }}
                    buttonText="Scan QR Code"
                    scannerTitle="Scan Seal Tag"
                    buttonVariant="outlined"
                  />
                </Box>
                
                <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Manual Entry
                  </Typography>
                  <TextField
                    fullWidth
                    label="Seal Tag ID"
                    value={sealTags.manualSealTagId}
                    onChange={(e) => setSealTags(prev => ({
                      ...prev,
                      manualSealTagId: e.target.value
                    }))}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button 
                            onClick={handleAddSealTag} 
                            disabled={!sealTags.manualSealTagId}
                          >
                            Add
                          </Button>
                        </InputAdornment>
                      ),
                    }}
                    error={!!validationErrors.sealTagIds}
                    helperText={validationErrors.sealTagIds}
                  />
                </Box>
              </Box>
              
              <Box sx={{ width: '100%' }}>
                <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Registered Seal Tags: {sealTags.sealTagIds.length}</span>
                  {validationErrors.sealTagMinCount && (
                    <Typography variant="caption" color="warning.main">
                      {validationErrors.sealTagMinCount}
                    </Typography>
                  )}
                </Typography>
                
                {sealTags.sealTagIds.length > 0 ? (
                  <Box sx={{ 
                    mt: 1, 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    borderRadius: 1,
                    maxHeight: '300px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1
                  }}>
                    {sealTags.sealTagIds.map((tagId, index) => (
                      <Chip
                        key={tagId}
                        label={`${index + 1}. ${tagId}`}
                        onDelete={() => handleRemoveSealTag(tagId)}
                        sx={{ mb: 1 }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                    No seal tags registered yet. Scan or manually enter seal tags above.
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {activeStep === 1 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Loading Details
                </Typography>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Transporter Name"
                  name="transporterName"
                  value={loadingDetails.transporterName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.transporterName}
                  helperText={validationErrors.transporterName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Material Name"
                  name="materialName"
                  value={loadingDetails.materialName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.materialName}
                  helperText={validationErrors.materialName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Receiver Party Name"
                  name="receiverPartyName"
                  value={loadingDetails.receiverPartyName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.receiverPartyName}
                  helperText={validationErrors.receiverPartyName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Vehicle Number"
                  name="vehicleNumber"
                  value={loadingDetails.vehicleNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  placeholder="MH02AB1234"
                  error={!!validationErrors.vehicleNumber}
                  helperText={validationErrors.vehicleNumber || "Format: MH02AB1234"}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="GPS IMEI Number"
                  name="gpsImeiNumber"
                  value={loadingDetails.gpsImeiNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  error={!!validationErrors.gpsImeiNumber}
                  helperText={validationErrors.gpsImeiNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Driver Name"
                  name="driverName"
                  value={loadingDetails.driverName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.driverName}
                  helperText={validationErrors.driverName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Driver Contact Number"
                  name="driverContactNumber"
                  value={loadingDetails.driverContactNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="tel"
                  inputProps={{ maxLength: 10 }}
                  error={!!validationErrors.driverContactNumber}
                  helperText={validationErrors.driverContactNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Loading Site"
                  name="loadingSite"
                  value={loadingDetails.loadingSite}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.loadingSite}
                  helperText={validationErrors.loadingSite}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Loader Name"
                  name="loaderName"
                  value={loadingDetails.loaderName}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.loaderName}
                  helperText={validationErrors.loaderName}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Loader Mobile Number"
                  name="loaderMobileNumber"
                  value={loadingDetails.loaderMobileNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="tel"
                  inputProps={{ maxLength: 10 }}
                  error={!!validationErrors.loaderMobileNumber}
                  helperText={validationErrors.loaderMobileNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Challan Royalty Number"
                  name="challanRoyaltyNumber"
                  value={loadingDetails.challanRoyaltyNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.challanRoyaltyNumber}
                  helperText={validationErrors.challanRoyaltyNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="DO Number"
                  name="doNumber"
                  value={loadingDetails.doNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.doNumber}
                  helperText={validationErrors.doNumber}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Freight"
                  name="freight"
                  value={loadingDetails.freight}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₹</InputAdornment>,
                  }}
                  error={!!validationErrors.freight}
                  helperText={validationErrors.freight}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Quality of Materials"
                  name="qualityOfMaterials"
                  value={loadingDetails.qualityOfMaterials}
                  onChange={handleLoadingDetailsChange}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="TP Number"
                  name="tpNumber"
                  value={loadingDetails.tpNumber}
                  onChange={handleLoadingDetailsChange}
                  required
                  error={!!validationErrors.tpNumber}
                  helperText={validationErrors.tpNumber}
                />
              </Box>

              <Box sx={{ width: { xs: '100%', md: '31%' } }}>
                <TextField
                  fullWidth
                  label="Gross Weight (kg)"
                  name="grossWeight"
                  value={loadingDetails.grossWeight}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  error={!!validationErrors.grossWeight}
                  helperText={validationErrors.grossWeight}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '31%' } }}>
                <TextField
                  fullWidth
                  label="Tare Weight (kg)"
                  name="tareWeight"
                  value={loadingDetails.tareWeight}
                  onChange={handleLoadingDetailsChange}
                  required
                  type="number"
                  error={!!validationErrors.tareWeight}
                  helperText={validationErrors.tareWeight}
                />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '31%' } }}>
                <TextField
                  fullWidth
                  label="Net Material Weight (kg)"
                  value={loadingDetails.netMaterialWeight}
                  InputProps={{
                    readOnly: true,
                  }}
                  disabled
                />
              </Box>
            </Box>
          )}

          {activeStep === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography variant="h6" gutterBottom>
                  Images & Verification
                </Typography>
                {/* <FileUploadHelp /> */}
                <ImageProcessingInfo />
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload GPS IMEI Picture
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {imagesForm.gpsImeiPicture ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'gpsImeiPicture')}
                  />
                </Button>
                {imagesForm.gpsImeiPicture && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.gpsImeiPicture.name}
                  </Typography>
                )}
                {validationErrors.gpsImeiPicture && (
                  <FormHelperText error>{validationErrors.gpsImeiPicture}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Vehicle Number Plate
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {imagesForm.vehicleNumberPlatePicture ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'vehicleNumberPlatePicture')}
                  />
                </Button>
                {imagesForm.vehicleNumberPlatePicture && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.vehicleNumberPlatePicture.name}
                  </Typography>
                )}
                {validationErrors.vehicleNumberPlatePicture && (
                  <FormHelperText error>{validationErrors.vehicleNumberPlatePicture}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Driver's Picture
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  {imagesForm.driverPicture ? 'Change Image' : 'Upload Image'}
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'driverPicture')}
                  />
                </Button>
                {imagesForm.driverPicture && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.driverPicture.name}
                  </Typography>
                )}
                {validationErrors.driverPicture && (
                  <FormHelperText error>{validationErrors.driverPicture}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Sealing Images
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  Upload Images (Multiple)
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileChange(e, 'sealingImages')}
                  />
                </Button>
                {imagesForm.sealingImages.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.sealingImages.length} image(s) selected
                  </Typography>
                )}
                {validationErrors.sealingImages && (
                  <FormHelperText error>{validationErrors.sealingImages}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Upload Vehicle Images
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  Upload Images (Multiple)
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileChange(e, 'vehicleImages')}
                  />
                </Button>
                {imagesForm.vehicleImages.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.vehicleImages.length} image(s) selected
                  </Typography>
                )}
                {validationErrors.vehicleImages && (
                  <FormHelperText error>{validationErrors.vehicleImages}</FormHelperText>
                )}
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Typography variant="subtitle1" gutterBottom>
                  Capture Additional Images
                </Typography>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<PhotoCamera />}
                  fullWidth
                  sx={{ height: '56px' }}
                >
                  Upload Images (Multiple)
                  <input
                    type="file"
                    hidden
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileChange(e, 'additionalImages')}
                  />
                </Button>
                {imagesForm.additionalImages.length > 0 && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {imagesForm.additionalImages.length} image(s) selected
                  </Typography>
                )}
              </Box>
              
              <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
                <Typography variant="h6">
                  QR & Barcode Scanner
                </Typography>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<QrCode />}
                  fullWidth
                  sx={{ height: '56px' }}
                  onClick={() => openScanner("qrCode")}
                >
                  Scan QR Code via Camera
                </Button>
              </Box>
              
              <Box sx={{ width: { xs: '100%', md: '47%' } }}>
                <TextField
                  fullWidth
                  label="Manual QR/Barcode Entry"
                  value={imagesForm.manualQrData}
                  onChange={(e) => setImagesForm(prev => ({
                    ...prev,
                    manualQrData: e.target.value
                  }))}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Button 
                          onClick={handleAddQrCode} 
                          disabled={!imagesForm.manualQrData}
                        >
                          Add
                        </Button>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
              
              <Box sx={{ width: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>
                  Scanned Codes: {imagesForm.scannedCodes.length}
                </Typography>
                {imagesForm.scannedCodes.length > 0 && (
                  <Box sx={{ mt: 1, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                    {imagesForm.scannedCodes.map((code, index) => (
                      <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                        {index + 1}. {code}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}

          <Box mt={4} display="flex" justifyContent="space-between">
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              variant="outlined"
            >
              Back
            </Button>
            
            <Box>
              {activeStep < (steps.length - 1) ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  endIcon={<ArrowForward />}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={isSubmitting || (userCoins !== null && userCoins < 1)}
                >
                  {isSubmitting ? (
                    <CircularProgress size={24} color="inherit" />
                  ) : (
                    "Create Trip"
                  )}
                </Button>
              )}
            </Box>
          </Box>
        </form>
      </Paper>
    </Container>
  );
} 