const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  googleid: String,
  friends: Array,
  level: Number,
  itemsOwned: Array,
  questsCompleted: Array,
  money: Number,
});

// compile model from schema
module.exports = mongoose.model("user", UserSchema);
