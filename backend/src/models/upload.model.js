// src/models/upload.model.js
const mongoose = require('mongoose');

const uploadSchema = new mongoose.Schema({
  uploadId: { type: String, required: true, index: true, unique: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true },
  mimeType: { type: String },
  totalChunks: { type: Number, required: true },
  chunkSize: { type: Number },
  fileSize: { type: Number },
  receivedChunks: { type: [Number], default: [] }, // array of chunk indices received
  status: { type: String, enum: ['uploading','assembling','done','error'], default: 'uploading' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Upload', uploadSchema);
