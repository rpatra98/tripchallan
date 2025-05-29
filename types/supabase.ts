export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          email: string
          password: string
          role: 'SUPERADMIN' | 'ADMIN' | 'COMPANY' | 'EMPLOYEE'
          subrole: 'OPERATOR' | 'DRIVER' | 'TRANSPORTER' | 'GUARD' | null
          companyId: string | null
          coins: number | null
          createdById: string | null
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          password: string
          role: 'SUPERADMIN' | 'ADMIN' | 'COMPANY' | 'EMPLOYEE'
          subrole?: 'OPERATOR' | 'DRIVER' | 'TRANSPORTER' | 'GUARD' | null
          companyId?: string | null
          coins?: number | null
          createdById?: string | null
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          password?: string
          role?: 'SUPERADMIN' | 'ADMIN' | 'COMPANY' | 'EMPLOYEE'
          subrole?: 'OPERATOR' | 'DRIVER' | 'TRANSPORTER' | 'GUARD' | null
          companyId?: string | null
          coins?: number | null
          createdById?: string | null
          createdAt?: string
          updatedAt?: string
        }
      }
      companies: {
        Row: {
          id: string
          name: string
          email: string
          address: string | null
          phone: string | null
          companyType: string | null
          gstin: string | null
          logo: string | null
          documents: string[]
          isActive: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          address?: string | null
          phone?: string | null
          companyType?: string | null
          gstin?: string | null
          logo?: string | null
          documents?: string[]
          isActive?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          address?: string | null
          phone?: string | null
          companyType?: string | null
          gstin?: string | null
          logo?: string | null
          documents?: string[]
          isActive?: boolean
          createdAt?: string
          updatedAt?: string
        }
      }
      coin_transactions: {
        Row: {
          id: string
          fromUserId: string
          toUserId: string
          amount: number
          reasonText: string | null
          reason: 'ADMIN_CREATION' | 'OPERATOR_CREATION' | 'COIN_ALLOCATION' | 'SESSION_CREATION' | null
          createdAt: string
        }
        Insert: {
          id?: string
          fromUserId: string
          toUserId: string
          amount: number
          reasonText?: string | null
          reason?: 'ADMIN_CREATION' | 'OPERATOR_CREATION' | 'COIN_ALLOCATION' | 'SESSION_CREATION' | null
          createdAt?: string
        }
        Update: {
          id?: string
          fromUserId?: string
          toUserId?: string
          amount?: number
          reasonText?: string | null
          reason?: 'ADMIN_CREATION' | 'OPERATOR_CREATION' | 'COIN_ALLOCATION' | 'SESSION_CREATION' | null
          createdAt?: string
        }
      }
      sessions: {
        Row: {
          id: string
          createdAt: string
          createdById: string
          companyId: string
          source: string
          destination: string
          status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
        }
        Insert: {
          id?: string
          createdAt?: string
          createdById: string
          companyId: string
          source: string
          destination: string
          status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
        }
        Update: {
          id?: string
          createdAt?: string
          createdById?: string
          companyId?: string
          source?: string
          destination?: string
          status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
        }
      }
      seals: {
        Row: {
          id: string
          sessionId: string
          barcode: string
          scannedAt: string | null
          verified: boolean
          verifiedById: string | null
          status: string | null
          statusComment: string | null
          statusUpdatedAt: string | null
          statusEvidence: any | null
        }
        Insert: {
          id?: string
          sessionId: string
          barcode: string
          scannedAt?: string | null
          verified?: boolean
          verifiedById?: string | null
          status?: string | null
          statusComment?: string | null
          statusUpdatedAt?: string | null
          statusEvidence?: any | null
        }
        Update: {
          id?: string
          sessionId?: string
          barcode?: string
          scannedAt?: string | null
          verified?: boolean
          verifiedById?: string | null
          status?: string | null
          statusComment?: string | null
          statusUpdatedAt?: string | null
          statusEvidence?: any | null
        }
      }
      comments: {
        Row: {
          id: string
          sessionId: string
          userId: string
          message: string
          imageUrl: string | null
          urgency: 'NA' | 'LOW' | 'MEDIUM' | 'HIGH'
          createdAt: string
        }
        Insert: {
          id?: string
          sessionId: string
          userId: string
          message: string
          imageUrl?: string | null
          urgency?: 'NA' | 'LOW' | 'MEDIUM' | 'HIGH'
          createdAt?: string
        }
        Update: {
          id?: string
          sessionId?: string
          userId?: string
          message?: string
          imageUrl?: string | null
          urgency?: 'NA' | 'LOW' | 'MEDIUM' | 'HIGH'
          createdAt?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          userId: string
          action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'TRANSFER' | 'ALLOCATE' | 'VIEW'
          details: any | null
          targetUserId: string | null
          targetResourceId: string | null
          targetResourceType: string | null
          ipAddress: string | null
          userAgent: string | null
          createdAt: string
        }
        Insert: {
          id?: string
          userId: string
          action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'TRANSFER' | 'ALLOCATE' | 'VIEW'
          details?: any | null
          targetUserId?: string | null
          targetResourceId?: string | null
          targetResourceType?: string | null
          ipAddress?: string | null
          userAgent?: string | null
          createdAt?: string
        }
        Update: {
          id?: string
          userId?: string
          action?: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'TRANSFER' | 'ALLOCATE' | 'VIEW'
          details?: any | null
          targetUserId?: string | null
          targetResourceId?: string | null
          targetResourceType?: string | null
          ipAddress?: string | null
          userAgent?: string | null
          createdAt?: string
        }
      }
      operator_permissions: {
        Row: {
          id: string
          userId: string
          canCreate: boolean
          canModify: boolean
          canDelete: boolean
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          userId: string
          canCreate?: boolean
          canModify?: boolean
          canDelete?: boolean
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          userId?: string
          canCreate?: boolean
          canModify?: boolean
          canDelete?: boolean
          createdAt?: string
          updatedAt?: string
        }
      }
      vehicles: {
        Row: {
          id: string
          numberPlate: string
          model: string | null
          manufacturer: string | null
          yearOfMake: number | null
          registrationCertificate: string | null
          status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
          companyId: string
          createdById: string
          createdAt: string
          updatedAt: string
        }
        Insert: {
          id?: string
          numberPlate: string
          model?: string | null
          manufacturer?: string | null
          yearOfMake?: number | null
          registrationCertificate?: string | null
          status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
          companyId: string
          createdById: string
          createdAt?: string
          updatedAt?: string
        }
        Update: {
          id?: string
          numberPlate?: string
          model?: string | null
          manufacturer?: string | null
          yearOfMake?: number | null
          registrationCertificate?: string | null
          status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
          companyId?: string
          createdById?: string
          createdAt?: string
          updatedAt?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}; 