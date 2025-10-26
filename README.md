Decentralized File Storage System (DCFS)

A fully functional, production-deployed decentralized file storage web application built with the MERN stack, integrated with IPFS via Pinata, Redis for real-time job management, and JWT-based authentication for secure access.

🌐 Frontend Live: https://decentralized-file-storage-system-eta.vercel.app/

🖥️ Backend Live: https://decentralized-file-storage-system-backend.onrender.com/

🚀 Overview

The Decentralized File Storage System (DCFS) allows users to securely upload, pin, and retrieve files over a decentralized storage network using IPFS (InterPlanetary File System).

It ensures:

💾 Decentralized storage — files are uploaded via Pinata IPFS Gateway and stored immutably.

🔒 Secure access — users authenticate using JWT tokens (with cookies fallback).

⚡ Fast real-time performance — powered by Redis + BullMQ for background jobs.

🎨 Modern responsive UI — built using React + Vite, deployed on Vercel.

🌍 Scalable backend — built using Express.js, MongoDB, and deployed on Render.

🧩 Tech Stack
Layer	Technology	Purpose
Frontend	React.js + Vite + Tailwind CSS	Responsive, fast SPA for upload, login, and dashboard
Backend	Node.js + Express.js	REST API with authentication, file handling, and IPFS pinning
Database	MongoDB Atlas	Store user credentials and metadata
Decentralized Storage	IPFS via Pinata Cloud	Actual file storage on a distributed network
Cache / Queue	Redis Cloud	Queue management and real-time updates
Authentication	JWT (JSON Web Token)	Secure stateless authentication
Deployment	Vercel (Frontend), Render (Backend)	Global CDN and containerized runtime for scalability
📸 Features
👤 User Authentication

Secure Sign Up and Login using JWT.

Passwords hashed before storage.

Session persistence with secure HTTP-only cookies.

📤 File Upload & Pinning

Uploads images, videos, PDFs, ZIPs, and other supported types.

Pinned automatically to IPFS via Pinata API.

Generates unique IPFS CID for retrieval.

500MB max upload limit (configurable).

📂 File Management

Each user can view uploaded files with metadata (name, size, type, CID).

Download files directly using IPFS gateway links.

Files stored immutably and verifiably.

⚙️ Background Jobs (Redis + BullMQ)

File processing and IPFS pinning handled asynchronously.

Ensures fast uploads and non-blocking API.

Redis connection configured via Redis Cloud.

💬 Real-time SSE Notifications

Live feedback to frontend during uploads or processing.

Uses Redis pub/sub channels (dfsd:jobs).

🔐 Role-based Access

Admin routes for system monitoring (optional).

Secure route middleware ensuring only authenticated access.

⚙️ Environment Configuration

Below are the essential .env variables used across both environments:

🖥️ Backend (.env)
NODE_ENV=production
PORT=4000

# MongoDB Connection
MONGO_URI=mongodb+srv://user:QEWKm0s4wCGkhhPh@cluster0.4nourli.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0

# Authentication
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=1d

# File Upload Config
MAX_UPLOAD_SIZE_BYTES=524288000
TEMP_UPLOAD_DIR=./tmp/uploads
ALLOWED_MIMETYPES=image/*,video/*,application/pdf,application/zip

# IPFS / Pinata
PINATA_JWT=<your_pinata_jwt_token>
PINATA_API_KEY=1e7424f31247e97322c2
PINATA_API_SECRET=1c3ab0e914fa97439b8295e0d79b2423ccaf748abd4764eddfae9c8911063a43

# Redis Cloud
REDIS_URL=rediss://default:VXy09zx5ktQEj2KBg6akZoctJKBVpV6P@redis-16803.crce182.ap-south-1-1.ec2.redns.redis-cloud.com:16803

# CORS
CORS_ORIGINS=http://localhost:5173,https://decentralized-file-storage-system-eta.vercel.app

# Logging
LOG_LEVEL=info

🛠️ Project Setup (Local Development)
1️⃣ Clone Repository
git clone https://github.com/abhishek-soundar/Decentralized-File-Storage-System.git
cd Decentralized-File-Storage-System

2️⃣ Backend Setup
cd backend
npm install


Create a .env file (copy from example above) and start the backend:

npm run dev


It should show:

[info] MongoDB connected
[info] Server running on port 4000 — env development

3️⃣ Frontend Setup
cd ../frontend
npm install
npm run dev


Now open:
👉 http://localhost:5173

🌍 Deployment Details
Layer	Platform	URL
Frontend	Vercel	https://decentralized-file-storage-system-eta.vercel.app

Backend	Render	https://decentralized-file-storage-system-backend.onrender.com

Database	MongoDB Atlas	Managed Cloud
Redis	Redis Cloud	Managed Cache
IPFS	Pinata Cloud	File Storage Gateway
🧩 Folder Structure
Decentralized-File-Storage-System/
│
├── backend/
│   ├── src/
│   │   ├── config/              # Environment setup & constants
│   │   ├── controllers/         # Route logic (auth, uploads, streams)
│   │   ├── middlewares/         # Error handling, auth validation
│   │   ├── routes/              # Express routers
│   │   ├── services/            # IPFS, Redis, BullMQ logic
│   │   └── utils/               # Logger & helper functions
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── src/
│   │   ├── pages/               # Login, Signup, Dashboard
│   │   ├── components/          # Upload form, file cards, navbar
│   │   ├── utils/               # API helpers, axios config
│   │   └── styles/              # Tailwind styles
│   ├── package.json
│   └── vite.config.js
│
└── README.md

🔐 API Endpoints Summary
Method	Endpoint	Description
POST	/api/v1/auth/signup	Register a new user
POST	/api/v1/auth/login	Authenticate & return JWT
GET	/api/v1/files/list	Get all uploaded files
POST	/api/v1/uploads	Upload a file to IPFS via Pinata
GET	/api/v1/streams/:cid	Stream/download file from IPFS
GET	/health	Backend health check
💡 Highlights & Implementation Insights

Redis Cloud Integration:
Used as a message broker to handle file uploads asynchronously and emit progress updates using Server-Sent Events (SSE).

Pinata IPFS Integration:
The backend uploads files to IPFS through Pinata’s JWT-based API, ensuring secure, rate-limited access.

CORS Whitelisting System:
Dynamically configured from CORS_ORIGINS env var. This enables secure access for both local (localhost:5173) and production (vercel.app) frontends.

Security Best Practices:

helmet() for HTTP headers

cookieParser() for secure token management

Strict MIME-type filtering on uploads

JWT tokens with expiration & rotation

Scalability:
Fully containerized and horizontally scalable on Render.
Redis ensures background queue separation from the API thread.

🧾 License

This project is licensed under the MIT License — free to use, modify, and distribute with attribution.

✨ Author

👨‍💻 Abhishek S
BMS Institute of Technology and Management (CSE 2022–26)
Full Stack Developer | MERN | DSA | Problem Solver

📬 Reach me on:

GitHub: @abhishek-soundar

LinkedIn: linkedin.com/in/abhishek-soundar

🌟 Acknowledgments

Render
 for free-tier backend hosting

Vercel
 for frontend deployment

MongoDB Atlas
 for managed database

Pinata
 for IPFS pinning service

Redis Cloud
 for managed in-memory data store

🎯 Final Notes

This project demonstrates a production-ready decentralized file storage solution using modern full-stack practices:

Secure authentication

Real-time event handling

Scalable cloud deployment

Clean code organization

“Decentralized storage isn’t the future — it’s already here.” 🚀
