// Helper Methods
const Quest = require("./models/quest");
const UserQuests = require("./models/userQuests");
const User = require("./models/user");
const Friendship = require("./models/friendship");

// takes in a userId string. Outputs three random questKeys that don't include those
async function getThreeRandomDistinct(user_id) {
  const allQuests = await Quest.find({});

  const completed = await UserQuests.find(
    { userId: user_id, isCompleted: true },
    { questKey: 1, _id: 0 }
  );
  const completedQuestKeys = completed.map((q) => q.questKey);

  const availableQuestKeys = allQuests
    .map((q) => q.questKey)
    .filter((key) => !completedQuestKeys.includes(key));

  if (availableQuestKeys.length < 3) {
    return availableQuestKeys;
  }

  const shuffled = [...availableQuestKeys].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  console.log(completed);
  console.log(completedQuestKeys);
  console.log(availableQuestKeys);

  return selected;
}

function xpRequiredForLevel(level) {
  return Math.floor(50 * level ** 1.5);
}

// returns ONE questKey not completed + not in excludeKeys
async function getOneRandomAvailableQuestKey(userId, excludeKeys = []) {
  // completed quest keys
  const completed = await UserQuests.find({ userId, isCompleted: true }).select("questKey -_id");
  const completedKeys = new Set(completed.map((d) => d.questKey));

  // exclude current keys too
  const exclude = new Set(excludeKeys.map(Number));

  const all = await Quest.find({}).select("questKey -_id");
  const available = all
    .map((q) => q.questKey)
    .filter((k) => !completedKeys.has(k) && !exclude.has(k));

  if (available.length === 0) return null;

  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}

// (helper)
function generateFriendCode() {
  // 6 chars, uppercase
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
async function generateUniqueFriendCode() {
  while (true) {
    const code = generateFriendCode();
    const exists = await User.exists({ friendCode: code });
    if (!exists) return code;
  }
}

async function getAcceptedFriendIds(userId) {
  const edges = await Friendship.find({
    status: "accepted",
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .select("requester recipient")
    .lean();

  return edges.map((e) => (String(e.requester) === String(userId) ? e.recipient : e.requester));
}

module.exports = {
  getThreeRandomDistinct,
  xpRequiredForLevel,
  getOneRandomAvailableQuestKey,
  generateUniqueFriendCode,
  getAcceptedFriendIds,
};
