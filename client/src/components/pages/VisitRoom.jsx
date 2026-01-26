import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { get } from "../../utilities";
import RoomCanvas from "../modules/RoomCanvas";
import { socket } from "../../client-socket";

export default function VisitRoom() {
  const { userId: ownerId } = useParams();

  const [catalog, setCatalog] = useState([]);
  const [room, setRoom] = useState(null);

  useEffect(() => {
    get("/api/items")
      .then((items) => setCatalog(items || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!ownerId) return;

    get(`/api/rooms/${ownerId}`)
      .then((r) => setRoom(r))
      .catch(console.error);

    socket.emit("room:watch", { ownerId });

    const onUpdate = (payload) => {
      if (payload?.ownerId !== String(ownerId)) return;
      setRoom((prev) => ({
        ...(prev || { userId: ownerId }),
        placedItems: payload.placedItems || [],
        beaver: payload.beaver || null,
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

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <RoomCanvas
        mode="visitor"
        ownerId={ownerId}
        catalogByKey={catalogByKey}
        initialPlacedItems={room?.placedItems || []}
        initialBeaver={room?.beaver || null}
      />
      <div style={{ width: 280, borderLeft: "1px solid #ddd", padding: 12 }}>
        <h3 style={{ marginTop: 0 }}>Visiting room</h3>
        <div style={{ opacity: 0.8, fontSize: 13 }}>
          Read-only. Any changes you see are from the owner.
        </div>
      </div>
    </div>
  );
}
