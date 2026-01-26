// server/server-socket.js
let io;

const userToSocketMap = {}; // userId -> socket
const socketToUserMap = {}; // socketId -> user

const getAllConnectedUsers = () => Object.values(socketToUserMap);
const getSocketFromUserID = (userid) => userToSocketMap[userid];
const getUserFromSocketID = (socketid) => socketToUserMap[socketid];
const getSocketFromSocketID = (socketid) => io.sockets.sockets.get(socketid);

// -------------------------------
// Multiplayer presence state
// roomId -> { users: { userId: { x,y,dir,updatedAt } } }
// NOTE: in-memory only (fine for now). If you scale to multiple server instances,
// you’ll need Redis adapter + shared state.
// -------------------------------
const presenceRooms = Object.create(null);

const roomChannel = (roomId) => `presence:${String(roomId)}`;

// default spawn (you can randomize slightly)
const defaultSpawn = () => ({ x: 525, y: 510, dir: "down" });

const addUser = (user, socket) => {
  const oldSocket = userToSocketMap[user._id];
  if (oldSocket && oldSocket.id !== socket.id) {
    // CURRENT behavior: force-kick old tab
    // If you want multi-tab support, delete this block.
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

      // ----------------------------------------------------
      // (A)  existing room watcher channel
      // ----------------------------------------------------
      socket.on("room:watch", ({ ownerId }) => {
        if (!ownerId) return;
        socket.join(`room:${ownerId}`);
      });

      socket.on("room:unwatch", ({ ownerId }) => {
        if (!ownerId) return;
        socket.leave(`room:${ownerId}`);
      });

      // Existing: owner broadcasts pose to watchers (1-beaver mode)
      // Keep this for backward compatibility, but it’s NOT multiplayer.
      socket.on("room:beaver", (pose) => {
        const user = socket.request?.user;
        if (!user) return;

        const ownerId = String(user._id);

        const payload = {
          ownerId,
          beaver: { x: pose?.x, y: pose?.y, dir: pose?.dir },
        };

        socket.to(`room:${ownerId}`).emit("room:update", payload);
      });

      // ----------------------------------------------------
      // (B) NEW: Presence / multiplayer channel
      // ----------------------------------------------------

      // Join a room to show your beaver and receive others
      socket.on("presence:join", ({ roomId }) => {
        const user = socket.request?.user;
        if (!user) return;
        if (!roomId) return;

        const rid = String(roomId);
        const uid = String(user._id);

        // join socket.io room
        socket.join(roomChannel(rid));

        // track membership on socket for cleanup
        socket.data.presenceRoomId = rid;
        socket.data.userId = uid;

        if (!presenceRooms[rid]) presenceRooms[rid] = { users: Object.create(null) };

        // add user if not present
        if (!presenceRooms[rid].users[uid]) {
          presenceRooms[rid].users[uid] = {
            ...defaultSpawn(),
            updatedAt: Date.now(),
          };
        }

        // send snapshot to joiner
        socket.emit("presence:state", {
          roomId: rid,
          users: presenceRooms[rid].users,
        });

        // tell others about this user (optional but nice)
        socket.to(roomChannel(rid)).emit("presence:moved", {
          roomId: rid,
          userId: uid,
          ...presenceRooms[rid].users[uid],
        });
      });

      // Update your pose
      socket.on("presence:move", ({ roomId, x, y, dir }) => {
        const user = socket.request?.user;
        if (!user) return;
        if (!roomId) return;

        const rid = String(roomId);
        const uid = String(user._id);

        if (!presenceRooms[rid]) presenceRooms[rid] = { users: Object.create(null) };

        // create if missing (in case move arrives before join)
        if (!presenceRooms[rid].users[uid]) {
          presenceRooms[rid].users[uid] = { ...defaultSpawn(), updatedAt: Date.now() };
        }

        // clamp / sanitize lightly (optional)
        const nx = Number.isFinite(+x) ? +x : presenceRooms[rid].users[uid].x;
        const ny = Number.isFinite(+y) ? +y : presenceRooms[rid].users[uid].y;
        const nd = typeof dir === "string" ? dir : presenceRooms[rid].users[uid].dir;

        presenceRooms[rid].users[uid] = {
          x: nx,
          y: ny,
          dir: nd,
          updatedAt: Date.now(),
        };

        // broadcast to others in room (not back to sender)
        socket.to(roomChannel(rid)).emit("presence:moved", {
          roomId: rid,
          userId: uid,
          x: nx,
          y: ny,
          dir: nd,
        });
      });

      // Optional explicit leave
      socket.on("presence:leave", ({ roomId }) => {
        const user = socket.request?.user;
        if (!user) return;
        if (!roomId) return;

        const rid = String(roomId);
        const uid = String(user._id);

        socket.leave(roomChannel(rid));

        if (presenceRooms[rid]?.users?.[uid]) {
          delete presenceRooms[rid].users[uid];
          socket.to(roomChannel(rid)).emit("presence:left", { roomId: rid, userId: uid });

          // if room empty, free memory
          if (Object.keys(presenceRooms[rid].users).length === 0) {
            delete presenceRooms[rid];
          }
        }
      });

      // Cleanup on disconnect
      socket.on("disconnect", () => {
        const rid = socket.data?.presenceRoomId;
        const uid = socket.data?.userId;
        if (!rid || !uid) return;

        if (presenceRooms[rid]?.users?.[uid]) {
          delete presenceRooms[rid].users[uid];
          socket.to(roomChannel(rid)).emit("presence:left", { roomId: rid, userId: uid });

          if (Object.keys(presenceRooms[rid].users).length === 0) {
            delete presenceRooms[rid];
          }
        }
      });
    });
  },

  addUser,
  removeUser,

  getSocketFromUserID,
  getUserFromSocketID,
  getSocketFromSocketID,
  getIo: () => io,

  // optional exports for debugging
  _presenceRooms: presenceRooms,
};
