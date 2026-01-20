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

// sends an array of quest objects
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

// updates + sends an array of quest objects
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

// GET all userQuest docs for the currently logged-in user
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




// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;
