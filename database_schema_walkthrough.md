# SnapSchool Database Architecture Walkthrough 🛡️🛰️🚀

This document provides a visual and technical overview of how the SnapSchool database is structured using **Prisma** and **PostgreSQL**.

## 1. Visual Schema Diagram 📊

The following diagram shows the core relationships between Students, Parents, Staff, and the academic structure.

```mermaid
erDiagram
    SCHOOL ||--o{ ADMIN : manages
    SCHOOL ||--o{ STUDENT : enrolls
    SCHOOL ||--o{ PARENT : supports
    SCHOOL ||--o{ TEACHER : employs
    
    PARENT ||--o{ STUDENT : "has children"
    
    CLASS ||--o{ STUDENT : contains
    LEVEL ||--o{ CLASS : categorizes
    
    STUDENT ||--o{ PAYMENT : "makes payments"
    TEACHER ||--o{ PAYMENT : "receives salary"
    STAFF ||--o{ PAYMENT : "receives salary"
    
    STUDENT ||--o{ ATTENDANCE : tracks
    STUDENT ||--o{ GRADE : receives
    
    TEACHER ||--o{ LESSON : teaches
    LESSON ||--o{ EXAM : "includes"
    CLASS ||--o{ LESSON : "has schedule"
    
    PARENT ||--o{ NOTIFICATION : receives
```

## 2. Core Entities Explained 🗝️

### 🛡️ Administrative & School
- **School**: The root entity. Everything (Students, Teachers, Payments) belongs to a specific `schoolId` to support multi-tenancy.
- **Admin**: Users who manage the dashboard and have access to the **Zbiba AI** financial assistant.

### 👥 User Roles
- **Parent**: The primary contact for financial matters. Linked to one or more Students.
- **Student**: The heart of the system. Linked to a Parent, a Class, and a Level.
- **Teacher**: Manages Classes and Subjects. Linked to Lessons and GradeSheets.
- **Staff**: General school employees (bus drivers, security, etc.) who also receive salary payments.

### 📚 Academic Structure
- **Level**: The grade level (e.g., Level 1, Level 2).
- **Class**: A specific group of students (e.g., "Class 1A"). Each class has a Supervisor (Teacher).
- **Subject**: The topics being taught (Math, Science), which are linked to Teachers.

### 💰 Financial Management
- **Payment**: Tracks both **Uncollected Fees** (from Students) and **Salaries** (to Teachers/Staff). These are tracked by `month` and `year`.
- **Income/Expense**: High-level financial tracking for the school's general ledger.

### 🔔 Communication
- **Notification**: Real-time alerts sent to Parents via the mobile app (for attendance, payments, or announcements).
- **Notice**: General school announcements that can target the whole school, a specific class, or a single student.

## 3. Why it's powerful 🦾
- **Relational Integrity**: Prisma ensures that you can never have a Student without a Parent or a Payment without a Recipient.
- **AI-Ready**: The schema includes `AuditLogs` and structured `Payment` data, which allows the **Zbiba AI** to perform complex financial analysis and name-to-ID resolution instantly.

---
**This schema is the engine that powers both the Next.js Admin Dashboard and the Expo Mobile App!** 🚀🛡️✨⚙️🧤🦾✅✨
