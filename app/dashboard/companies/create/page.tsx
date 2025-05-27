"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserRole } from "@/prisma/enums";
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Stack,
  Alert, 
  InputAdornment, 
  IconButton,
  FormControl,
  InputLabel,
  OutlinedInput,
  CircularProgress,
  Select,
  MenuItem,
  FormHelperText,
} from "@mui/material";
import { Visibility, VisibilityOff, CloudUpload, Delete } from "@mui/icons-material";

// List of company types
const COMPANY_TYPES = [
  "Manufacturing",
  "Trade / Retail",
  "Sevices",
  "Logistics / Transport",
  "Construction / Real Estate",
  "Financial Sevices",
  "Educational Institutions",
  "Healthcare",
  "E-commerce",
  "Agribusiness",
  "--Others--"
];

// GSTIN validation regex
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export default function CreateCompanyPage() {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    address: "",
    phone: "",
    companyType: "--Others--",
    gstin: "",
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [documents, setDocuments] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [gstinError, setGstinError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Clear GSTIN error when the field is being edited
    if (name === "gstin" && gstinError) {
      setGstinError("");
    }
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGstinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData((prev) => ({ ...prev, gstin: value }));
    
    // Validate GSTIN format if there's a value
    if (value && !GSTIN_REGEX.test(value)) {
      setGstinError("Invalid GSTIN format. Example format: 27ABCDE1234F1Z5");
    } else {
      setGstinError("");
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setLogoFile(e.target.files[0]);
    }
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newDocuments = Array.from(e.target.files);
      setDocuments(prev => [...prev, ...newDocuments]);
    }
  };

  const handleRemoveDocument = (index: number) => {
    setDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    // GSTIN validation
    if (formData.gstin && !GSTIN_REGEX.test(formData.gstin)) {
      setGstinError("Invalid GSTIN format. Example: 27ABCDE1234F1Z5");
      setIsLoading(false);
      return;
    }

    try {
      // Create form data for file uploads
      const formDataObj = new FormData();
      formDataObj.append("name", formData.name);
      formDataObj.append("email", formData.email);
      formDataObj.append("password", formData.password);
      formDataObj.append("role", UserRole.COMPANY);
      formDataObj.append("companyName", formData.name);
      formDataObj.append("companyAddress", formData.address);
      formDataObj.append("companyPhone", formData.phone);
      formDataObj.append("companyType", formData.companyType);
      formDataObj.append("gstin", formData.gstin);
      
      // Add logo if exists
      if (logoFile) {
        formDataObj.append("logo", logoFile);
      }
      
      // Add documents if exists
      documents.forEach((doc, index) => {
        formDataObj.append(`documents[${index}]`, doc);
      });

      const response = await fetch("/api/users/create", {
        method: "POST",
        body: formDataObj,
      });

      // Check if response is ok before trying to parse JSON
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        
        // If response is JSON, parse it to get the error message
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          throw new Error(data.error || `Failed to create company: ${response.status} ${response.statusText}`);
        } else {
          // Not a JSON response, use status text instead
          throw new Error(`Failed to create company: ${response.status} ${response.statusText}`);
        }
      }
      
      // Parse response only if status is OK
      const data = await response.json();
      console.log("API response:", data);

      // Show success message
      alert("Company created successfully!");
      
      // Redirect to companies list after success
      router.push("/dashboard?tab=companies");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      console.error("Error creating company:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Company
      </Typography>
      
      <Paper elevation={3} sx={{ p: 4, mt: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Box component="form" onSubmit={handleSubmit} noValidate encType="multipart/form-data">
          <Stack spacing={3}>
            <TextField
              required
              fullWidth
              id="name"
              name="name"
              label="Company Name"
              value={formData.name}
              onChange={handleChange}
              disabled={isLoading}
            />
            
            <TextField
              required
              fullWidth
              id="email"
              name="email"
              type="email"
              label="Email Address"
              value={formData.email}
              onChange={handleChange}
              disabled={isLoading}
            />
            
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl variant="outlined" fullWidth required>
                <InputLabel htmlFor="password">Password</InputLabel>
                <OutlinedInput
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={togglePasswordVisibility}
                        edge="end"
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  }
                  label="Password"
                />
              </FormControl>
              
              <FormControl variant="outlined" fullWidth required>
                <InputLabel htmlFor="confirmPassword">Confirm Password</InputLabel>
                <OutlinedInput
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isLoading}
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle confirm password visibility"
                        onClick={toggleConfirmPasswordVisibility}
                        edge="end"
                      >
                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  }
                  label="Confirm Password"
                />
              </FormControl>
            </Stack>
            
            <FormControl fullWidth>
              <InputLabel id="company-type-label">Company Type</InputLabel>
              <Select
                labelId="company-type-label"
                id="companyType"
                name="companyType"
                value={formData.companyType}
                label="Company Type"
                onChange={handleSelectChange}
                disabled={isLoading}
              >
                {COMPANY_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
              <FormHelperText>Select the type of company</FormHelperText>
            </FormControl>
            
            <TextField
              required
              fullWidth
              id="gstin"
              name="gstin"
              label="GSTIN"
              value={formData.gstin}
              onChange={handleGstinChange}
              disabled={isLoading}
              error={!!gstinError}
              helperText={gstinError || "Format: 27ABCDE1234F1Z5"}
            />
            
            <TextField
              fullWidth
              id="phone"
              name="phone"
              label="Phone Number"
              value={formData.phone}
              onChange={handleChange}
              disabled={isLoading}
            />
            
            <TextField
              fullWidth
              id="address"
              name="address"
              label="Address"
              multiline
              rows={3}
              value={formData.address}
              onChange={handleChange}
              disabled={isLoading}
            />
            
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Company Logo (Optional)
              </Typography>
              <input 
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={logoInputRef}
                onChange={handleLogoChange}
              />
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
                onClick={() => logoInputRef.current?.click()}
                disabled={isLoading}
                sx={{ mb: 1 }}
              >
                Upload Logo
              </Button>
              {logoFile && (
                <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ mr: 1 }}>
                    {logoFile.name}
                  </Typography>
                  <IconButton 
                    size="small"
                    onClick={() => setLogoFile(null)}
                    disabled={isLoading}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              )}
            </Box>
            
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                Documents (Optional)
              </Typography>
              <input 
                type="file"
                multiple
                style={{ display: 'none' }}
                ref={documentInputRef}
                onChange={handleDocumentChange}
              />
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
                onClick={() => documentInputRef.current?.click()}
                disabled={isLoading}
                sx={{ mb: 1 }}
              >
                Upload Document
              </Button>
              {documents.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" gutterBottom>
                    Uploaded Documents:
                  </Typography>
                  {documents.map((doc, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ mr: 1 }}>
                        {index + 1}. {doc.name}
                      </Typography>
                      <IconButton 
                        size="small"
                        onClick={() => handleRemoveDocument(index)}
                        disabled={isLoading}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
            
            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={isLoading}
              sx={{ mt: 2, py: 1.5 }}
            >
              {isLoading ? (
                <>
                  <CircularProgress size={24} sx={{ mr: 1 }} color="inherit" />
                  Creating...
                </>
              ) : (
                "Create Company"
              )}
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
} 