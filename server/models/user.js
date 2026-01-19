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

  currentQuestKeys: Array,
  completedQuestKeys: Array,
  roomId: String,
});

// compile model from schema
module.exports = mongoose.model("users", UserSchema);
