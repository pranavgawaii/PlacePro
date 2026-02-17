# PlacePro
### The OS for Modern Campus Recruitment

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-181818?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind-CSS-black?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-black?style=for-the-badge)](LICENSE)

PlacePro is a high-performance orchestration platform designed for elite academic institutions. It transforms fragmented placement processes into a cohesive, secure, and prestigious digital experience. Built for the next decade of campus recruitment.

---

## 🏛️ Institutional Operational Excellence

Generic dashboards fail the "Trust Test." PlacePro solves this by providing an environment that feels as official as a physical placement office.

### ✒️ Pure Typography-First Design
Our **Extreme Premium** aesthetic removes the clutter of generic SaaS apps. We use a document-style transcript system that ensures every communication carries institutional weight.

### ⚡ Real-Time Orchestration
Powered by a reactive PostgreSQL backbone, PlacePro delivers zero-latency updates. Whether it's a critical TPO broadcast or a direct student update, information flows instantly without page refreshes.

### 🔐 Enterprise-Grade Governance
Manage student registries, verify high-stakes documentation, and control institutional identity with granular Role-Based Access Control (RBAC).

---

## 💎 The Feature Suite

### 🎓 Student Workspace
A minimalist, high-focus canvas for students to track applications, upload verified credentials, and engage in professional correspondence via the **Institutional Inbox**.

### 🛠️ TPO Control Plane (Admin)
A sophisticated administrative suite for managing the placement lifecycle:
- **Registry Management**: Instant search, filter, and bulk student provisioning.
- **Verification Engine**: Secure handling of academic transcripts and resumes.
- **Announcement Direct**: Targeted broadcast system with read-receipt tracking.

### 💼 Recruiter Pipeline (Internal)
Optimized data structures designed for high-volume recruitment drives, supporting complex eligibility criteria and multi-stage hiring workflows.

---

## 🛠️ Infrastructure & Tech Stack

PlacePro is engineered for stability, speed, and security.

- **Frontend Core**: Next.js 15 (App Router Architecture)
- **Data Persistence**: Supabase (Cloud-Native PostgreSQL)
- **Real-Time Engine**: Supabase Realtime (WebSockets)
- **Design System**: Custom Tailwind Architecture + Radix UI
- **Security**: JWT Session Handling + Row-Level Security (RLS) policies

---

## 🚀 Deployment Manual

### 1. Synchronize Environment
Configure your secrets in a `.env` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### 2. Standard Installation
```bash
npm install
```

### 3. Initialize Engine
```bash
npm run dev
```

---

## 🗺️ Product Roadmap

- [ ] **PlacePro AI**: LLM-driven resume evaluation and placement prediction.
- [ ] **Institutional Seal**: Blockchain-verified credentialing for student documents.
- [ ] **Multi-College Support**: Centralized placement hub for University clusters.

---

## ✨ Support & Stewardship

PlacePro is a product of our commitment to extreme quality. If you find this software transformative for your institution:

⭐ **Star this repository** to support the development of high-end educational technology.

### 🤝 Strategic Collaboration
We invite institutional partners, academic developers, and design enthusiasts to contribute. PlacePro thrives on the feedback of the community it serves.

- **Developer Outreach**: Open a PR for performance or design optimizations.
- **Deployment Support**: Reach out if you're deploying this for your University.

---
*Created for the visionaries of education. Maintained by the PlacePro Core Team.*
