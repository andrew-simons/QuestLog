const { OAuth2Client } = require("google-auth-library");
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
function getOrCreateUser(user) {
  // the "sub" field means "subject", which is a unique identifier for each user
  return User.findOne({ googleid: user.sub }).then((existingUser) => {
    if (existingUser) return existingUser;

    const newUser = new User({
      name: user.name,
      googleid: user.sub,
      createdAt: new Date(), // current date & time
      xp: 0,
      level: 1,
      coins: 0,
      equipped: {
        beaverSkinId: "default",
        hatItemId: "default",
        roomThemeId: "default",
      },
    });

    const newRoom = new Room({
      ownerUserId: newUser.id,
      layout: { placedItems: [] },
      updatedAt: new Date(),
    });
    newRoom.save();

    newUser.roomId = newRoom.id; // set the room_id to the user obj

    const newInv = new Inventory({
      userId: newUser.id,
      itemIds: [],
    });
    newInv.save();

    return newUser.save();
  });
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
