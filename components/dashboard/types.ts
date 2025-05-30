export interface UserWithCompany {
  id: string;
  name: string;
  email: string;
  role: string;
  subrole: string | null;
  companyId: string | null;
  coins: number;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: Company | null;
}

export interface Company {
  id: string;
  name: string;
  email: string;
  address?: string | null;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SuperAdminDashboardProps {
  user: UserWithCompany;
}

export interface AdminDashboardProps {
  user: UserWithCompany;
}

export interface CompanyDashboardProps {
  user: UserWithCompany;
  initialTab?: string;
}

export interface EmployeeDashboardProps {
  user: UserWithCompany;
}

export interface CompanyData {
  id: string;
  companyUserId?: string;
  name: string;
  email: string;
  address?: string | null;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
} 