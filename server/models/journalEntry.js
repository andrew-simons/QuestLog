const mongoose = require("mongoose");

const JournalEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    questKey: { type: Number, required: true }, // 1 doc per completed quest

    text: { type: String, default: "" },
    photoUrls: { type: [String], default: [] },
  },
  { timestamps: true } // gives createdAt + updatedAt automatically
);

// enforce 1 per quest per user
JournalEntrySchema.index({ userId: 1, questKey: 1 }, { unique: true });

module.exports = mongoose.model("journalEntries", JournalEntrySchema);
