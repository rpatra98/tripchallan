// Enum values for user roles and other application enums
// (No longer Prisma-specific)

export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  COMPANY = 'COMPANY',
  EMPLOYEE = 'EMPLOYEE'
}

export enum EmployeeSubrole {
  MANAGER = 'MANAGER',
  SUPERVISOR = 'SUPERVISOR',
  GUARD = 'GUARD',
  STAFF = 'STAFF'
}

export enum ActivityAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  VIEW = 'VIEW',
  DOWNLOAD = 'DOWNLOAD',
  UPLOAD = 'UPLOAD',
  PAYMENT = 'PAYMENT'
}

export enum CoinTransactionType {
  PURCHASE = 'PURCHASE',
  USAGE = 'USAGE',
  REFUND = 'REFUND',
  BONUS = 'BONUS',
  ADJUSTMENT = 'ADJUSTMENT'
}

export enum CoinTransactionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum SessionStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED"
}

export enum SealStatus {
  VERIFIED = "VERIFIED",
  MISSING = "MISSING",
  BROKEN = "BROKEN",
  TAMPERED = "TAMPERED"
}

export enum TransactionReason {
  ADMIN_CREATION = "ADMIN_CREATION",
  OPERATOR_CREATION = "OPERATOR_CREATION",
  COIN_ALLOCATION = "COIN_ALLOCATION",
  SESSION_CREATION = "SESSION_CREATION"
}

export enum VehicleStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  MAINTENANCE = "MAINTENANCE"
} 