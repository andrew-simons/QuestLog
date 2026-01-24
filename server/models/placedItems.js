const mongoose = require("mongoose");

const PlacedItemSchema = new mongoose.Schema(
  {
    instanceId: { type: String, required: true }, // uuid or random string
    itemKey: { type: String, required: true }, // references Item.key

    x: { type: Number, required: true },
    y: { type: Number, required: true },
    scale: { type: Number, default: 1.0 },
    rotation: { type: Number, default: 0 }, // optional
  },
  { _id: false }
);

module.exports = PlacedItemSchema;
