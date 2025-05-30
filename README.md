# CBUMS - Coin Based User Management System

A role-based application with 4 major roles: SuperAdmin, Admin, Company, and Employee. This system includes coin allocation and management features.

## Features

- **Role-based Access Control**: SuperAdmin, Admin, Company, and Employee roles
- **User Management**: Create and manage users based on roles
- **Coin System**: Transfer coins between users and track transactions
- **Company Management**: Create companies and assign employees

## Tech Stack

- **Frontend**: Next.js with App Router, React, TailwindCSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Supabase
- **Authentication**: NextAuth.js with Supabase

## Prerequisites

- Node.js 18+
- Supabase account with PostgreSQL database

## Getting Started

### 1. Clone the repository

```bash
git clone <repository-url>
cd cbums
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the `.env.example` file to `.env` and update the values:

```bash
cp .env.example .env
```

Make sure to set your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Set up Supabase

Before running any other commands, you need to set up the Supabase exec function:

```bash
# This only needs to be run once when setting up a new Supabase project
npm run setup:supabase
```

### 5. Set up the database

```bash
# Initialize the database (creates schema and initial SuperAdmin)
npm run db:init

# OR, to run migrations only
npm run migrate

# OR, to seed the SuperAdmin user only
npm run db:seed

# To reset the database (WARNING: This deletes all data)
npm run db:reset
```

### 6. Start the development server

```bash
npm run dev
```

## Default SuperAdmin Credentials

- **Email**: superadmin@cbums.com
- **Password**: superadmin123

## Project Structure

```
cbums/
├── app/                   # Next.js App Router
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard pages
│   └── page.tsx           # Home page (login)
├── components/            # React components
│   ├── auth/              # Authentication components
│   └── dashboard/         # Dashboard components
├── lib/                   # Utilities and helpers
│   ├── supabase.ts        # Supabase client
│   ├── auth.ts            # Auth utilities
│   └── types.ts           # TypeScript types
├── scripts/               # Utility scripts
│   ├── supabase-migrate.js # Migration script
│   ├── supabase-reset.js  # Database reset script
│   ├── seed-superadmin.js # SuperAdmin seeding script
│   ├── supabase-init.js   # Database initialization script
│   └── setup-exec-function.js # Supabase exec function setup
└── migrations/            # Database migrations
    └── *.sql              # SQL migration files
```

## Role Hierarchy and Permissions

- **SuperAdmin**: Can create Admin users
- **Admin**: Can create Companies and Employees
- **Company**: Can view and manage assigned Employees
- **Employee**: Can view their profile and coin transactions

## Company Fields

Companies in CBUMS now include additional fields:

- **Company Type**: Classification of the company (Manufacturing, Trade/Retail, Services, etc.)
- **GSTIN**: GST Identification Number for tax purposes
- **Logo**: Company logo image
- **Documents**: Multiple document uploads for company verification
- **Active Status**: Companies can be activated/deactivated by admins

These fields help with better organization and management of companies in the system.

## Working with Migrations

To create a new database migration:

1. Create a new SQL file in the `migrations` folder with a timestamp prefix (e.g., `20250601_add_new_field.sql`)
2. Write your SQL migration commands
3. Run `npm run migrate` to apply the migration

For more details, see the [migrations README](migrations/README.md).

## License

[MIT](LICENSE)
