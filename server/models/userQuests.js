const mongoose = require("mongoose");

const UserQuestsSchema = new mongoose.Schema({
  userId: String,
  questKey: Number,

  isCompleted: Boolean,
  completedAt: Date,

  // visibility: String, // "private" | "friends" | "public"
});

// prevent duplicates
UserQuestsSchema.index({ userId: 1, questKey: 1 }, { unique: true });

// compile model from schema
module.exports = mongoose.model("userQuests", UserQuestsSchema);
