# SnapSchool 🏫

**SnapSchool** is a high-performance, AI-powered school management dashboard built with Next.js 14, TypeScript, and Tailwind CSS. It is designed to streamline administrative tasks, financial tracking, and academic management for modern educational institutions.

## 🚀 Key Features

- **AI-Powered Insights**: Integrated Gemini API for financial analysis and automated data extraction.
- **SnapAssistant (zbiba)**: A Vision-AI tool for processing receipts, autonomous grade recording, and partial payment management.
- **Comprehensive Audit Logs**: Immutable tracking of all administrative modifications.
- **Finance Management**: Streamlined tuition, salary, and expense tracking.
- **Role-Based Access**: Tailored dashboards for Admins, Teachers, Students, and Parents.
- **Dockerized Infrastructure**: Simplified database management with persistent storage.

## 🛠 Tech Stack

- **Frontend**: Next.js 14, Framer Motion, Recharts
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Clerk
- **Infrastructure**: Docker & Docker Compose

## 🏁 Getting Started

### 1. Prerequisites
- Docker & Docker Compose
- Node.js 18+

### 2. Installation & Setup
```bash
# Clone the repository
git clone https://github.com/Fares556259/School_Management_App.git

# Install dependencies
npm install

# Start the database
docker-compose up -d

# Sync database schema & seed data
npx prisma db push
npx prisma db seed
```

### 3. Run Development Server
```bash
npm run dev
```

## 📖 Documentation
For a deep dive into the architecture, AI features, and module breakdown, see the [Full Project Documentation](file:///Users/faresselmi/.gemini/antigravity/brain/d6d8f998-c5f3-4b4f-9927-de32dcfe196a/project_documentation.md).

---
Inspired by [Lama Dev](https://youtube.com/lamadev).