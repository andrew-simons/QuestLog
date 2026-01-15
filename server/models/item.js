const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  id: String, 
  name: String, 
  drawing: Image,
  purchased: Boolean,
  cost: Int32Array,
});

// compile model from schema
module.exports = mongoose.model("item", ItemSchema);
