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
const Room = require("./models/rooms");
const Inventory = require("./models/inventory");
const CustomQuest = require("./models/customQuests");
const Friendship = require("./models/friendship");

const {
  getThreeRandomDistinct,
  xpRequiredForLevel,
  getOneRandomAvailableQuestKey,
} = require("./helper");

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
 * PATCH /api/currentquests
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
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    let { source, questKey, customQuestId, isCompleted } = req.body;

    if (source !== "builtin" && source !== "custom") {
      return res.status(400).send({ error: "source must be 'builtin' or 'custom'" });
    }
    if (typeof isCompleted !== "boolean") {
      return res.status(400).send({ error: "isCompleted must be a boolean" });
    }

    // Identify the quest + set rewards (SERVER SIDE)
    let coinsAward = 0;
    let expAward = 0;
    let filter = { userId: req.user._id, source };

    if (source === "builtin") {
      questKey = Number(questKey);
      if (Number.isNaN(questKey))
        return res.status(400).send({ error: "questKey must be a number" });

      const COINS_BY_RARITY = { common: 10, rare: 25, epic: 60, legendary: 150 };
      const EXP_BY_RARITY = { common: 10, rare: 25, epic: 60, legendary: 150 };

      const quest = await Quest.findOne({ questKey }).lean();
      if (!quest) return res.status(400).send({ error: "Invalid questKey (quest not found)" });

      const rarityRaw = quest.rarity ?? quest.rarityLevel ?? quest.tier;
      const rarity = String(rarityRaw || "").toLowerCase();
      if (!COINS_BY_RARITY[rarity]) {
        return res.status(500).send({ error: `Unknown rarity on quest: ${rarityRaw}` });
      }

      coinsAward = COINS_BY_RARITY[rarity];
      expAward = typeof quest.expReward === "number" ? quest.expReward : EXP_BY_RARITY[rarity];

      filter.questKey = questKey;
    } else {
      // custom
      if (!customQuestId || typeof customQuestId !== "string") {
        return res.status(400).send({ error: "customQuestId is required" });
      }

      const cq = await CustomQuest.findOne({
        _id: customQuestId,
        $or: [{ visibility: "public" }, { creatorId: req.user._id }],
      }).lean();

      if (!cq)
        return res.status(400).send({ error: "Custom quest not found or not visible to you" });

      if (!cq) return res.status(400).send({ error: "Custom quest not found" });

      coinsAward = 0;
      expAward = 20;

      filter.customQuestId = customQuestId;
    }

    const existing = await UserQuest.findOne(filter).lean();
    const wasCompleted = !!existing?.isCompleted;
    const isNowCompleting = !wasCompleted && isCompleted === true;

    const doc = await UserQuest.findOneAndUpdate(
      filter,
      {
        $set: { isCompleted, completedAt: isCompleted ? new Date() : null },
        $setOnInsert: {
          userId: req.user._id,
          source,
          ...(source === "builtin" ? { questKey } : { customQuestId }),
        },
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    let awarded = null;
    let currentQuests = null;
    let currentQuestKeys = null;

    if (isNowCompleting) {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).send({ error: "User not found" });

      user.coins = (user.coins ?? 0) + coinsAward;
      user.xp = (user.xp ?? 0) + expAward;
      user.level = user.level ?? 1;

      while (user.xp >= xpRequiredForLevel(user.level)) {
        user.xp -= xpRequiredForLevel(user.level);
        user.level += 1;
      }

      // Only replace currentQuestKeys for BUILTIN quests (custom quests are separate list)
      if (source === "builtin") {
        const current = (user.currentQuestKeys ?? []).map(Number);

        if (current.includes(questKey)) {
          const replacement = await getOneRandomAvailableQuestKey(user._id, current);

          const nextKeys = current
            .map((k) => (k === questKey ? replacement : k))
            .filter((k) => k != null);

          user.currentQuestKeys = nextKeys;
        }

        currentQuestKeys = (user.currentQuestKeys ?? []).map(Number);

        const found = await Quest.find({ questKey: { $in: currentQuestKeys } }).lean();
        const byKey = new Map(found.map((q) => [Number(q.questKey), q]));
        currentQuests = currentQuestKeys.map((k) => byKey.get(Number(k))).filter(Boolean);
      }

      await user.save();
      req.session.user = user.toObject ? user.toObject() : user;

      awarded = { coins: coinsAward, exp: expAward, source };
    }

    return res.send({ userQuest: doc, awarded, currentQuestKeys, currentQuests });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) return res.status(409).send({ error: "Duplicate quest record" });
    return res.status(500).send({ error: "Failed to update user quest" });
  }
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

    const completed = await UserQuest.find({ userId, isCompleted: true })
      .select("source questKey customQuestId")
      .lean();

    const builtinKeys = completed
      .filter((d) => d.source === "builtin")
      .map((d) => Number(d.questKey))
      .filter((k) => Number.isFinite(k));

    const customIds = completed
      .filter((d) => d.source === "custom")
      .map((d) => String(d.customQuestId))
      .filter(Boolean);

    // Fetch quest docs
    const [builtinQuests, customQuests] = await Promise.all([
      builtinKeys.length
        ? Quest.find({ questKey: { $in: builtinKeys } }).lean()
        : Promise.resolve([]),
      customIds.length ? CustomQuest.find({ _id: { $in: customIds } }).lean() : Promise.resolve([]),
    ]);

    // Keep builtin order by key (optional, nice UX)
    const builtinByKey = new Map(builtinQuests.map((q) => [Number(q.questKey), q]));
    const builtinOrdered = builtinKeys.map((k) => builtinByKey.get(k)).filter(Boolean);

    // Journals for BOTH sources
    const journals = await JournalEntry.find({
      userId,
      $or: [
        { source: "builtin", questKey: { $in: builtinKeys } },
        { source: "custom", customQuestId: { $in: customIds } },
      ],
    }).lean();

    res.send({
      builtinQuests: builtinOrdered,
      customQuests,
      journals,
    });
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
    let { source, questKey, customQuestId, text, photoUrls } = req.body;

    if (source !== "builtin" && source !== "custom") {
      return res.status(400).send({ error: "source must be 'builtin' or 'custom'" });
    }

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

    // Build filter based on source
    let filter = { userId, source };
    let insert = { userId, source };

    if (source === "builtin") {
      questKey = Number(questKey);
      if (Number.isNaN(questKey))
        return res.status(400).send({ error: "questKey must be a number" });
      filter.questKey = questKey;
      insert.questKey = questKey;
    } else {
      if (!customQuestId || typeof customQuestId !== "string") {
        return res.status(400).send({ error: "customQuestId is required" });
      }
      filter.customQuestId = customQuestId;
      insert.customQuestId = customQuestId;
    }

    const doc = await JournalEntry.findOneAndUpdate(
      filter,
      { $set, $setOnInsert: insert },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.send(doc);
  } catch (err) {
    console.log(err);
    if (err.code === 11000) return res.status(409).send({ error: "Duplicate journal doc" });
    res.status(500).send({ error: "Failed to update journal" });
  }
});

