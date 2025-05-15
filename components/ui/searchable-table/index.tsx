"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "../data-table";

interface SearchableTableProps {
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
}

export function SearchableTable({ columns, data, pagination }: SearchableTableProps) {
  const [searchColumn, setSearchColumn] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredData, setFilteredData] = useState<any[]>(data);
  
  // Get searchable columns
  const searchableColumns = columns.filter(col => col.searchable !== false);
  
  // Update filtered data when data, search column or search term changes
  useEffect(() => {
    if (!searchTerm || !searchColumn) {
      setFilteredData(data);
      return;
    }
    
    try {
      const filtered = data.filter(item => {
        const value = getValue(item, searchColumn);
        if (value === null || value === undefined) return false;
        
        // Special case for hasCreatedResources (Status column)
        if (searchColumn === "hasCreatedResources") {
          const hasResourcesTerms = ["has resources", "true", "yes"];
          const noResourcesTerms = ["no resources", "false", "no"];
          
          const searchLower = searchTerm.toLowerCase();
          
          // Check if the search term matches any of the special cases
          if (hasResourcesTerms.some(term => term.includes(searchLower))) {
            return value === true;
          } else if (noResourcesTerms.some(term => term.includes(searchLower))) {
            return value === false;
          }
        }
        
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
  const getValue = (item: any, key: string) => {
    try {
      // Handle nested properties like "user.name"
      if (key.includes(".")) {
        const parts = key.split(".");
        let value = item;
        for (const part of parts) {
          value = value?.[part];
          if (value === undefined) return null;
        }
        return value;
      }
      
      return item[key];
    } catch (err) {
      console.error(`Error getting value for key ${key}:`, err);
      return null;
    }
  };

  // Helper function to get placeholder text for the search input
  const getPlaceholderText = () => {
    if (!searchColumn) return "Select a column first";
    
    const column = columns.find(col => col.accessorKey === searchColumn);
    
    if (searchColumn === "hasCreatedResources") {
      return "Search for 'Has Resources' or 'No Resources'...";
    }
    
    return `Search in ${column?.header}...`;
  };
  
  return (
    <div>
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
            placeholder={getPlaceholderText()}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={!searchColumn}
          />
        </div>
      </div>
      
      <DataTable 
        columns={columns} 
        data={filteredData} 
        pagination={pagination}
        searchable={false} // Disable built-in search since we're handling it here
      />
    </div>
  );
} 