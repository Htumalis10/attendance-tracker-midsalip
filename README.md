# Attendance Tracker - Midsalip

A modern, offline-capable attendance tracking system with QR code scanning, built with Next.js and Prisma.

## Features

- **QR Code Scanning** - Fast attendance tracking via QR code scanning
- **Offline Support** - Continue scanning even without internet connection, auto-sync when back online
- **Multi-Device Sync** - Track and manage multiple scanner devices
- **Real-time Status** - Live countdown timers for late arrivals and time-out windows
- **Automatic Status Management** - Events auto-transition between UPCOMING → ACTIVE → CLOSED
- **Certificate Generation** - Auto-generate attendance certificates when events close
- **PWA Support** - Install as a mobile/desktop app
- **Dark/Light Theme** - Supports system theme preferences

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: MySQL (via Prisma ORM)
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **QR Scanner**: @yudiel/react-qr-scanner
- **Notifications**: Sonner (toast notifications)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **pnpm** (recommended) or npm - Install via `npm install -g pnpm`
- **MySQL** (v8.0+) or **XAMPP/MAMP** with MySQL
- **Git** - [Download](https://git-scm.com/)

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/attendance-tracker-midsalip.git
cd attendance-tracker-midsalip
```

### 2. Install Dependencies

Or with npm:
```bash
npm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL="mysql://username:password@localhost:3306/zdspgc_attendance"

# NextAuth Secret (generate a random string)
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Replace:
- `username` - Your MySQL username (default: `root`)
- `password` - Your MySQL password (leave empty if none)
- `localhost:3306` - Your MySQL host and port
- `zdspgc_attendance` - Your database name

### 4. Database Setup

#### Create the Database

```sql
CREATE DATABASE zdspgc_attendance;
```

#### Run Prisma Migrations

```bash
# Push schema to database
npm prisma db push

# Generate Prisma Client
npm prisma generate
```

#### Seed Initial Data (Optional)

```bash
npm prisma db seed
```

This creates:
- Default admin account: `admin` / `admin123`
- Sample students and events

## Running the Application

### Development Mode

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
# Build the application
npm build

# Start production server
npm start
```

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server with Turbopack |
| `pnpm build` | Create production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `npm prisma studio` | Open Prisma Studio (database GUI) |
| `npm prisma db push` | Push schema changes to database |
| `npm prisma generate` | Regenerate Prisma Client |
| `npm prisma db seed` | Seed database with initial data |
| `npm prisma migrate dev` | Create and apply migrations |
| `npm prisma migrate reset` | Reset database and apply migrations |

## Project Structure

```
attendance-tracker-midsalip/
├── app/                    # Next.js App Router
│   ├── admin/              # Admin pages
│   │   ├── attendance/     # View attendance records
│   │   ├── certificates/   # Manage certificates
│   │   ├── dashboard/      # Admin dashboard
│   │   ├── events/         # Event management
│   │   ├── qr-scanner/     # QR code scanner
│   │   ├── reports/        # Reports & analytics
│   │   ├── sync-status/    # Device sync monitoring
│   │   └── users/          # User management
│   ├── api/                # API routes
│   ├── login/              # Login page
│   └── student/            # Student pages
├── components/             # Reusable components
│   └── ui/                 # shadcn/ui components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
│   ├── auth.ts             # Authentication helpers
│   ├── offline-sync.ts     # Offline sync logic
│   ├── prisma.ts           # Prisma client
│   ├── time-utils.ts       # Time formatting utilities
│   └── utils.ts            # General utilities
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Database seeder
├── public/                 # Static assets
│   ├── icons/              # PWA icons
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker
└── styles/                 # Global styles
```

## User Roles

### Admin
- Full access to all features
- Manage events, users, and attendance
- View reports and analytics
- Generate certificates

### Student
- View personal dashboard
- Check attendance history
- Download certificates

## Default Credentials

After seeding the database:

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |

## Event Lifecycle

1. **UPCOMING** - Event is scheduled for the future
2. **ACTIVE** - Event is currently ongoing (between start time and end time + grace period)
3. **CLOSED** - Event has ended

### Grace Periods

The system automatically calculates grace periods based on event duration:

| Event Duration | Time-Out Grace Period |
|----------------|----------------------|
| 5-10 minutes | 10 minutes |
| 20-30 minutes | 20 minutes |
| Up to 1 hour | 30 minutes |
| 1+ hours | 60 minutes |

### Late Threshold

Students arriving **more than 5 minutes** after the event start time are marked as **LATE**.

## Offline Functionality

The app supports offline scanning:

1. When offline, scans are stored locally in the browser
2. When back online, records automatically sync to the server
3. Monitor sync status at `/admin/sync-status`
4. Device heartbeats every 30 seconds maintain online status

## PWA Installation

### Mobile (Android/iOS)
1. Open the app in Chrome/Safari
2. Tap "Add to Home Screen" or the install prompt
3. The app will be installed as a standalone application

### Desktop (Chrome/Edge)
1. Open the app in Chrome or Edge
2. Click the install icon in the address bar
3. Click "Install"

## Troubleshooting

### Database Connection Issues

```bash
# Check if MySQL is running
# Windows (XAMPP)
# Open XAMPP Control Panel and start MySQL

# Verify connection string in .env
DATABASE_URL="mysql://root:@localhost:3306/zdspgc_attendance"
```

### Prisma Issues

```bash
# Regenerate Prisma Client
pnpm prisma generate

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset

# View database in browser
pnpm prisma studio
```

### Port Already in Use

```bash
# Find and kill process on port 3000 (Windows)
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use a different port
pnpm dev -- -p 3001
```

### Camera Not Working (QR Scanner)

- Ensure HTTPS or localhost (camera requires secure context)
- Grant camera permissions when prompted
- Check if another app is using the camera

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | MySQL connection string | Yes |
| `NEXTAUTH_SECRET` | Secret for session encryption | Yes |
| `NEXTAUTH_URL` | Base URL of the application | Yes |
| `NEXT_PUBLIC_APP_URL` | Public app URL | No |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on GitHub or contact the development team.

---

Built with ❤️ for Midsalip
