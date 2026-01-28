import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { get } from "../../utilities";
import RoomCanvas from "../modules/RoomCanvas";
import { socket } from "../../client-socket";

export default function VisitRoom() {
  const { userId: ownerId } = useParams();

  const [catalog, setCatalog] = useState([]);
  const [room, setRoom] = useState(null);
  const [viewerId, setViewerId] = useState(null);

  useEffect(() => {
    get("/api/whoami")
      .then((me) => setViewerId(me?._id || null))
      .catch(console.error);
  }, []);

  useEffect(() => {
    get("/api/items")
      .then((items) => setCatalog(items || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!ownerId) return;

    get(`/api/rooms/${ownerId}`).then(setRoom).catch(console.error);

    socket.emit("room:watch", { ownerId });

    const onUpdate = (payload) => {
      if (payload?.ownerId !== String(ownerId)) return;
      setRoom((prev) => ({
        ...(prev || { userId: ownerId }),
        placedItems: payload.placedItems || [],
        beaver: payload.beaver || null,
        owner: prev?.owner, 
      }));
    };

    socket.on("room:update", onUpdate);

    return () => {
      socket.emit("room:unwatch", { ownerId });
      socket.off("room:update", onUpdate);
    };
  }, [ownerId]);

  const catalogByKey = useMemo(() => {
    const m = new Map();
    for (const it of catalog) m.set(it.key, it);
    return m;
  }, [catalog]);

  const ownerName = room?.owner?.name;

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <RoomCanvas
        mode="visitor"
        viewerId={viewerId}
        ownerId={ownerId}
        roomId={ownerId}
        socket={socket}
        catalogByKey={catalogByKey}
        reloadToken={0}
      />

      <div style={{ width: 280, borderLeft: "1px solid #ddd", padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>
          {ownerName ? `Visiting ${ownerName}'s Room` : "Visiting room"}
        </h3>
        <div style={{ opacity: 0.8, fontSize: 13 }}>
          Read-only items. Movement is multiplayer.
        </div>
      </div>
    </div>
  );
}
