const mongoose = require("mongoose");

const FriendshipSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "blocked"],
      default: "pending",
      required: true,
    },
  },
  { timestamps: true } // adds createdAt, updatedAt
);

// A->B unique
FriendshipSchema.index({ requester: 1, recipient: 1 }, { unique: true });

// Fast queries like: “all accepted for user X”
FriendshipSchema.index({ status: 1, requester: 1 });
FriendshipSchema.index({ status: 1, recipient: 1 });

module.exports = mongoose.model("friendship", FriendshipSchema);
