const mongoose = require("mongoose");

const QuestSchema = new mongoose.Schema({
  id: String,
  icon: Image,
  rairity: String, 
  name: String, 
  completed: Boolean,
  journalText: String,
  journalImages: Array
});

// compile model from schema
module.exports = mongoose.model("quest", QuestSchema);
