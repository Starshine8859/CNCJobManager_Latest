# CNC Job Manager Application

## Overview

This is a full-stack web application designed for a closet manufacturing company that uses CNC routers. The application manages job tracking, material inventory, and time reporting for manufacturing processes. It provides real-time updates, user management, and comprehensive reporting capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite with custom configuration for development and production

### Backend Architecture
- **Runtime**: Node.js with TypeScript (ESM modules)
- **Framework**: Express.js with middleware for logging and error handling
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon serverless PostgreSQL
- **Session Management**: Express sessions with PostgreSQL store
- **Authentication**: bcrypt for password hashing, role-based access control
- **Real-time Updates**: WebSocket integration for live job status updates

### Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for type sharing between client and server
- **Tables**: users, jobs, jobMaterials, colors, colorGroups, jobTimeLogs
- **Relationships**: Proper foreign key relationships with cascading operations
- **Migrations**: Managed through Drizzle Kit

## Key Components

### Authentication & Authorization
- **Three-tier role system**: operator, view_admin, admin
- **Session-based authentication** with PostgreSQL session store
- **Password protection** for admin areas with forgot password functionality
- **One-click setup** for initial admin user creation

### Job Management
- **Job Creation**: Customer name, job name, and multiple material requirements
- **Status Tracking**: waiting, in_progress, paused, done
- **Pause/Resume Controls**: Universal pause/resume buttons on all jobs regardless of status
- **Material Progress**: Track completed sheets vs total sheets per material/color
- **Recut Management**: Add additional sheets when rework is needed
- **Time Tracking**: Automatic timing when jobs start/pause/complete with pause functionality

### Material & Color Management
- **Color Database**: Comprehensive color management with hex codes and textures
- **Color Groups**: Organize colors into logical groupings
- **Search Functionality**: Quick color lookup to avoid scrolling through full lists
- **Admin Controls**: Add, edit, delete colors and color groups

### Real-time Features
- **WebSocket Integration**: Live updates for job status changes
- **Dashboard Stats**: Real-time metrics for active jobs, sheets cut, average times
- **Progress Tracking**: Live material completion status updates
- **Interactive Material Checklist**: Visual grid of numbered boxes for each sheet that operators can click to mark completed
- **Comprehensive Recut Tracking**: Separate cutlist-style sections for each recut entry with individual sheet cut/skip tracking
- **Recut Progress Monitoring**: Real-time completion status for each recut batch with progress bars and skip counts

## Recent Changes

**January 22, 2025:**
- Added comprehensive pause/resume functionality with universal controls
- Implemented pause button (⏸️) for all jobs regardless of current status  
- Added resume button (▶️) for paused jobs with automatic status switching
- Updated sidebar status filters to include separate "Paused" category
- Enhanced job status management with proper timer start/stop on pause/resume
- Implemented 3-tier role system (Super Admin, Admin, User) with proper access controls
- Created comprehensive user management page accessible only to Super Admins
- Made usernames case-insensitive while keeping passwords case-sensitive
- Updated session management to refresh user roles automatically
- Made Administration tab visible to all users with full color/material management access
- Restricted User Management to super admins only
- Eye button for view-only job access restricted to admins and super admins
- Added email field to user management system with optional email input
- **Completed Job Popup Window Feature**: Fully functional compressed job view that stays on top of other applications
  - Popup button in job details modal header opens floating window
  - Compressed view with only cut/skip functionality (no delete buttons)  
  - Real-time updates and synchronization with main job view
  - Minimize/maximize controls and maximum z-index for staying on top
  - Enhanced for label printing workflow - stays visible over label programs
  - Larger buttons and visual indicators for quick sheet tracking
  - **Connected Timer System**: Popup automatically starts/stops job timer for accurate time tracking
  - **Optimized Recut Performance**: 0.5-second refresh intervals for instant button feedback
  - **Resolved Cross-Contamination**: Fixed recut button state issues across different sheets
  - Perfect for operators using label printing software while tracking job progress

**January 23, 2025:**
- **Fixed Sheet Button Behavior**: Made regular sheet Cut/Skip buttons work exactly like recut sheets
  - Removed gray disabled states during loading for consistent user experience
  - Eliminated confusing "..." loading text that appeared during button clicks
  - Buttons now stay green/red and clickable with clean 1-second server response wait
  - Achieved uniform button behavior across all sheet types (regular, recut, popup)
  - Enhanced overall system responsiveness and professional feel

## Data Flow

1. **Job Creation**: User creates job → Server validates → Database insert → WebSocket broadcast
2. **Material Tracking**: Operator marks materials complete → Real-time UI update → Database update
3. **Time Tracking**: Job status changes trigger automatic time logging
4. **Pause/Resume**: Universal controls allow pausing any job, stopping timers, and resuming with new timer entries
5. **Reports**: Dashboard aggregates data for real-time statistics display

## External Dependencies

### Production Dependencies
- **Database**: @neondatabase/serverless for PostgreSQL connectivity
- **ORM**: drizzle-orm for database operations
- **UI Components**: @radix-ui/* components for accessible UI primitives
- **Authentication**: bcrypt for password hashing
- **Sessions**: connect-pg-simple for PostgreSQL session storage
- **Real-time**: WebSocket (ws) for live updates
- **Forms**: @hookform/resolvers, react-hook-form for form management
- **Validation**: zod for schema validation
- **HTTP Client**: @tanstack/react-query for API state management

### Development Dependencies
- **Build Tools**: Vite, esbuild for bundling
- **TypeScript**: Full type safety across frontend and backend
- **Development**: tsx for TypeScript execution, replit plugins for development environment

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to `dist/public`
- **Backend**: esbuild bundles Express server to `dist/index.js`
- **Shared Code**: TypeScript path mapping allows shared schema/types

### Environment Configuration
- **Database**: Requires `DATABASE_URL` environment variable
- **Sessions**: Uses `SESSION_SECRET` for session signing
- **Development**: Special handling for Replit environment with cartographer plugin

### Production Considerations
- **Static Files**: Express serves built frontend from `dist/public`
- **Database Migrations**: `drizzle-kit push` for schema updates
- **Session Storage**: PostgreSQL-backed sessions for scalability
- **Security**: CORS configuration, secure session cookies in production

### Development Workflow
- **Hot Reload**: Vite dev server with HMR for frontend development
- **API Logging**: Request/response logging with timing information
- **Error Handling**: Global error middleware with proper HTTP status codes
- **TypeScript**: Shared types between frontend and backend ensure consistency