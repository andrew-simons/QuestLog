// Helper Methods
const User = require("./models/user");
const Quest = require("./models/quest");
const UserQuests = require("./models/userQuests");

// takes in a userId string. Outputs three random questKeys that don't include those
async function getThreeRandomDistinct(user_id) {
  const allQuests = await Quest.find({});

  const completed = await UserQuests.find(
    { userId: user_id, isCompleted: true },
    { questKey: 1, _id: 0 }
  );
  const completedQuestKeys = completed.map((q) => q.questKey);

  const availableQuestKeys = allQuests.map((q) => q.questKey).filter((q) => !completedQuestKeys.includes(q.questKey));

  if (availableQuestKeys.length < 3) {
    return availableQuestKeys;
  }

  const shuffled = [...availableQuestKeys].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);

  return selected;
}

module.exports = { getThreeRandomDistinct };
