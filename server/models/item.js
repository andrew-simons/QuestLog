const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  id: String, 
  name: String, 
  drawing: String,
  purchased: Boolean,
  cost: Number,
});

// compile model from schema
module.exports = mongoose.model("item", ItemSchema);
