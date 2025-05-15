"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface DataTableProps {
  columns: {
    accessorKey: string;
    header: string;
    cell?: ({ row }: { row: any }) => React.ReactNode;
    searchable?: boolean;
  }[];
  data: any[];
  pagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
  searchable?: boolean;
}

export function DataTable({ columns, data, pagination, searchable = true }: DataTableProps) {
  const [error, setError] = React.useState<Error | null>(null);
  const [searchColumn, setSearchColumn] = React.useState<string>("");
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [filteredData, setFilteredData] = React.useState<any[]>(data);
  
  // Update filtered data when data, search column or search term changes
  React.useEffect(() => {
    if (!searchTerm || !searchColumn) {
      setFilteredData(data);
      return;
    }
    
    try {
      const filtered = data.filter(item => {
        const value = getValue(item, searchColumn);
        if (value === null || value === undefined) return false;
        
        // For objects and arrays, stringify before searching
        const stringValue = typeof value === 'object' 
          ? JSON.stringify(value).toLowerCase() 
          : String(value).toLowerCase();
        
        return stringValue.includes(searchTerm.toLowerCase());
      });
      
      setFilteredData(filtered);
    } catch (err) {
      console.error("Error filtering data:", err);
      setFilteredData(data);
    }
  }, [data, searchColumn, searchTerm]);

  // Helper function to get value from row
  const getValue = (row: any, key: string) => {
    try {
      // Handle nested properties like "user.name"
      if (key.includes(".")) {
        const parts = key.split(".");
        let value = row;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined) return null;
        }
        return value;
      }
      
      return row[key];
    } catch (err) {
      console.error(`Error getting value for key ${key}:`, err);
      return null;
    }
  };

  const renderCell = (row: any, column: typeof columns[0]) => {
    try {
      // Add getValue function to row object for cell renderers
      row.getValue = getValue;
      
      if (column.cell) {
        try {
          return column.cell({ row });
        } catch (err) {
          console.error(`Error rendering custom cell for ${column.accessorKey}:`, err);
          return <span className="text-red-500">Error</span>;
        }
      }
      
      return getValue(row, column.accessorKey);
    } catch (err) {
      console.error(`Error rendering cell:`, err);
      return <span className="text-red-500">Error</span>;
    }
  };
  
  // Validate data before rendering
  if (!data || !Array.isArray(data)) {
    return (
      <div className="text-center p-4 text-red-500">
        Invalid data format. Expected an array.
      </div>
    );
  }
  
  // Get searchable columns
  const searchableColumns = columns.filter(col => col.searchable !== false);
  
  try {
    return (
      <div className="relative w-full overflow-auto">
        {searchable && searchableColumns.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <div className="flex-1 min-w-[200px]">
              <select 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchColumn}
                onChange={(e) => setSearchColumn(e.target.value)}
              >
                <option value="">Select a column to search</option>
                {searchableColumns.map((column) => (
                  <option key={column.accessorKey} value={column.accessorKey}>
                    {column.header}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder={searchColumn ? `Search in ${columns.find(col => col.accessorKey === searchColumn)?.header}...` : "Select a column first"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={!searchColumn}
              />
            </div>
          </div>
        )}
        
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
              {columns.map((column, i) => (
                <th
                  key={column.accessorKey || i}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-center p-4 text-muted-foreground">
                  {searchTerm ? "No matching results found" : "No data available"}
                </td>
              </tr>
            ) : (
              filteredData.map((row, i) => (
                <tr
                  key={i}
                  className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                >
                  {columns.map((column, j) => (
                    <td
                      key={column.accessorKey || j}
                      className="p-4 align-middle"
                    >
                      {renderCell(row, column)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {pagination && (
          <div className="flex items-center justify-between p-4">
            <div className="flex-1 text-sm text-muted-foreground">
              {filteredData.length > 0 ? (
                <>
                  {pagination.pageSize * pagination.pageIndex + 1}-
                  {Math.min(
                    pagination.pageSize * (pagination.pageIndex + 1),
                    pagination.pageCount * pagination.pageSize
                  )}{" "}
                  of {pagination.pageCount * pagination.pageSize}
                </>
              ) : "0 items"}
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 py-2 px-4"
                onClick={() => pagination.onPageChange(pagination.pageIndex - 1)}
                disabled={pagination.pageIndex === 0}
              >
                Previous
              </button>
              <div className="text-sm font-medium">
                Page {pagination.pageIndex + 1} of {Math.max(1, pagination.pageCount)}
              </div>
              <button
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-secondary text-secondary-foreground hover:bg-secondary/80 h-10 py-2 px-4"
                onClick={() => pagination.onPageChange(pagination.pageIndex + 1)}
                disabled={pagination.pageIndex === pagination.pageCount - 1 || pagination.pageCount === 0}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  } catch (err: any) {
    console.error("Error rendering DataTable:", err);
    return (
      <div className="text-center p-4 text-red-500">
        An error occurred while rendering the table: {err.message}
      </div>
    );
  }
} 