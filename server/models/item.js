const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // "chair_basic"
  name: { type: String, required: true },

  type: {
    type: String,
    enum: ["hat", "outfit", "roomDecor", "wallpaper"],
    required: true,
  },

  priceCoins: { type: Number, default: 0 },
  rarity: { type: String, enum: ["common", "rare", "epic", "legendary"], default: "common" },

  // Rendering / behavior metadata
  imageKey: { type: String, required: true }, // matches useAssets manifest key (in Home.jsx)
  defaultScale: { type: Number, default: 1.0 },
  maxOwned: { type: Number, default: 1 }, // e.g. chair can be 1, coin can be 99, etc.

  isAvailable: { type: Boolean, default: true },

  // Optional: for nicer hitboxes/anchoring
  // anchor: { type: String, enum: ["bottomCenter", "center"], default: "bottomCenter" },
});

// compile model from schema
module.exports = mongoose.model("items", ItemSchema);
