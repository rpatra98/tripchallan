// Ignore this file - it's just used for copying over to the real file
type ActivityLogDetails = {
  device?: string;
  reasonText?: string;
  amount?: string | number;  // Accept both string and number
  recipientName?: string;
  [key: string]: unknown;
};

type ActivityLogRow = {
  id: string;
  user: {
    name: string;
    email: string;
  };
  action: string;
  details: ActivityLogDetails;
  targetUser?: {
    name: string;
    email: string;
  };
  createdAt: string;
  userAgent?: string;
  targetResourceType: string;  // Required, not optional
}; 
