Decentralized File Storage System (DCFS)

A production-ready decentralized file storage web application powered by the MERN stack, IPFS via Pinata, and Redis Cloud for real-time file management — built, deployed, and maintained by Abhishek S.

🌐 Frontend Live: https://decentralized-file-storage-system-eta.vercel.app/

🖥️ Backend Live: https://decentralized-file-storage-system-backend.onrender.com/

🚀 Overview

The Decentralized File Storage System (DCFS) enables users to upload, pin, and retrieve files on the InterPlanetary File System (IPFS) network using Pinata Cloud, while offering a secure and intuitive dashboard to manage all files.

It combines decentralization, scalability, and security — perfect for cloud-independent, censorship-resistant file management.

🧩 Tech Stack
Layer	Technology	Purpose
Frontend	React.js + Vite + Tailwind CSS	Responsive UI for uploads, dashboard, and preview
Backend	Node.js + Express.js	REST API for authentication, IPFS pinning, and retrieval
Database	MongoDB Atlas	Stores user credentials and file metadata
Decentralized Storage	IPFS via Pinata Cloud	Distributed storage for all uploaded files
Cache / Queue	Redis Cloud	Background job management for pinning and progress tracking
Authentication	JWT (JSON Web Tokens)	Secure session management
Deployment	Vercel (Frontend) + Render (Backend)	Scalable, production-grade cloud infrastructure
📸 Features
👤 Authentication

Secure Signup / Login with password hashing (bcrypt).

Stateless authentication using JWT tokens stored in cookies.

Protected routes on both frontend and backend.

📁 File Management

Upload and store files to IPFS (via Pinata API).

Supported formats: images, videos, PDFs, ZIPs, and more.

Maximum upload limit: 500MB.

Auto-generated IPFS CIDs with preview and metadata.

⚙️ Real-Time & Background Jobs

Uploads are handled asynchronously using BullMQ (Redis-based queue).

Server-Sent Events (SSE) provide live feedback on pinning status.

Users can see upload progress in real-time.

🧩 File Sharing

Choose between public (IPFS link) or controlled sharing.

Access control via MongoDB-stored sharedWith lists.

🖼️ File Preview Modal

Click thumbnails to preview images/videos instantly in a modal lightbox.

Displays file metadata like CID, size, and type.

💬 Admin Tools

Background job monitoring via BullMQ Dashboard (optional route).

API health route (/health) for monitoring uptime.

🌍 Deployment
Layer	Platform	URL
Frontend	Vercel
	https://decentralized-file-storage-system-eta.vercel.app

Backend	Render
	https://decentralized-file-storage-system-backend.onrender.com

Database	MongoDB Atlas
	Managed Cloud
Cache / Queue	Redis Cloud
	Message broker for background jobs
Storage	Pinata IPFS
	Decentralized file pinning
🧭 How It Works

User logs in — credentials validated via JWT auth.

User uploads a file — the backend saves it temporarily, then pins it to IPFS.

Background worker (BullMQ) handles large file processing asynchronously.

Pinata IPFS returns CID — the file becomes immutable and decentralized.

Dashboard updates in real-time via Redis pub/sub messages.

User can preview, download, or share the file instantly.

🧠 System Architecture
┌───────────────────────────┐
│        Frontend (React)   │
│  - Uploads via API        │
│  - Displays files, CIDs   │
│  - Real-time updates      │
└────────────┬──────────────┘
             │ REST API
┌────────────┴──────────────┐
│       Backend (Express)   │
│  - Auth & Token Mgmt      │
│  - File Upload Handling   │
│  - Pinata IPFS API Calls  │
│  - Queue Jobs → Redis     │
└────────────┬──────────────┘
             │
┌────────────┴──────────────┐
│   Redis Cloud (BullMQ)    │
│  - Background Workers     │
│  - Event Streams (SSE)    │
└────────────┬──────────────┘
             │
┌────────────┴──────────────┐
│  Pinata IPFS + MongoDB    │
│  - File Metadata Storage  │
│  - IPFS CID Persistence   │
└───────────────────────────┘

💡 Highlights

✅ CORS Whitelisting System
Dynamically configured via environment variable CORS_ORIGINS for production safety.
Supports both local (http://localhost:5173) and deployed (vercel.app) frontends.

✅ Fully Managed Infrastructure
No local Redis or Mongo setup required — all services are cloud-hosted and scalable.

✅ Security First

helmet() for hardened HTTP headers

cookieParser() for JWT handling

express-rate-limit for API protection

Environment-based config separation

✅ Modern UX
Built with Tailwind, animated components, and modal-based previews.

🧾 API Endpoints Summary
Method	Endpoint	Description
POST	/api/v1/auth/signup	Create a new user
POST	/api/v1/auth/login	Authenticate and return JWT
GET	/api/v1/files	Retrieve user’s uploaded files
POST	/api/v1/uploads	Upload a file and pin to IPFS
GET	/api/v1/streams/:cid	Stream or download a pinned file
GET	/health	Check backend health
🧩 Folder Structure
Decentralized-File-Storage-System/
│
├── backend/
│   ├── src/
│   │   ├── config/              # Configuration & constants
│   │   ├── controllers/         # Auth, Uploads, Files, Admin logic
│   │   ├── middlewares/         # Authentication, Validation, Error handling
│   │   ├── models/              # Mongoose models for users/files
│   │   ├── routes/              # Express route definitions
│   │   ├── services/            # Redis, IPFS, Queue, SSE logic
│   │   └── utils/               # Logger, Exceptions, Helpers
│   ├── package.json
│   └── Dockerfile (optional)
│
├── frontend/
│   ├── src/
│   │   ├── pages/               # Login, Upload, Dashboard
│   │   ├── components/          # Reusable UI parts
│   │   ├── hooks/               # Custom React hooks
│   │   └── utils/               # Helper functions
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
└── README.md

👨‍💻 Author

Abhishek S
BMS Institute of Technology and Management — CSE (2022–26)
Full Stack Developer | MERN Stack | DSA Enthusiast

📬 Connect with me:

GitHub: @abhishek-soundar

LinkedIn: [linkedin.com/in/abhishek-soundar
](https://www.linkedin.com/in/abhisheks11/)

🏁 Conclusion

The Decentralized File Storage System is a full-fledged demonstration of:

Cloud-native deployment

Decentralized architecture

Secure backend integration

Modern, responsive frontend

It bridges the gap between Web2 usability and Web3 decentralization — a perfect blend of performance, reliability, and innovation.

“A single file can live forever on IPFS — DCFS just makes it beautifully accessible.” 🚀
