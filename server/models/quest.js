const mongoose = require("mongoose");

const QuestsSchema = new mongoose.Schema({
  questKey: Number,
  title: String,
  // description: String,
  rarity: String, // "Common" | "Rare" | "Epic" | "Legendary"
  xpReward: Number,
});

// compile model from schema
module.exports = mongoose.model("quests", QuestsSchema);
