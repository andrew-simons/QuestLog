const mongoose = require("mongoose");

const QuestsSchema = new mongoose.Schema({
  title: String,
  description: String,
  rarity: String, // "common" | "rare" | "epic" | "legendary"
  xpReward: Number,
});

// compile model from schema
module.exports = mongoose.model("quests", QuestsSchema);
