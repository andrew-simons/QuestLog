// server/models/customQuest.js
const mongoose = require("mongoose");

const CustomQuestSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },

    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    tags: { type: [String], default: [] },

    visibility: {
      type: String,
      enum: ["private", "friends", "public"],
      default: "public",
      required: true,
    },
  },
  { timestamps: true }
);

CustomQuestSchema.index({ createdAt: -1 });
CustomQuestSchema.index({ visibility: 1, createdAt: -1 });
CustomQuestSchema.index({ title: "text", description: "text", tags: "text" });

module.exports = mongoose.model("customQuest", CustomQuestSchema);
