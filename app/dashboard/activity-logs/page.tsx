"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserRole, ActivityAction } from "@/prisma/enums";

import {
  DataTable,
  Card,
  CardContent,
  Skeleton,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  DatePicker,
} from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton
} from "@mui/material";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import { 
  ArrowLeft, 
  Smartphone, 
  Monitor, 
  Filter, 
  RefreshCw,
  Star,
  X,
  Binoculars,
  Gift,
  ArrowLeftRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { detectDevice, formatDate } from "@/lib/utils";
import { Box, Typography, Paper, CircularProgress, Alert } from "@mui/material";

interface ActivityLog {
  id: string;
  action: string;
  targetResourceType: string;
  targetResourceId: string;
  userId: string;
  createdAt: string;
  userAgent?: string;
  targetUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  details: {
    entityType?: string;
    userId?: string;
    userRole?: string;
    userEmail?: string;
    userName?: string;
    createdAt?: string;
    sessionId?: string;
    source?: string;
    destination?: string;
    barcode?: string;
    cost?: string;
    resourceType?: string;
    device?: string;
    reasonText?: string;
    amount?: string;
    recipientName?: string;
    filters?: {
      search?: string;
      role?: string;
      page?: number;
      limit?: number;
    };
    resultCount?: number;
    totalCount?: number;
    summaryText?: string;
    companyName?: string;
    subrole?: string;
    operatorPermissions?: Record<string, boolean>;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface ActivityLogsResponse {
  logs: ActivityLog[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

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
};

type RowProps = {
  row: {
    original: ActivityLogRow;
  };
};

// Column definition for the activity logs table
const columns = [
  {
    accessorKey: "user",
    header: "User",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        const userData = row?.original?.user;
        if (!userData) return <span>-</span>;
        
        return (
          <div className="flex flex-col">
            <span className="font-medium">{userData.name || 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">{userData.email || 'No email'}</span>
          </div>
        );
      } catch (err) {
        console.error("Error rendering User column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "action",
    header: "Action",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        const action = row?.original?.action;
        const details = row?.original?.details;
        const userAgent = row?.original?.userAgent;
        
        if (!action) return <span>-</span>;
        
        return (
          <div className="flex items-center gap-2">
            {/* Highlight login/logout actions with a colored badge */}
            {action === "LOGIN" || action === "LOGOUT" ? (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                action === "LOGIN" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
              }`}>
                {action.toLowerCase()}
              </span>
            ) : (
              <span className="capitalize">{action.toLowerCase().replace(/_/g, ' ')}</span>
            )}
            
            {/* Display device icon for login/logout events */}
            {(action === "LOGIN" || action === "LOGOUT") && userAgent && (
              <div className="ml-2" title={`${action} from ${detectDevice(userAgent).type} device`}>
                {detectDevice(userAgent).isMobile ? (
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        );
      } catch (err) {
        console.error("Error rendering Action column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "details",
    header: "Details",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        const details = row?.original?.details;
        const action = row?.original?.action;
        if (!details) return <span>-</span>;
        
        // For login/logout events, show device info
        if (action === "LOGIN" || action === "LOGOUT") {
          const deviceType = details.device || "unknown";
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                {action === "LOGIN" ? "Logged in from" : "Logged out from"} {deviceType} device
              </span>
              {details.reasonText && (
                <span className="text-xs text-muted-foreground">
                  {details.reasonText}
                </span>
              )}
            </div>
          );
        }
        
        // For transfer events, show recipient and amount
        if (action === "TRANSFER") {
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                Transferred {details.amount} coins to {details.recipientName || "user"}
              </span>
              {details.reasonText && (
                <span className="text-xs text-muted-foreground">
                  Reason: {details.reasonText}
                </span>
              )}
            </div>
          );
        }
        
        // For create actions, format based on the target resource type
                            if (log.action === "CREATE") {
                              // Creating a user
                              if (log.targetResourceType === "USER") {
                                return (
                                  <div>
                                    <span>Created a new user account</span>
                                    {log.details.userRole && (
                                      <div className="text-xs text-muted-foreground">
                                        Role: {log.details.userRole}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Creating a company
                              if (log.targetResourceType === "COMPANY") {
                                return (
                                  <div>
                                    <span>Created a new company: {log.details.companyName || "Unnamed"}</span>
                                  </div>
                                );
                              }
                              
                              // Creating a session
                              if (log.targetResourceType === "SESSION") {
                                return (
                                  <div>
                                    <span>Started a new session</span>
                                    {log.details.sessionId && (
                                      <div className="text-xs text-muted-foreground">
                                        Session ID: {log.details.sessionId}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            }
                            
                            // For update actions, format based on the target resource type
                            if (log.action === "UPDATE") {
                              // Updating a user
                              if (log.targetResourceType === "USER") {
                                return (
                                  <div>
                                    <span>Updated user information</span>
                                    {log.details.userRole && (
                                      <div className="text-xs text-muted-foreground">
                                        Changed role to: {log.details.userRole}
                                      </div>
                                    )}
                                    {log.details.summaryText && (
                                      <div className="text-xs text-muted-foreground">
                                        {log.details.summaryText}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Updating a company
                              if (log.targetResourceType === "COMPANY") {
                                return (
                                  <div>
                                    <span>Updated company information</span>
                                    {log.details.companyName && (
                                      <div className="text-xs text-muted-foreground">
                                        Company: {log.details.companyName}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Updating a session
                              if (log.targetResourceType === "SESSION") {
                                return (
                                  <div>
                                    <span>Updated session details</span>
                                    {log.details.sessionId && (
                                      <div className="text-xs text-muted-foreground">
                                        Session ID: {log.details.sessionId}
                                      </div>
                                    )}
                                    {log.details.summaryText && (
                                      <div className="text-xs text-muted-foreground">
                                        {log.details.summaryText}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            }
                            
                            // For delete actions
                            if (log.action === "DELETE") {
                              return (
                                <div>
                                  <span>Deleted a {log.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || "resource"}</span>
                                  {log.details.summaryText && (
                                    <div className="text-xs text-muted-foreground">
                                      {log.details.summaryText}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // For view actions
                            if (log.action === "VIEW") {
                              return (
                                <div>
                                  <span>Viewed {log.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || "information"}</span>
                                  {log.details.summaryText && (
                                    <div className="text-xs text-muted-foreground">
                                      {log.details.summaryText}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // For allocate actions (typically coins or resources)
                            if (log.action === "ALLOCATE") {
                              return (
                                <div>
                                  <span>
                                    Allocated {log.details.amount || ""} {log.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || "resources"}
                                  </span>
                                  {log.details.reasonText && (
                                    <div className="text-xs text-muted-foreground">
                                      Reason: {log.details.reasonText}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // For other actions with structured details, create a more readable format
                            if (typeof log.details === 'object') {
                              // Try to generate a meaningful summary based on available fields
                              let mainDescription = `${log.action.toLowerCase().replace(/_/g, ' ')} ${log.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || ""}`.trim();
                              
                              // Extract key details to display separately
                              const importantDetails = [];
                              
                              // Check for common descriptive fields
                              if (log.details.summaryText) importantDetails.push(log.details.summaryText);
                              if (log.details.reasonText) importantDetails.push(`Reason: ${log.details.reasonText}`);
                              if (log.details.amount) importantDetails.push(`Amount: ${log.details.amount}`);
                              if (log.details.userName) importantDetails.push(`User: ${log.details.userName}`);
                              if (log.details.companyName) importantDetails.push(`Company: ${log.details.companyName}`);
                              if (log.details.sessionId) importantDetails.push(`Session: ${log.details.sessionId}`);
                              
                              return (
                                <div>
                                  <span className="capitalize">{mainDescription}</span>
                                  {importantDetails.length > 0 && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {importantDetails.map((detail, index) => (
                                        <div key={index}>{detail}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // Default fallback for string or primitive details
                            return <span>{String(log.details || "-")}</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          {log.targetUser ? (
                            <div>
                              <span className="font-medium">{log.targetUser.name}</span>
                              <br />
                              <span className="text-xs text-muted-foreground">{log.targetUser.email}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDate(log.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={totalPages * 10} // Approximate total count based on page count
              page={page - 1}
              onPageChange={(_, newPage) => setPage(newPage + 1)}
              rowsPerPage={10}
              rowsPerPageOptions={[10]}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}



