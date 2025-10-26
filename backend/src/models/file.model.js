const mongoose = require('mongoose');

const PinProviderSchema = new mongoose.Schema({
  name: String,
  pinId: String,
  pinnedAt: Date
}, { _id: false });

const FileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  cid: { type: String, index: true },
  sha256: { type: String, index: true },

  // visibility (keeps old enum but you can treat isPublic as primary)
  visibility: { type: String, enum: ['private', 'public'], default: 'private' },

  // Controlled sharing fields
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }], // explicit user shares
  isPublic: { type: Boolean, default: false }, // convenience — mirrors visibility/public link
  shareToken: { type: String, index: true, sparse: true }, // random token for public access
  shareExpiresAt: { type: Date, default: null },

  encrypted: { type: Boolean, default: false },
  encryption: {
    algorithm: String,
    wrappedKey: String
  },
  pinned: { type: Boolean, default: false },
  pinProviders: [PinProviderSchema],

  // ✅ Allowed statuses (includes deleted)
  status: { 
    type: String, 
    enum: ['uploading', 'available', 'processing', 'failed', 'deleted'], 
    default: 'uploading' 
  },

  createdAt: { type: Date, default: Date.now },

  // Thumbnail info
  thumbnail: {
    cid: String,
    format: String,
    width: Number,
    height: Number,
    generatedAt: Date
  }

}, { timestamps: true });

FileSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('File', FileSchema);
