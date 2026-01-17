const mongoose = require("mongoose");

const ItemsSchema = new mongoose.Schema({
  name: String,
  type: String, // "hat" | "outfit" | "roomDecor" | "wallpaper" | ...
  priceCoins: Number,
  rarity: String,
});

// compile model from schema
module.exports = mongoose.model("items", ItemsSchema);