// GET /api/items - returns the full shop catalog
router.get("/items", async (req, res) => {
  try {
    const items = await Item.find({}).lean();
    res.send(items);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to fetch items" });
  }
});

// GET /api/inventory - returns what the user owns
router.get("/inventory", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const rows = await Inventory.find({ userId: req.user._id }).lean();
    res.send(rows);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to fetch inventory" });
  }
});

// GET /api/room - load (or create) the user's room
router.get("/room", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    let room = await Room.findOne({ userId: req.user._id }).lean();

    if (!room) {
      const created = await Room.create({ userId: req.user._id });
      room = created.toObject();
    }

    res.send(room);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to load room" });
  }
});

// POST /api/shop/buy - buy an item using coins
router.post("/shop/buy", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const { itemKey } = req.body;
    if (!itemKey || typeof itemKey !== "string") {
      return res.status(400).send({ error: "itemKey is required" });
    }

    const item = await Item.findOne({ key: itemKey }).lean();
    if (!item) return res.status(404).send({ error: "Item not found" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).send({ error: "User not found" });

    const inv = await Inventory.findOne({ userId: user._id, itemKey }).lean();
    const qtyOwned = inv ? inv.qty : 0;

    if (qtyOwned >= (item.maxOwned ?? 1)) {
      return res.status(400).send({ error: "Already owned max quantity" });
    }

    const price = item.priceCoins ?? 0;
    if ((user.coins ?? 0) < price) {
      return res.status(400).send({ error: "Not enough coins" });
    }

    user.coins = (user.coins ?? 0) - price;
    await user.save();

    const updatedInv = await Inventory.findOneAndUpdate(
      { userId: user._id, itemKey },
      { $setOnInsert: { userId: user._id, itemKey }, $inc: { qty: 1 } },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    // keep session updated (so whoami shows new coins immediately)
    req.session.user = user.toObject ? user.toObject() : user;

    res.send({ ok: true, coins: user.coins, itemKey, qty: updatedInv.qty });
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to buy item" });
  }
});

