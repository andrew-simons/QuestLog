const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  googleid: String,
  friends: Array,
  level: Int32Array,
  itemsOwned: Array,
  questsCompleted: Array,
  money: Int32Array,
});

// compile model from schema
module.exports = mongoose.model("user", UserSchema);
