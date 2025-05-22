import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  IconButton,
  FormHelperText,
  Typography,
  SelectChangeEvent
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { VehicleStatus } from '@/prisma/enums';

interface VehicleFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (vehicleData: VehicleFormData) => Promise<void>;
  initialData?: VehicleFormData;
  isEditing: boolean;
}

export interface VehicleFormData {
  id?: string;
  numberPlate: string;
  model?: string;
  manufacturer?: string;
  yearOfMake?: string;
  status?: VehicleStatus;
}

const VehicleForm: React.FC<VehicleFormProps> = ({
  open,
  onClose,
  onSubmit,
  initialData,
  isEditing
}) => {
  const [formData, setFormData] = useState<VehicleFormData>({
    numberPlate: '',
    model: '',
    manufacturer: '',
    yearOfMake: '',
    status: VehicleStatus.ACTIVE
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize form data if editing an existing vehicle
  useEffect(() => {
    if (initialData) {
      setFormData({
        id: initialData.id,
        numberPlate: initialData.numberPlate || '',
        model: initialData.model || '',
        manufacturer: initialData.manufacturer || '',
        yearOfMake: initialData.yearOfMake || '',
        status: initialData.status || VehicleStatus.ACTIVE
      });
    } else {
      // Reset form when adding a new vehicle
      setFormData({
        numberPlate: '',
        model: '',
        manufacturer: '',
        yearOfMake: '',
        status: VehicleStatus.ACTIVE
      });
    }
    
    // Clear any errors when form opens
    setErrors({});
  }, [initialData, open]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }> | SelectChangeEvent<VehicleStatus>) => {
    const name = e.target.name;
    const value = e.target.value;
    
    if (name) {
      setFormData(prev => ({ ...prev, [name]: value }));
      
      // Clear error for this field when user types
      if (errors[name]) {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
      }
    }
  };
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Required fields
    if (!formData.numberPlate.trim()) {
      newErrors.numberPlate = 'Vehicle number is required';
    }
    
    // Year validation
    if (formData.yearOfMake) {
      const yearValue = parseInt(formData.yearOfMake);
      const currentYear = new Date().getFullYear();
      
      if (isNaN(yearValue)) {
        newErrors.yearOfMake = 'Year must be a number';
      } else if (yearValue < 1900 || yearValue > currentYear + 1) {
        newErrors.yearOfMake = `Year must be between 1900 and ${currentYear + 1}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting vehicle form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isEditing ? 'Edit Vehicle' : 'Add New Vehicle'}
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </div>
      </DialogTitle>
      
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <TextField
            name="numberPlate"
            label="Vehicle Number *"
            fullWidth
            margin="normal"
            value={formData.numberPlate}
            onChange={handleChange}
            error={!!errors.numberPlate}
            helperText={errors.numberPlate}
            disabled={isSubmitting || Boolean(isEditing && initialData?.id)}
            InputProps={{
              readOnly: Boolean(isEditing)
            }}
          />
          
          <TextField
            name="manufacturer"
            label="Manufacturer"
            fullWidth
            margin="normal"
            value={formData.manufacturer}
            onChange={handleChange}
            error={!!errors.manufacturer}
            helperText={errors.manufacturer}
            disabled={isSubmitting}
          />
          
          <TextField
            name="model"
            label="Model"
            fullWidth
            margin="normal"
            value={formData.model}
            onChange={handleChange}
            error={!!errors.model}
            helperText={errors.model}
            disabled={isSubmitting}
          />
          
          <TextField
            name="yearOfMake"
            label="Year of Make"
            fullWidth
            margin="normal"
            value={formData.yearOfMake}
            onChange={handleChange}
            error={!!errors.yearOfMake}
            helperText={errors.yearOfMake || 'Year the vehicle was manufactured'}
            disabled={isSubmitting}
          />
          
          {isEditing && (
            <FormControl fullWidth margin="normal">
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                name="status"
                value={formData.status || ''}
                label="Status"
                onChange={handleChange as (event: SelectChangeEvent<VehicleStatus>, child: React.ReactNode) => void}
                disabled={isSubmitting}
              >
                <MenuItem value={VehicleStatus.ACTIVE}>Active</MenuItem>
                <MenuItem value={VehicleStatus.INACTIVE}>Inactive</MenuItem>
                <MenuItem value={VehicleStatus.MAINTENANCE}>Maintenance</MenuItem>
              </Select>
              <FormHelperText>Current operational status of the vehicle</FormHelperText>
            </FormControl>
          )}
          
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
            * Required fields
          </Typography>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={onClose} 
            disabled={isSubmitting}
            color="inherit"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="contained" 
            color="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Update Vehicle' : 'Add Vehicle'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default VehicleForm; 