// GET current user's stats
router.get("/user/stats", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).send({ error: "Not logged in" });
    }

    // req.user is often a Mongoose doc, but safest is to fetch fresh
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).send({ error: "User not found" });

    const level = user.level ?? 1;
    const xp = user.xp ?? 0;
    const xpToNext = xpRequiredForLevel(level);

    res.send({ level, xp, xpToNext });
  } catch (err) {
    console.log("GET /user/stats failed", err);
    res.status(500).send({ error: "Failed to fetch user stats" });
  }
});

router.post("/user/xp", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).send({ error: "Invalid XP amount" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).send({ error: "User not found" });

    // add XP + level up loop
    user.xp = (user.xp ?? 0) + amount;
    user.level = user.level ?? 1;

    while (user.xp >= xpRequiredForLevel(user.level)) {
      user.xp -= xpRequiredForLevel(user.level);
      user.level += 1;
    }

    await user.save();

    res.send({
      level: user.level,
      xp: user.xp,
      xpToNext: xpRequiredForLevel(user.level),
    });
  } catch (err) {
    console.log("POST /user/xp failed", err);
    res.status(500).send({ error: "Failed to add XP" });
  }
});

/**
 * POST /api/room/place
 *
 * Places an owned item into the user's room and CONSUMES 1 inventory qty.
 * Returns the placed instance { instanceId, itemKey, x, y, scale }.
 */
router.post("/room/place", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    let { itemKey, x, y, scale } = req.body;
    if (!itemKey) return res.status(400).send({ error: "itemKey is required" });

    x = Number(x);
    y = Number(y);
    scale = scale === undefined ? 1.0 : Number(scale);

    if ([x, y, scale].some((v) => Number.isNaN(v))) {
      return res.status(400).send({ error: "x, y, scale must be numbers" });
    }

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    x = clamp(x, 0, 1000);
    y = clamp(y, 0, 600);
    scale = clamp(scale, 0.25, 3.0);

    // 1) catalog check
    const itemDef = await Item.findOne({ key: itemKey });
    if (!itemDef) return res.status(400).send({ error: "Unknown itemKey" });

    // 2) load/create room
    let room = await Room.findOne({ userId: req.user._id });
    if (!room) room = await Room.create({ userId: req.user._id, placedItems: [] });

    // 3) optional: maxOwned === 1 can only be placed once
    if (itemDef.maxOwned === 1) {
      const alreadyPlaced = (room.placedItems || []).some((p) => p.itemKey === itemKey);
      if (alreadyPlaced) return res.status(400).send({ error: "Item can only be placed once" });
    }

    // 4) CONSUME inventory atomically: only succeeds if qty >= 1
    const inv = await Inventory.findOneAndUpdate(
      { userId: req.user._id, itemKey, qty: { $gte: 1 } },
      { $inc: { qty: -1 } },
      { new: true }
    );

    if (!inv) return res.status(400).send({ error: "You do not own this item" });

    // 5) add placed instance
    const instanceId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const placed = { instanceId, itemKey, x, y, scale };

    room.placedItems = room.placedItems || [];
    room.placedItems.push(placed);
    await room.save();

    return res.send({ placed, inventoryQty: inv.qty });
  } catch (err) {
    console.error(err);
    return res.status(500).send({ error: "Failed to place item" });
  }
});

