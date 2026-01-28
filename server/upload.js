// server/upload.js
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join("/tmp", "uploads");

// ensure dir exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext) ? ext : ".png";
    cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`);
  },
});

function fileFilter(req, file, cb) {
  if (!file.mimetype?.startsWith("image/")) return cb(new Error("Only image uploads allowed"));
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per image
});

module.exports = { upload, UPLOAD_DIR };
