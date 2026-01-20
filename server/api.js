/*
|--------------------------------------------------------------------------
| api.js -- server routes
|--------------------------------------------------------------------------
|
| This file defines the routes for your server.
|
*/

const express = require("express");

// import models so we can interact with the database
const User = require("./models/user");
const Quest = require("./models/quest");
const Item = require("./models/item");
const UserQuest = require("./models/userQuests");
const JournalEntry = require("./models/journalEntry");

const { getThreeRandomDistinct } = require("./helper");

// import authentication library
const auth = require("./auth");

// api endpoints: all these paths will be prefixed with "/api/"
const router = express.Router();

//initialize socket
const socketManager = require("./server-socket");

router.post("/login", auth.login);
router.post("/logout", auth.logout);
router.get("/whoami", (req, res) => {
  if (!req.user) {
    // not logged in
    return res.send({});
  }

  res.send(req.user);
});

router.post("/initsocket", (req, res) => {
  // do nothing if user not logged in
  if (req.user)
    socketManager.addUser(req.user, socketManager.getSocketFromSocketID(req.body.socketid));
  res.send({});
});

// |------------------------------|
// | write your API methods below!|
// |------------------------------|

/**
 * GET /api/currentquests
 * Returns the user's current quests (Quest documents) based on req.user.currentQuestKeys.
 *
 * Auth: Required.
 * Query: none
 *
 * Response:
 *   - 200: Quest[] (array of quest docs)
 *     Example quest: { questKey: number, title: string, rarity: string, xpReward: number, ... }
 * Errors:
 *   - 401: not logged in
 *   - 500: server/db error
 *
 * Notes:
 *   - If currentQuestKeys is empty/missing, returns []
 */
router.get("/currentquests", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const keys = req.user.currentQuestKeys || [];

    const quests = await Quest.find({ questKey: { $in: keys } });

    res.send(quests);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to get current quests" });
  }
});

/**
 * GET /api/currentquests
 * Returns the user's current quests (Quest documents) based on req.user.currentQuestKeys.
 *
 * Auth: Required.
 * Query: none
 *
 * Response:
 *   - 200: Quest[] (array of quest docs)
 *     Example quest: { questKey: number, title: string, rarity: string, xpReward: number, ... }
 * Errors:
 *   - 401: not logged in
 *   - 500: server/db error
 *
 * Notes:
 *   - If currentQuestKeys is empty/missing, returns []
 */
router.patch("/currentquests/refresh", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const newKeys = await getThreeRandomDistinct(req.user._id);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { currentQuestKeys: newKeys },
      { new: true }
    ).lean();

    req.session.user = updatedUser; // keep session updated

    const quests = await Quest.find({ questKey: { $in: newKeys } });
    res.send(quests);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to refresh quests" });
  }
});

/**
 * GET /api/userquests
 * Returns all UserQuest documents for the currently logged-in user.
 * Used by the frontend to build a lookup map of questKey -> completion status.
 *
 * Auth: Required.
 * Query: none
 *
 * Response:
 *   - 200: UserQuest[] (array of userQuest docs)
 *     Example: { userId: ObjectId, questKey: number, isCompleted: boolean, completedAt: Date|null, ... }
 * Errors:
 *   - 401: not logged in
 *   - 500: server/db error
 *
 * Notes:
 *   - If user has no userQuest docs, returns []
 */
router.get("/userquests", (req, res) => {
  if (!req.user) {
    return res.status(401).send({ error: "Not logged in" });
  }

  UserQuest.find({ userId: req.user._id })
    .then((userQuests) => {
      res.send(userQuests); // array of docs
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send({ error: "Failed to fetch user quests" });
    });
});

