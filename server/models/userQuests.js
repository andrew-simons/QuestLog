const mongoose = require("mongoose");

const UserQuestsSchema = new mongoose.Schema({
  userId: String,
  questId: String,

  isCompleted: Boolean,
  completedAt: Date,

  visibility: String, // "private" | "friends" | "public"
});

// compile model from schema
module.exports = mongoose.model("userQuests", UserQuestsSchema);
