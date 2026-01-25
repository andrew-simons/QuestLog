const mongoose = require("mongoose");

const JournalEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

    // NEW: which kind of quest this journal belongs to
    source: { type: String, enum: ["builtin", "custom"], required: true },

    // one of these is set depending on source
    questKey: { type: Number }, // builtin
    customQuestId: { type: mongoose.Schema.Types.ObjectId, ref: "customQuests" }, // custom

    text: { type: String, default: "" },
    photoUrls: { ype: [String], default: [] },
  },
  { timestamps: true }
);

// Ensure exactly one of questKey/customQuestId is set (basic safety)
JournalEntrySchema.pre("validate", function (next) {
  if (this.source === "builtin" && typeof this.questKey !== "number") {
    return next(new Error("builtin journal must have questKey"));
  }
  if (this.source === "custom" && !this.customQuestId) {
    return next(new Error("custom journal must have customQuestId"));
  }
  next();
});

// Unique per-user per quest (for builtin + custom separately)
JournalEntrySchema.index({ userId: 1, source: 1, questKey: 1 }, { unique: true, sparse: true });
JournalEntrySchema.index(
  { userId: 1, source: 1, customQuestId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.model("journalEntry", JournalEntrySchema);
