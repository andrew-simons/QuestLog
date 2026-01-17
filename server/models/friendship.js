const mongoose = require("mongoose");

const FriendshipsSchema = new mongoose.Schema({
  requesterId: String,
  recipientId: String,
  status: String, // "pending" | "accepted" | "blocked"
  createdAt: Date,
});

// compile model from schema
module.exports = mongoose.model("friendships", FriendshipsSchema);
