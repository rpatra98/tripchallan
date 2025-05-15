"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  ArrowLeft,
  Smartphone,
  Monitor,
  Filter,
  RefreshCw,
  Star,
  AlertTriangle,
  Download,
  Calendar,
  Search
} from 'lucide-react';
import {
  Box,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Drawer,
  IconButton,
  Chip,
  Divider,
  Stack,
  Grid
} from '@mui/material';
import { formatDate, detectDevice } from '@/lib/utils';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format } from 'date-fns';
import {
  ActivityLog, 
  ActivityLogDetails, 
  ActivityLogRow,
  FilterOptions 
} from './types';
import useTransformLogs, { extractFilterOptions } from './effect-transform';

// Main component
export default function ActivityLogsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  
  // Use our custom transform hook to handle log data transformation
  const { tableData } = useTransformLogs(logs);
  
  const [filteredData, setFilteredData] = useState<ActivityLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{name: string, email: string}[]>([]);
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    action: '',
    startDate: null,
    endDate: null,
    user: '',
    resourceType: ''
  });
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
} 