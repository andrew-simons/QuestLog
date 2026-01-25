const { OAuth2Client } = require("google-auth-library");
const { generateUniqueFriendCode } = require("./helper");

const User = require("./models/user");
const Room = require("./models/rooms");
const Inventory = require("./models/inventory");
const userQuests = require("./models/userQuests");

const socketManager = require("./server-socket");
const friendship = require("./models/friendship");

// create a new OAuth client used to verify google sign-in
//    TODO: replace with your own CLIENT_ID
const CLIENT_ID = "58023725513-8571eqs79mlmqbgfi4ngf5gprsn3pqtl.apps.googleusercontent.com";
const client = new OAuth2Client(CLIENT_ID);

// accepts a login token from the frontend, and verifies that it's legit
function verify(token) {
  return client
    .verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    })
    .then((ticket) => ticket.getPayload());
}

// gets user from DB, or makes a new account AND other DBs if it doesn't exist yet
async function getOrCreateUser(user) {
  const existingUser = await User.findOne({ googleid: user.sub });
  if (existingUser) {
    // backfill friendCode if older users don't have it
    if (!existingUser.friendCode) {
      existingUser.friendCode = await generateUniqueFriendCode();
      await existingUser.save();
    }
    return existingUser;
  }

  // create new user with a guaranteed-unique friend code
  const newUser = new User({
    name: user.name,
    googleid: user.sub,
    createdAt: new Date(),
    xp: 0,
    level: 1,
    coins: 0,
    equipped: {
      beaverSkinId: "default",
      hatItemId: "default",
      roomThemeId: "default",
    },
    friendCode: await generateUniqueFriendCode(),
    currentQuestKeys: [1, 2, 3],
    completedQuestKeys: [],
  });

  const newRoom = await Room.create({
    ownerUserId: newUser._id, // <-- use _id consistently
    layout: { placedItems: [] },
    updatedAt: new Date(),
  });

  newUser.roomId = newRoom._id;

  await Inventory.create({
    userId: newUser._id,
    itemIds: [],
  });

  return await newUser.save();
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

module.exports = {
  login,
  logout,
  populateCurrentUser,
  ensureLoggedIn,
};
