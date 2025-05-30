// User roles
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE'
}

// Employee subroles
export enum EmployeeSubrole {
  OPERATOR = 'OPERATOR',
  DRIVER = 'DRIVER',
  GUARD = 'GUARD'
}

// Session statuses
export enum SessionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

// Seal statuses
export enum SealStatus {
  PENDING = 'PENDING',
  APPLIED = 'APPLIED',
  REMOVED = 'REMOVED',
  DAMAGED = 'DAMAGED'
}

// Vehicle statuses
export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE'
}

// Activity log actions
export enum ActivityAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  TRANSFER = 'TRANSFER',
  ACCESS = 'ACCESS'
}

// Transaction reasons
export enum TransactionReason {
  ALLOCATION = 'ALLOCATION',
  TRANSFER = 'TRANSFER',
  SESSION_CREATION = 'SESSION_CREATION',
  REFUND = 'REFUND',
  BONUS = 'BONUS',
  ADJUSTMENT = 'ADJUSTMENT',
  CORRECTION = 'CORRECTION'
}

// Session types
export enum SessionType {
  LOADING = 'LOADING',
  UNLOADING = 'UNLOADING',
  INSPECTION = 'INSPECTION'
}

// Permission types
export enum Permission {
  CREATE_SESSION = 'CREATE_SESSION',
  MANAGE_SESSIONS = 'MANAGE_SESSIONS',
  MANAGE_EMPLOYEES = 'MANAGE_EMPLOYEES',
  GENERATE_REPORTS = 'GENERATE_REPORTS',
  VERIFY_SEALS = 'VERIFY_SEALS',
  MANAGE_COINS = 'MANAGE_COINS'
}

export enum ResourceType {
  USER = 'user',
  COMPANY = 'company',
  EMPLOYEE = 'employee',
  SESSION = 'session',
  SEAL = 'seal',
  VEHICLE = 'vehicle',
  COMMENT = 'comment',
  TRANSACTION = 'transaction'
} 