# 🏆 Integrated Competition Management System

A full-stack web application for managing academic competitions at the **University of Information Technology (UIT)**. The system streamlines internal and external competition management, team collaboration, submission evaluation, achievement tracking, and student recognition through a social platform.

<p align="center">
  <img src="https://img.shields.io/badge/Java-21-orange?style=for-the-badge&logo=openjdk">
  <img src="https://img.shields.io/badge/Spring_Boot-3.x-success?style=for-the-badge&logo=springboot">
  <img src="https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react">
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?style=for-the-badge&logo=typescript">
  <img src="https://img.shields.io/badge/MongoDB-Atlas-green?style=for-the-badge&logo=mongodb">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.x-38BDF8?style=for-the-badge&logo=tailwindcss">
</p>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Application Workflow](#-application-workflow)
- [Modules](#-modules)
- [Database Collections](#-database-collections)
- [Future Enhancements](#-future-enhancements)
- [Known Limitations](#-known-limitations)
- [Team Members](#-team-members)
- [References](#-references)

---

# 🎯 Overview

The Integrated Competition Management System is designed to digitalize the complete lifecycle of university competitions.

The platform supports:

- 📚 Internal competitions (Quiz, Assignment, Project)
- 🌍 External competitions
- 👥 Team management
- 📂 Assignment & project submissions
- 🏆 Achievement and badge system
- ❤️ Social interaction through likes and comments
- 🔔 Real-time notifications
- 📄 Attendance recovery report generation

---

# ✨ Key Features

## 👤 User Management

- JWT Authentication
- Role-Based Authorization
- Student
- Teacher
- Admin

---

## 🏁 Competition Management

### Internal Competitions

- Quiz
- Assignment
- Project

Teachers can:

- Create competitions
- Set deadlines
- Publish results
- Manage participants

---

### External Competitions

Admins and Students can create external competitions.

Students may:

- Register participation
- Upload certificates
- Submit proof documents
- Request attendance recovery

---

## 👥 Team Formation

- Create teams
- Invite members
- Accept/Reject invitations
- Team leader management
- One team per competition validation

---

## 📤 Submission System

Supports multiple submission types.

### Quiz

- Auto grading
- Multiple choice questions
- Instant results

### Assignment

Upload:

- PDF
- DOCX
- Images

### Project

Submit:

- GitHub Repository
- ZIP File
- Google Drive Link

Files are stored securely using **MongoDB GridFS**.

---

## 🏅 Achievement System

Students automatically earn:

- Badges
- Merit Points
- Achievements
- Milestones

Examples

- First Competition
- Top Performer
- Quiz Champion
- Project Excellence

---

## 📱 Social Feed

Achievement posts are generated automatically.

Students can:

- ❤️ Like
- 💬 Comment
- View leaderboard
- Celebrate achievements

Academic scores are **not affected** by social engagement.

---

## 🔔 Notification System

Real-time notifications using WebSocket.

Examples

- Competition Created
- Team Invitation
- Invitation Accepted
- Submission Deadline
- Achievement Earned
- Evaluation Published

---

# 🏛️ System Architecture

```
                 React + TypeScript
                        │
                 REST API + JWT
                        │
             Spring Boot Backend
                        │
 ┌──────────────┬───────────────┬──────────────┐
 │              │               │              │
MongoDB      GridFS        WebSocket      Spring Security
```

---

# 🛠 Technology Stack

| Category | Technology |
|-----------|------------|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend | Spring Boot 3 |
| Language | Java 21 |
| Database | MongoDB Atlas |
| File Storage | GridFS |
| Authentication | JWT |
| Security | Spring Security |
| Real-Time | WebSocket (STOMP) |
| Build Tool | Maven |
| Version Control | Git & GitHub |

---

# 🚀 Getting Started

## Prerequisites

- Java 21+
- Node.js 18+
- npm or Bun
- MongoDB Atlas

---

## Clone Repository

```bash
git clone https://github.com/yourusername/competition-management.git

cd competition-management
```

---

## Backend Setup

```bash
cd Backend
```

Create a `.env` file

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/database

```

Run the backend

```bash
mvn clean install

mvn spring-boot:run
```

Backend runs at

```
http://localhost:8082
```

---

## Frontend Setup

```bash
cd Frontend

npm install

npm run dev
```

Frontend runs at

```
http://localhost:5173
```

---

# 🔄 Application Workflow

```
Login
   │
   ▼
Role Authentication
   │
   ▼
Competition Created
   │
   ▼
Students Join
   │
   ▼
Team Formation
   │
   ▼
Submission
   │
   ▼
Evaluation
   │
   ▼
Achievement Generated
   │
   ▼
Social Feed Post
   │
   ▼
Notification Sent
```

---

# 📦 Modules

| Module | Description |
|---------|-------------|
| Module 1 | User & Role Management |
| Module 2 | Notification System |
| Module 3 | Competition Management |
| Module 4 | Team Formation |
| Module 5 | Internal Submission |
| Module 6 | Evaluation & Achievement |
| Module 7 | External Participation |
| Module 8 | Social Feed |
| Module 9 | Attendance Recovery |

---

# 🗄 Database Collections

| Collection | Purpose |
|------------|---------|
| USER | User accounts |
| COMPETITION | Competition details |
| QUESTION | Quiz questions |
| TEAM | Team management |
| SUBMISSION | Student submissions |
| ACHIEVEMENT | Achievements |
| MILESTONE | Badges & milestones |
| SOCIAL_POST | Social feed |
| EXTERNAL_PARTICIPATION | External competition records |
| ATTENDANCE_REPORT | Attendance recovery |
| NOTIFICATION | Notifications |

---

# 📸 Screenshots

> Add screenshots after implementation.

| Page | Preview |
|------|---------|
| Login | Coming Soon |
| Student Dashboard | Coming Soon |
| Competition List | Coming Soon |
| Team Management | Coming Soon |
| Submission | Coming Soon |
| Social Feed | Coming Soon |
| Admin Dashboard | Coming Soon |

---

# ⚠ Known Limitations

- No mobile application
- No plagiarism detection
- Basic recommendation system
- Limited analytics dashboard
- Email templates are basic
- Offline support unavailable

---

# 🚀 Future Enhancements

- 🤖 AI Competition Recommendation
- 📱 React Native Mobile App
- 📊 Advanced Analytics Dashboard
- 🎓 QR Code Certificate Generator
- 🧠 AI Evaluation Assistant
- 🔍 Plagiarism Detection
- 🌐 Inter-University Competition Support
- 📅 Google Calendar Integration

---

# 👥 Team Members

| Member | Responsibility |
|---------|----------------|
| **Your Name** | User Management, Notification System, Student-Created External Competition |
| **Member 2** | Competition Management |
| **Member 3** | Team Formation |
| **Member 4** | Submission & Evaluation |
| **Member 5** | External Participation, Social Feed, Attendance Recovery |

---

# 📚 References

- Spring Boot Documentation
- React Documentation
- MongoDB Atlas Documentation
- Tailwind CSS Documentation
- TypeScript Documentation

---

# 🙏 Acknowledgements

Special thanks to:

- University of Information Technology (UIT)
- Course instructors and supervisors
- Spring Boot Community
- React Community
- MongoDB Atlas
- Open Source Contributors

---

<div align="center">

### ⭐ If you found this project useful, consider giving it a star!

**Built with ❤️ using Spring Boot, React, TypeScript, and MongoDB**

</div>
