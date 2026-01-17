const mongoose = require("mongoose");

const InventoriesSchema = new mongoose.Schema({
  userId: String,
  itemIds: [String],
});

// compile model from schema
module.exports = mongoose.model("inventories", InventoriesSchema);
