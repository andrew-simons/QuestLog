const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  googleid: String,
  createdAt: Date,

  xp: Number,
  level: Number,
  coins: Number,

  equipped: {
    beaverSkinId: String,
    hatItemId: String,
    roomThemeId: String,
  },

  friendCode: { type: String, unique: true, index: true },

  currentQuestKeys: Array,
  completedQuestKeys: Array,
  roomId: String,

  // tutorial
  tutorialStep: { type: Number, default: 0 },
  tutorialDone: { type: Boolean, default: false },

  schemaVersion: { type: Number, default: 0 },
});

// compile model from schema
module.exports = mongoose.model("users", UserSchema);