/**
 * PATCH /api/userquests
 * Upserts (creates if missing) the user's UserQuest document for a specific questKey and sets completion state.
 *
 * Auth: Required.
 * Body:
 *   - questKey: number (required)
 *   - isCompleted: boolean (required)
 *
 * Response:
 *   - 200: UserQuest (the updated/created doc)
 * Errors:
 *   - 400: missing questKey or invalid types
 *   - 401: not logged in
 *   - 409: duplicate record (if unique index exists and a conflict happens)
 *   - 500: server/db error
 *
 * Side effects:
 *   - Writes to userQuests collection
 *   - Sets completedAt = now when isCompleted=true, otherwise null
 *
 * Notes:
 *   - Uses upsert so the doc is created even if it doesn't exist yet for (userId, questKey)
 */
router.patch("/userquests", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).send({ error: "Not logged in" });
    }

    let { questKey, isCompleted } = req.body;

    // ---- Validation ----
    if (questKey === undefined || questKey === null) {
      return res.status(400).send({ error: "questKey is required" });
    }
    if (typeof isCompleted !== "boolean") {
      return res.status(400).send({ error: "isCompleted must be a boolean" });
    }

    // Make sure questKey is a Number
    questKey = Number(questKey);
    if (Number.isNaN(questKey)) {
      return res.status(400).send({ error: "questKey must be a number" });
    }

    const filter = {
      userId: req.user._id,
      questKey: questKey,
    };

    const update = {
      $set: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
      },
      $setOnInsert: {
        userId: req.user._id,
        questKey: questKey,
      },
    };

    const options = {
      new: true,
      upsert: true,
      runValidators: true,
    };

    const doc = await UserQuest.findOneAndUpdate(filter, update, options);
    res.send(doc);
  } catch (err) {
    console.error(err);

    if (err.code === 11000) {
      return res.status(409).send({ error: "Duplicate quest record" });
    }

    res.status(500).send({ error: "Failed to update user quest" });
  }
});

router.get("/completedquests", async (req, res) => {
  const completed = await UserQuest.find({ userId, isCompleted: true }).select("questKey");
  const keys = completed.map((d) => d.questKey);
  res.send(keys)
});

/**
 * GET /api/journal
 * Returns completed quests + their single editable journal docs (if they exist).
 * If a journal doc doesn't exist yet, frontend treats it as blank.
 */
router.get("/journal", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const userId = req.user._id;

    // completed quest keys
    const completed = await UserQuest.find({ userId, isCompleted: true }).select("questKey");
    const keys = completed.map((d) => d.questKey);

    if (keys.length === 0) return res.send({ quests: [], journals: [] });

    // fetch quest metadata
    const quests = await Quest.find({ questKey: { $in: keys } });

    // fetch existing journals (some may not exist yet)
    const journals = await JournalEntry.find({ userId, questKey: { $in: keys } });

    res.send({ quests, journals });
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to load journal" });
  }
});

/**
 * PATCH /api/journal
 * Upserts the single journal doc for (userId, questKey).
 * Body:
 *  - questKey: number (required)
 *  - text?: string
 *  - photoUrls?: string[]
 * Returns: the updated journal doc
 */
router.patch("/journal", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const userId = req.user._id;
    let { questKey, text, photoUrls } = req.body;

    questKey = Number(questKey);
    if (Number.isNaN(questKey)) return res.status(400).send({ error: "questKey must be a number" });

    const $set = {};
    if (text !== undefined) {
      if (typeof text !== "string") return res.status(400).send({ error: "text must be a string" });
      $set.text = text;
    }
    if (photoUrls !== undefined) {
      if (!Array.isArray(photoUrls) || !photoUrls.every((u) => typeof u === "string")) {
        return res.status(400).send({ error: "photoUrls must be string[]" });
      }
      $set.photoUrls = photoUrls;
    }

    const doc = await JournalEntry.findOneAndUpdate(
      { userId, questKey },
      { $set, $setOnInsert: { userId, questKey } },
      { new: true, upsert: true, runValidators: true }
    );

    res.send(doc);
  } catch (err) {
    console.log(err);
    if (err.code === 11000) return res.status(409).send({ error: "Duplicate journal doc" });
    res.status(500).send({ error: "Failed to update journal" });
  }
});

// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;
