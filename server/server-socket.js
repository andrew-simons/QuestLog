let io;

const userToSocketMap = {}; // maps user ID to socket object
const socketToUserMap = {}; // maps socket ID to user object

const getAllConnectedUsers = () => Object.values(socketToUserMap);
const getSocketFromUserID = (userid) => userToSocketMap[userid];
const getUserFromSocketID = (socketid) => socketToUserMap[socketid];
const getSocketFromSocketID = (socketid) => io.sockets.sockets.get(socketid);

const addUser = (user, socket) => {
  const oldSocket = userToSocketMap[user._id];
  if (oldSocket && oldSocket.id !== socket.id) {
    // there was an old tab open for this user, force it to disconnect
    // FIXME: is this the behavior you want?
    oldSocket.disconnect();
    delete socketToUserMap[oldSocket.id];
  }

  userToSocketMap[user._id] = socket;
  socketToUserMap[socket.id] = user;
};

const removeUser = (user, socket) => {
  if (user) delete userToSocketMap[user._id];
  delete socketToUserMap[socket.id];
};

module.exports = {
  init: (http) => {
    io = require("socket.io")(http);

    io.on("connection", (socket) => {
      console.log(`socket has connected ${socket.id}`);

      socket.on("room:watch", ({ ownerId }) => {
        if (!ownerId) return;
        socket.join(`room:${ownerId}`);
      });

      socket.on("room:unwatch", ({ ownerId }) => {
        if (!ownerId) return;
        socket.leave(`room:${ownerId}`);
      });

      // NEW: owner broadcasts beaver pose; server relays to watchers
      socket.on("room:beaver", (pose) => {
        //ensure only the logged-in owner can broadcast their own movement
        const user = socket.request?.user; // depends on how you attach auth to sockets
        if (!user) return;

        const ownerId = String(user._id);

        const payload = {
          ownerId,
          beaver: {
            x: pose?.x,
            y: pose?.y,
            dir: pose?.dir,
          },
        };

        socket.to(`room:${ownerId}`).emit("room:update", payload);
      });
    });
  },

  addUser: addUser,
  removeUser: removeUser,

  getSocketFromUserID: getSocketFromUserID,
  getUserFromSocketID: getUserFromSocketID,
  getSocketFromSocketID: getSocketFromSocketID,
  getIo: () => io,
};
