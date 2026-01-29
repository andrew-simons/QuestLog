const { OAuth2Client } = require("google-auth-library");
const { generateUniqueFriendCode } = require("./helper");

const User = require("./models/user");
const Room = require("./models/rooms");
const Inventory = require("./models/inventory");
const userQuests = require("./models/userQuests");

const socketManager = require("./server-socket");
const Friendship = require("./models/friendship");
const DEFAULT_FRIEND_IDS = ["6979c819622b297daa3b514d", "6979c8b1622b297daa3b5191"];

// create a new OAuth client used to verify google sign-in
//    TODO: replace with your own CLIENT_ID
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

  if (changed) await u.save();
  return u;
}

async function addDefaultFriendsForNewUser(newUserId) {
  for (const fid of DEFAULT_FRIEND_IDS) {
    if (String(fid) === String(newUserId)) continue;

    // Create an accepted edge so it shows up in GET /api/friends
    await Friendship.updateOne(
      { requester: newUserId, recipient: fid },
      { $setOnInsert: { requester: newUserId, recipient: fid, status: "accepted" } },
      { upsert: true }
    );

    // Optional: create the reverse edge too (mutual)
    await Friendship.updateOne(
      { requester: fid, recipient: newUserId },
      { $setOnInsert: { requester: fid, recipient: newUserId, status: "accepted" } },
      { upsert: true }
    );
  }
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

  await addDefaultFriendsForNewUser(newUser._id);
  return newUser;
}

function login(req, res) {
  verify(req.body.token)
    .then((user) => getOrCreateUser(user))
    .then((user) => {
      // persist user in the session
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
  // simply populate "req.user" for convenience
  req.user = req.session.user;
  next();
}

function ensureLoggedIn(req, res, next) {
  if (!req.user) {
    return res.status(401).send({ err: "not logged in" });
  }

  next();
}
async function login_code(req, res) {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).send({ error: "Missing code" });

    // Exchange code for tokens (includes id_token)
    const { tokens } = await client.getToken(code);

    if (!tokens?.id_token) {
      return res.status(401).send({ error: "No id_token returned" });
    }

    // Verify id_token to get Google profile payload
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
