const { OAuth2Client } = require("google-auth-library");
const { generateUniqueFriendCode } = require("./helper");

const User = require("./models/user");
const Friendship = require("./models/friendship");

const DEFAULT_FRIEND_IDS = ["6979c819622b297daa3b514d", "6979c8b1622b297daa3b5191"];

// create a new OAuth client used to verify google sign-in
const CLIENT_ID = "58023725513-8571eqs79mlmqbgfi4ngf5gprsn3pqtl.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, "postmessage");
console.log("GOOGLE_CLIENT_SECRET present?", !!process.env.GOOGLE_CLIENT_SECRET);

const CURRENT_USER_SCHEMA_VERSION = 1;
const USER_DEFAULTS = {
  xp: 0,
  level: 1,
  coins: 0,
  tutorialStep: 0,
  tutorialDone: false,
  currentQuestKeys: [1, 2, 3],
};

// accepts a login token from the frontend, and verifies that it's legit
function verify(token) {
  return client
    .verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    })
    .then((ticket) => ticket.getPayload());
}

/**
 * Ensures the user has accepted friendships with DEFAULT_FRIEND_IDS.
 * Idempotent: safe to call repeatedly.
 * Mutual: creates both directions so it shows up for both sides.
 */
async function ensureDefaultFriends(userId) {
  const uid = String(userId);

  // remove self + empty
  const defaults = DEFAULT_FRIEND_IDS.map(String).filter((fid) => fid && fid !== uid);
  if (!defaults.length) return false;

  // Find which defaults are already accepted (either direction)
  const existing = await Friendship.find({
    status: "accepted",
    $or: [
      { requester: userId, recipient: { $in: defaults } },
      { recipient: userId, requester: { $in: defaults } },
    ],
  })
    .select("requester recipient")
    .lean();

  const already = new Set();
  for (const e of existing) {
    const r = String(e.requester);
    const p = String(e.recipient);
    const other = r === uid ? p : r;
    already.add(other);
  }

  const missing = defaults.filter((fid) => !already.has(fid));
  if (!missing.length) return false;

  const ops = [];
  for (const fid of missing) {
    // forward edge
    ops.push({
      updateOne: {
        filter: { requester: userId, recipient: fid },
        update: { $setOnInsert: { requester: userId, recipient: fid, status: "accepted" } },
        upsert: true,
      },
    });
    // reverse edge (mutual)
    ops.push({
      updateOne: {
        filter: { requester: fid, recipient: userId },
        update: { $setOnInsert: { requester: fid, recipient: userId, status: "accepted" } },
        upsert: true,
      },
    });
  }

  await Friendship.bulkWrite(ops, { ordered: false });
  return true;
}

async function migrateUserIfNeeded(u) {
  let changed = false;

  if (u.schemaVersion == null) {
    u.schemaVersion = 0;
    changed = true;
  }

  for (const [k, v] of Object.entries(USER_DEFAULTS)) {
    if (u[k] === undefined) {
      u[k] = v;
      changed = true;
    }
  }

  if (!u.friendCode) {
    u.friendCode = await generateUniqueFriendCode();
    changed = true;
  }

  if (u.schemaVersion !== CURRENT_USER_SCHEMA_VERSION) {
    u.schemaVersion = CURRENT_USER_SCHEMA_VERSION;
    changed = true;
  }

  // ✅ backfill default friends for EXISTING users too
  const added = await ensureDefaultFriends(u._id);
  if (added) changed = true;

  if (changed) await u.save();
  return u;
}

async function getOrCreateUser(user) {
  let existingUser = await User.findOne({ googleid: user.sub });

  if (existingUser) {
    existingUser = await migrateUserIfNeeded(existingUser);
    return existingUser;
  }

  const newUser = await User.create({
    name: user.name,
    googleid: user.sub,
    createdAt: new Date(),
    friendCode: await generateUniqueFriendCode(),
    schemaVersion: CURRENT_USER_SCHEMA_VERSION,
    ...USER_DEFAULTS,
  });

  // ✅ default friends for NEW users
  await ensureDefaultFriends(newUser._id);

  return newUser;
}

function login(req, res) {
  verify(req.body.token)
    .then((user) => getOrCreateUser(user))
    .then((user) => {
      req.session.user = user;
      res.send(user);
    })
    .catch((err) => {
      console.log(`Failed to log in: ${err}`);
      res.status(401).send({ err });
    });
}

function logout(req, res) {
  req.session.user = null;
  res.send({});
}

function populateCurrentUser(req, res, next) {
  req.user = req.session.user;
  next();
}

function ensureLoggedIn(req, res, next) {
  if (!req.user) return res.status(401).send({ err: "not logged in" });
  next();
}

async function login_code(req, res) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).send({ error: "Missing code" });

    const { tokens } = await client.getToken(code);
    if (!tokens?.id_token) return res.status(401).send({ error: "No id_token returned" });

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const user = await getOrCreateUser(payload);

    req.session.user = user;
    res.send(user);
  } catch (err) {
    console.log("Failed to log in (code):", err);
    res.status(401).send({ error: "Google auth failed" });
  }
}

module.exports = {
  login,
  logout,
  login_code,
  populateCurrentUser,
  ensureLoggedIn,
};
