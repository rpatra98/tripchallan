"use client";

import { useState } from "react";
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  Card, 
  CardContent,
  CircularProgress,
  LinearProgress,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack,
  Divider
} from "@mui/material";
import { 
  TrendingUp, 
  TrendingDown, 
  MoreVert, 
  Download, 
  CalendarToday,
  Timeline,
  BarChart,
  PieChart,
  Storage,
  Speed,
  ErrorOutline,
  CheckCircle,
  Warning
} from "@mui/icons-material";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart as RechartsBarChart, Bar, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';

// Add these types at the top with other types
type TimeRange = 'today' | 'week' | 'month' | 'custom';
type MetricTrend = 'up' | 'down' | 'stable';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: MetricTrend;
  trendValue?: string;
  icon: React.ReactNode;
  color?: string;
}

// Add this component after the existing components
const MetricCard = ({ title, value, trend, trendValue, icon, color = 'primary' }: MetricCardProps) => (
  <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ 
          p: 1, 
          borderRadius: 1, 
          bgcolor: `${color}.lighter`,
          color: `${color}.main`
        }}>
          {icon}
        </Box>
        <IconButton size="small">
          <MoreVert />
        </IconButton>
      </Box>
      <Typography variant="h4" component="div" sx={{ mb: 1 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      {trend && (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          mt: 1,
          color: trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'warning.main'
        }}>
          {trend === 'up' ? <TrendingUp fontSize="small" /> : trend === 'down' ? <TrendingDown fontSize="small" /> : <Timeline fontSize="small" />}
          <Typography variant="caption" sx={{ ml: 0.5 }}>
            {trendValue}
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);

// Add this component
const SystemHealthCard = () => {
  const healthMetrics = [
    { label: 'API Response Time', value: 85, color: 'success' },
    { label: 'Error Rate', value: 2, color: 'success' },
    { label: 'Storage Usage', value: 65, color: 'warning' },
    { label: 'Active Users', value: 92, color: 'success' }
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          System Health
        </Typography>
        <Stack spacing={2}>
          {healthMetrics.map((metric) => (
            <Box key={metric.label}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">{metric.label}</Typography>
                <Typography variant="body2" color={`${metric.color}.main`}>
                  {metric.value}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={metric.value} 
                color={metric.color as 'success' | 'warning' | 'error'}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
};

// Add this component
const TrendChart = ({ data, title }: { data: any[], title: string }) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Box sx={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <RechartsTooltip />
            <Line type="monotone" dataKey="value" stroke="#8884d8" />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </CardContent>
  </Card>
);

// Add this component
const ActivityDistribution = ({ data }: { data: any[] }) => (
  <Card>
    <CardContent>
      <Typography variant="h6" gutterBottom>
        Activity Distribution
      </Typography>
      <Box sx={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4]} />
              ))}
            </Pie>
            <RechartsTooltip />
          </PieChart>
        </ResponsiveContainer>
      </Box>
    </CardContent>
  </Card>
);

// Update the SystemStats component
const SystemStats = ({ stats }: { stats: any }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');

  // Sample data for charts
  const sessionTrendData = [
    { name: 'Mon', value: 65 },
    { name: 'Tue', value: 59 },
    { name: 'Wed', value: 80 },
    { name: 'Thu', value: 81 },
    { name: 'Fri', value: 56 },
    { name: 'Sat', value: 55 },
    { name: 'Sun', value: 40 }
  ];

  const activityData = [
    { name: 'Sessions', value: 400 },
    { name: 'Companies', value: 300 },
    { name: 'Operators', value: 300 },
    { name: 'Guards', value: 200 }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2">
          System Statistics
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            >
              <MenuItem value="today">Today</MenuItem>
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="custom">Custom Range</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Export Data">
            <IconButton>
              <Download />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 3 }}>
        <MetricCard
          title="Total Sessions"
          value={stats.totalSessions}
          trend="up"
          trendValue="12% from last week"
          icon={<BarChart />}
          color="primary"
        />
        <MetricCard
          title="Active Companies"
          value={stats.activeCompanies}
          trend="up"
          trendValue="5% from last week"
          icon={<Storage />}
          color="success"
        />
        <MetricCard
          title="System Uptime"
          value="99.9%"
          trend="stable"
          trendValue="No change"
          icon={<Speed />}
          color="info"
        />
        <MetricCard
          title="Error Rate"
          value="0.1%"
          trend="down"
          trendValue="2% from last week"
          icon={<ErrorOutline />}
          color="warning"
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3, mb: 3 }}>
        <TrendChart data={sessionTrendData} title="Session Activity Trend" />
        <SystemHealthCard />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        <ActivityDistribution data={activityData} />
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Performance Metrics
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" color="success.main">
                  98%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Success Rate
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'center', p: 2 }}>
                <Typography variant="h4" color="primary.main">
                  2.3s
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Avg Response Time
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}; 