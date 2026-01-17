const mongoose = require("mongoose");

const JournalEntriesSchema = new mongoose.Schema({
  userId: String,
  questId: String, // optional if it’s a “general entry”

  text: String,
  photoUrls: [String],
  createdAt: Date,
});

// compile model from schema
module.exports = mongoose.model("journalEntries", JournalEntriesSchema);
