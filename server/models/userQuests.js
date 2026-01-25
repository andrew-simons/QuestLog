// server/models/userQuests.js
const mongoose = require("mongoose");

const UserQuestsSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

    // one of these two will be set:
    questKey: { type: Number, default: null },
    customQuestId: { type: mongoose.Schema.Types.ObjectId, ref: "customQuest", default: null },

    // helps backend decide reward rules
    source: { type: String, enum: ["builtin", "custom"], required: true },

    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Ensure exactly one identifier is present
UserQuestsSchema.pre("validate", function (next) {
  const hasQuestKey = this.questKey !== null && this.questKey !== undefined;
  const hasCustomId = !!this.customQuestId;

  if (this.source === "builtin" && !hasQuestKey) return next(new Error("builtin requires questKey"));
  if (this.source === "custom" && !hasCustomId) return next(new Error("custom requires customQuestId"));
  if (hasQuestKey && hasCustomId) return next(new Error("Provide questKey OR customQuestId, not both"));

  next();
});

// prevent duplicate builtin rows per user
UserQuestsSchema.index(
  { userId: 1, questKey: 1 },
  { unique: true, partialFilterExpression: { source: "builtin", questKey: { $type: "number" } } }
);

// prevent duplicate custom rows per user
UserQuestsSchema.index(
  { userId: 1, customQuestId: 1 },
  { unique: true, partialFilterExpression: { source: "custom", customQuestId: { $type: "objectId" } } }
);

module.exports = mongoose.model("userQuests", UserQuestsSchema);
