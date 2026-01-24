const mongoose = require("mongoose");

const InventorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", index: true, required: true },
    itemKey: { type: String, required: true }, // references Item.key
    qty: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// Ensure one row per (user, itemKey)
InventorySchema.index({ userId: 1, itemKey: 1 }, { unique: true });


// compile model from schema
module.exports = mongoose.model("inventories", InventorySchema);