/**
 * DELETE /api/room/remove/:instanceId
 *
 * Removes a placed item instance from the user's room and REFUNDS 1 inventory qty.
 */
router.delete("/room/remove/:instanceId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const { instanceId } = req.params;
    if (!instanceId) return res.status(400).send({ error: "instanceId is required" });

    const room = await Room.findOne({ userId: req.user._id });
    if (!room) return res.status(404).send({ error: "Room not found" });

    const idx = (room.placedItems || []).findIndex((p) => p.instanceId === instanceId);
    if (idx < 0) return res.status(404).send({ error: "Placed item not found" });

    const removed = room.placedItems[idx]; // has itemKey
    room.placedItems.splice(idx, 1);
    await room.save();

    // refund inventory (upsert row if missing)
    const inv = await Inventory.findOneAndUpdate(
      { userId: req.user._id, itemKey: removed.itemKey },
      { $inc: { qty: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.send({
      removedInstanceId: instanceId,
      itemKey: removed.itemKey,
      inventoryQty: inv.qty,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send({ error: "Failed to remove item" });
  }
});

/**
 * PATCH /api/room/item/:instanceId
 *
 * Updates x/y/scale for a placed instance in the user's room.
 */
router.patch("/room/item/:instanceId", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const { instanceId } = req.params;
    let { x, y, scale } = req.body;

    x = Number(x);
    y = Number(y);
    scale = Number(scale);

    if ([x, y, scale].some((v) => Number.isNaN(v))) {
      return res.status(400).send({ error: "x, y, scale must be numbers" });
    }

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    x = clamp(x, 0, 1000);
    y = clamp(y, 0, 600);
    scale = clamp(scale, 0.25, 3.0);

    const room = await Room.findOne({ userId: req.user._id });
    if (!room) return res.status(404).send({ error: "Room not found" });

    const item = (room.placedItems || []).find((p) => p.instanceId === instanceId);
    if (!item) return res.status(404).send({ error: "Placed item not found" });

    item.x = x;
    item.y = y;
    item.scale = scale;

    await room.save();
    return res.send(item);
  } catch (err) {
    console.error(err);
    return res.status(500).send({ error: "Failed to update placed item" });
  }
});

// POST /api/customquests  (create)
router.post("/customquests", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const { title, description, tags, visibility } = req.body;

    if (typeof title !== "string" || title.trim().length < 3) {
      return res.status(400).send({ error: "title must be at least 3 chars" });
    }
    if (typeof description !== "string" || description.trim().length < 5) {
      return res.status(400).send({ error: "description must be at least 5 chars" });
    }
    if (tags !== undefined && (!Array.isArray(tags) || !tags.every((t) => typeof t === "string"))) {
      return res.status(400).send({ error: "tags must be string[]" });
    }

    const allowed = new Set(["private", "friends", "public"]);
    const vis = visibility === undefined ? "public" : String(visibility);
    if (!allowed.has(vis)) {
      return res.status(400).send({ error: "visibility must be private|friends|public" });
    }

    const doc = await CustomQuest.create({
      creatorId: req.user._id,
      title: title.trim(),
      description: description.trim(),
      tags: (tags || []).map((t) => t.trim()).filter(Boolean),
      visibility: vis,
    });

    res.send(doc);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to create custom quest" });
  }
});

// GET /api/customquests (browse)
router.get("/customquests", async (req, res) => {
  try {
    const { search, tag } = req.query;

    const filter = {
      $or: [
        { visibility: "public" },
        ...(req.user
          ? [{ creatorId: req.user._id }] // show my private/friends too
          : []),
      ],
    };

    if (tag) filter.tags = String(tag);

    if (search && String(search).trim()) {
      filter.$text = { $search: String(search).trim() };
    }

    const docs = await CustomQuest.find(filter).sort({ createdAt: -1 }).limit(100).lean();

    res.send(docs);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to load custom quests" });
  }
});

