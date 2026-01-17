const mongoose = require("mongoose");

const RoomsSchema = new mongoose.Schema({
  ownerUserId: String, // ref users
  layout: Object, // e.g. { placedItems: [ { itemId, x, y, rotation } ] }
  updatedAt: Date,
});

// compile model from schema
module.exports = mongoose.model("rooms", RoomsSchema);
