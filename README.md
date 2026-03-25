# School Management Dashboard

A modern, responsive school management dashboard built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- **Admin Dashboard**: Overview of school statistics, finance charts, and user cards.
- **Role-based Views**: Tailored experiences for students, teachers, parents, and staff.
- **Interactive Charts**: Developed using Recharts for data visualization (Attendance, Finance, etc.).
- **Event Calendar**: Integrated calendar for tracking school events and announcements.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Fares556259/School_Management_App.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Project

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Recent Fixes

### Module Not Found Error
Resolved a critical "Cannot find module" error caused by Next.js build cache corruption.
- **Action**: Cleared `.next` directory and reinstalled dependencies.
- **Outcome**: Restored full functionality to the `/admin` dashboard and other routes.

## Credits

Inspired by [Lama Dev](https://youtube.com/lamadev).