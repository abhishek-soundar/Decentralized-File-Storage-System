# DCFS Frontend

A complete React Vite frontend for the Distributed Content File System (DCFS) with support for file uploads, chunked uploads, real-time updates via SSE, and IPFS integration.

## Features

- **Authentication**: Login and register with JWT tokens
- **File Management**: Upload, view, and manage files
- **Chunked Uploads**: Large file support with parallel chunk uploads
- **Real-time Updates**: SSE integration for live job status updates
- **IPFS Integration**: Thumbnail preview and CID management
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Error Handling**: Graceful error handling with user-friendly messages

## Setup

### Prerequisites

- Node.js 16+ and npm

### Installation

1. Clone the repository and navigate to the frontend directory:
\`\`\`bash
cd frontend
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. **Important**: Place the background image in the public folder:
   - Copy your gradient background image to `public/bg-gradient.png`
   - Optionally copy a card sample image to `public/card-sample.png`

4. Create a `.env.local` file (optional, defaults to localhost):
\`\`\`
VITE_API_BASE=http://localhost:4000/api/v1
\`\`\`

### Running the App

Development server:
\`\`\`bash
npm run dev
\`\`\`

The app will open at `http://localhost:5173`

Build for production:
\`\`\`bash
npm run build
\`\`\`

## API Configuration

The frontend connects to a backend API. Configure the base URL via the `VITE_API_BASE` environment variable:

- **Development**: `http://localhost:4000/api/v1` (default)
- **Production**: Set via environment variables in your deployment platform

## Authentication

1. **Register**: Create a new account with name, email, and password
2. **Login**: Sign in with your email and password
3. **Token Storage**: JWT tokens are stored in localStorage under `dcfs_token`
4. **Auto-logout**: 401 responses automatically clear the token and redirect to login

## File Operations

### Simple Upload
1. Click "Upload File" on the dashboard
2. Select a file
3. Click "Upload" to upload via multipart/form-data
4. Progress bar shows upload percentage

### Chunked Upload
1. Click "Chunked Upload" on the dashboard
2. Select a file
3. The app will:
   - Initialize the upload (POST /uploads/init)
   - Split the file into 5MB chunks
   - Upload up to 4 chunks in parallel
   - Complete the upload (POST /uploads/:uploadId/complete)
4. Progress bar shows overall and per-chunk progress

### File Details
1. Click on any file card to view details
2. See file metadata, thumbnail, and CID
3. Download the file
4. Verify the file (enqueues verification job)

## Real-time Updates (SSE)

The app uses Server-Sent Events to receive real-time job updates:

- **Connection**: `GET /streams/jobs`
- **Authentication**: 
  - Default: Cookie-based (ensure credentials are sent)
  - Alternative: Query parameter `?token=<jwt>` (set `useTokenQuery: true` in useSSE options)
- **Events**: `pin:success`, `thumb:success`, `verify:success` trigger dashboard refresh

### Testing SSE Connection

If SSE doesn't work in development:

1. **Option 1**: Use ModHeader browser extension to add Authorization header
2. **Option 2**: Configure backend to accept token as query parameter
3. **Option 3**: Use cookie-based authentication

Update `src/hooks/useSSE.js` to enable token query parameter:
\`\`\`javascript
useSSE((event) => {
  // handle event
}, { useTokenQuery: true })
\`\`\`

## Testing with curl

### Register
\`\`\`bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
\`\`\`

### Login
\`\`\`bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
\`\`\`

### Upload File
\`\`\`bash
curl -X POST http://localhost:4000/api/v1/files/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/file"
\`\`\`

### List Files
\`\`\`bash
curl -X GET http://localhost:4000/api/v1/files \
  -H "Authorization: Bearer <token>"
\`\`\`

## Folder Structure

\`\`\`
frontend/
├── public/
│   ├── bg-gradient.png        # Background image (required)
│   └── card-sample.png        # Optional card reference
├── src/
│   ├── api/
│   │   └── axios.js           # Axios instance with auth
│   ├── auth/
│   │   ├── AuthProvider.jsx   # Auth context provider
│   │   └── useAuth.js         # Auth hook
│   ├── components/
│   │   ├── Card.jsx           # Reusable card component
│   │   ├── FileCard.jsx       # File card with thumbnail
│   │   ├── ProgressBar.jsx    # Upload progress bar
│   │   └── ChunkedUploader.jsx # Chunked upload component
│   ├── hooks/
│   │   └── useSSE.js          # SSE hook for real-time updates
│   ├── pages/
│   │   ├── Login.jsx          # Login/Register page
│   │   ├── Dashboard.jsx      # File list dashboard
│   │   ├── Upload.jsx         # Simple upload page
│   │   ├── ChunkUploadPage.jsx # Chunked upload page
│   │   └── FileDetail.jsx     # File details page
│   ├── utils/
│   │   └── bytes.js           # Utility functions
│   ├── App.jsx                # Main app component
│   ├── main.jsx               # React entry point
│   └── index.css              # Global styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.cjs
\`\`\`

## Styling

- **Framework**: Tailwind CSS v3
- **Colors**: Indigo primary, pink accent, gold CTA buttons
- **Cards**: Rounded corners, soft shadows, subtle borders
- **Responsive**: Mobile-first design with breakpoints at md (768px) and lg (1024px)
- **Animations**: Hover effects on cards and buttons

## Error Handling

- **API Errors**: User-friendly error messages displayed in alerts
- **401 Unauthorized**: Automatic logout and redirect to login
- **Network Errors**: Graceful fallback with error messages
- **Upload Failures**: Detailed error messages with retry option

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Troubleshooting

### SSE Connection Fails
- Check backend is running and accessible
- Verify CORS settings on backend
- Try enabling `useTokenQuery: true` in useSSE hook
- Check browser console for errors

### Upload Fails
- Verify backend is running
- Check file size limits on backend
- Ensure proper CORS headers
- Check network tab for actual error response

### Token Not Persisting
- Check localStorage is enabled in browser
- Verify token is being stored correctly
- Check for private/incognito mode restrictions

## License

MIT