/*
Send a friend request

Route: POST /api/friends/request
Body: { recipientId: string }
Returns: the created friendship (or existing)
*/
router.post("/friends/request", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Not logged in" });

  const { recipientId } = req.body;
  if (!recipientId) return res.status(400).send({ error: "Missing recipientId" });

  if (String(req.user._id) === String(recipientId)) {
    return res.status(400).send({ error: "You cannot friend yourself" });
  }

  try {
    // Check if relationship already exists in either direction
    const existing = await Friendship.findOne({
      $or: [
        { requester: req.user._id, recipient: recipientId },
        { requester: recipientId, recipient: req.user._id },
      ],
    });

    if (existing) return res.send(existing);

    const friendship = await Friendship.create({
      requester: req.user._id,
      recipient: recipientId,
      status: "pending",
    });

    res.send(friendship);
  } catch (err) {
    res.status(500).send({ error: "Failed to create request" });
  }
});

/*
Accept a friend request

Route: POST /api/friends/accept
Body: { requesterId: string }
*/
router.post("/friends/accept", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Not logged in" });

  const { requesterId } = req.body;

  try {
    const updated = await Friendship.findOneAndUpdate(
      { requester: requesterId, recipient: req.user._id, status: "pending" },
      { status: "accepted" },
      { new: true }
    );

    if (!updated) return res.status(404).send({ error: "No pending request found" });

    res.send(updated);
  } catch (err) {
    res.status(500).send({ error: "Failed to accept request" });
  }
});

// Decline (recipient declines) and cancel (requester cancels) are both just deletes.
router.post("/friends/decline", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Not logged in" });

  const { requesterId } = req.body;

  await Friendship.deleteOne({
    requester: requesterId,
    recipient: req.user._id,
    status: "pending",
  });

  res.send({ success: true });
});

/*
List accepted friends

Route: GET /api/friends
Returns: [{_id, name, ...}]
*/
router.get("/friends", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Not logged in" });

  const edges = await Friendship.find({
    status: "accepted",
    $or: [{ requester: req.user._id }, { recipient: req.user._id }],
  }).populate("requester recipient", "name friendCode");

  const friends = edges.map((e) => {
    const requesterIsMe = e.requester._id.equals(req.user._id);
    return requesterIsMe ? e.recipient : e.requester;
  });

  res.send(friends);
});

/*
List incoming pending requests

Route: GET /api/friends/requests
*/
router.get("/friends/requests", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Not logged in" });

  const incoming = await Friendship.find({
    status: "pending",
    recipient: req.user._id,
  }).populate("requester", "name friendCode");

  res.send(incoming);
});

/**
 * POST /api/friends/requestByCode
 * Body: { friendCode: string }
 * Creates a pending friend request by friend code.
 */
router.post("/friends/requestByCode", async (req, res) => {
  try {
    if (!req.user) return res.status(401).send({ error: "Not logged in" });

    const { friendCode } = req.body;
    if (!friendCode) return res.status(400).send({ error: "Missing friendCode" });

    const code = String(friendCode).trim().toUpperCase();

    // Find the recipient by friendCode
    const recipient = await User.findOne({ friendCode: code }).lean();
    if (!recipient) return res.status(404).send({ error: "No user with that friend code" });

    // Cannot friend yourself
    if (String(recipient._id) === String(req.user._id)) {
      return res.status(400).send({ error: "You cannot friend yourself" });
    }

    // Check if relationship already exists in either direction
    const existing = await Friendship.findOne({
      $or: [
        { requester: req.user._id, recipient: recipient._id },
        { requester: recipient._id, recipient: req.user._id },
      ],
    });

    if (existing) return res.send(existing);

    const friendship = await Friendship.create({
      requester: req.user._id,
      recipient: recipient._id,
      status: "pending",
    });

    res.send(friendship);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: "Failed to create request" });
  }
});

// POST /api/me/name
router.post("/me/name", async (req, res) => {
  if (!req.user) return res.status(401).send({ error: "Not logged in" });

  const { name } = req.body;
  if (!name || name.trim().length < 1) {
    return res.status(400).send({ error: "Invalid name" });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { name: name.trim() },
    { new: true }
  );

  res.send(user);
});


// anything else falls to this "not found" case
router.all("*", (req, res) => {
  console.log(`API route not found: ${req.method} ${req.url}`);
  res.status(404).send({ msg: "API route not found" });
});

module.exports = router;
