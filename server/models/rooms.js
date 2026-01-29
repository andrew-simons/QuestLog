const mongoose = require("mongoose");
const PlacedItemSchema = require("./placedItems");

const RoomSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", unique: true, required: true },
    wallpaperKey: { type: String, default: "default_wallpaper" },

    beaver: {
      x: { type: Number, default: 525 },
      y: { type: Number, default: 510 },
      dir: { type: String, default: "down" },
    },

    placedItems: { type: [PlacedItemSchema], default: [] },
  },
  { timestamps: true }
);

// compile model from schema
module.exports = mongoose.model("rooms", RoomSchema);
