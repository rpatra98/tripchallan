// Types exported from activity-logs page
export type ActivityLogDetails = Record<string, any>;

export interface User {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  targetResourceType?: string;
  targetResourceId?: string;
  userId: string;
  createdAt: string;
  userAgent?: string;
  targetUser?: User;
  user?: User;
  details?: ActivityLogDetails;
}

export interface ActivityLogsResponse {
  logs: ActivityLog[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }
}

export type ActivityLogRow = {
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
  targetResourceType?: string;
};

export interface FilterOptions {
  action: string;
  startDate: Date | null;
  endDate: Date | null;
  user: string;
  resourceType: string;
}
