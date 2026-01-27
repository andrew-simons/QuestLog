import React, { useMemo, useState, useEffect } from "react";
import "./RoomSidebar.css";

export default function RoomSidebar({
  coins,
  catalog,
  inventory,
  placedCounts,
  selectedItemId,
  selectedItemKey,
  roomOwnerName,
  isOwner,
  onSaveMyName,
  onBuy,
  onPlace,
  onRemoveSelected,
  setTyping,
}) {
  const [tab, setTab] = useState("inventory");

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    // whenever you enter a room (or owner changes), reset draft
    setNameDraft(roomOwnerName || "");
    setEditingName(false);
  }, [roomOwnerName]);

  const catalogByKey = useMemo(() => {
    const m = new Map();
    for (const it of catalog) m.set(it.key, it);
    return m;
  }, [catalog]);

  const selectedLabel = useMemo(() => {
    if (!selectedItemKey) return "None";
    const def = catalogByKey.get(selectedItemKey);
    return def?.name ?? selectedItemKey;
  }, [selectedItemKey, catalogByKey]);

  const ownedQty = (itemKey) => inventory.find((r) => r.itemKey === itemKey)?.qty || 0;

  const resolveItemImage = (it) => {
    if (!it) return null;
    if (it.imageUrl) return it.imageUrl;
    if (it.imageKey) return `/img/items/${it.imageKey}.png`;
    return `/img/items/${it.key}.png`;
  };

  async function commitName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    await onSaveMyName(trimmed);
    setEditingName(false);
  }

  return (
    <aside className="qs-shell">
      <div className="qs-header">
        <div className="qs-header-top">
          <div className="qs-titleStack">
            <div className="qs-titleRow">
              <h3 className="qs-title">
                {roomOwnerName ? `${roomOwnerName}'s Room` : "Your Room"}
              </h3>

              {isOwner && !editingName && (
                <button className="qs-editbtn" onClick={() => setEditingName(true)}>
                  Edit
                </button>
              )}
            </div>

            {isOwner && editingName && (
              <div className="qs-name-edit">
                <input
                  className="qs-name-input"
                  value={nameDraft}
                  maxLength={20}
                  placeholder="Your Name"
                  onFocus={() => setTyping?.(true)}
                  onBlur={() => setTyping?.(false)}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") commitName();
                    if (e.key === "Escape") {
                      setNameDraft(roomOwnerName || "");
                      setEditingName(false);
                    }
                  }}
                />

                <button className="qs-savebtn" onClick={commitName}>
                  Save
                </button>
                <button
                  className="qs-cancelbtn"
                  onClick={() => {
                    setNameDraft(roomOwnerName || "");
                    setEditingName(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="qs-coin-pill">
            <span className="qs-coin-dot" />
            <b>{coins}</b>
            <span>coins</span>
          </div>
        </div>

        <div className="qs-meta">
          <div className="qs-selected">
            <span className="qs-selected-label">Selected</span>
            <span className="qs-selected-value">{selectedLabel}</span>
          </div>

          <button
            className={`qs-remove ${selectedItemId ? "on" : "off"}`}
            disabled={!selectedItemId || !isOwner}
            onClick={onRemoveSelected}
            title={!isOwner ? "You can’t remove items in someone else’s room." : ""}
          >
            Remove
          </button>
        </div>
      </div>

      <div className="qs-tabs">
        <button
          className={`qs-tab ${tab === "inventory" ? "active" : ""}`}
          onClick={() => setTab("inventory")}
        >
          Inventory
        </button>
        <button
          className={`qs-tab ${tab === "shop" ? "active" : ""}`}
          onClick={() => setTab("shop")}
        >
          Shop
        </button>
        <div className="qs-tab-indicator" style={{ left: tab === "inventory" ? "6px" : "50%" }} />
      </div>

      <div className="qs-panel">
        {tab === "inventory" ? (
          inventory.length === 0 ? (
            <div className="qs-empty">No items owned yet.</div>
          ) : (
            inventory.map((row) => {
              const def = catalogByKey.get(row.itemKey);
              const disabled = row.qty <= 0 || !isOwner; // only place in your own room
              return (
                <ItemCard
                  key={row.itemKey}
                  name={def?.name ?? row.itemKey}
                  img={resolveItemImage(def || row)}
                  sub={`${row.qty} available`}
                  actionLabel={isOwner ? "Place" : "View"}
                  disabled={disabled}
                  onAction={() => onPlace(row.itemKey)}
                />
              );
            })
          )
        ) : (
          catalog.map((it) => {
            const invOwned = ownedQty(it.key);
            const placedOwned = placedCounts?.get(it.key) || 0;
            const ownedTotal = invOwned + placedOwned;

            const max = it.maxOwned ?? 1;
            const canAfford = coins >= it.priceCoins;

            // buying is fine anywhere; placing is owner-only (handled above)
            const disabled = ownedTotal >= max || !canAfford;

            return (
              <ItemCard
                key={it.key}
                name={it.name}
                img={resolveItemImage(it)}
                sub={`${it.priceCoins} coins · ${ownedTotal}/${max}`}
                actionLabel="Buy"
                disabled={disabled}
                onAction={() => onBuy(it.key)}
              />
            );
          })
        )}
      </div>
    </aside>
  );
}

function ItemCard({ name, img, sub, actionLabel, disabled, onAction }) {
  return (
    <div className="qs-item">
      <div className="qs-thumb">{img ? <img src={img} alt={name} /> : <span>🪵</span>}</div>

      <div className="qs-item-main">
        <div className="qs-item-name">{name}</div>
        <div className="qs-item-sub">{sub}</div>
      </div>

      <button
        className={`qs-primary ${disabled ? "off" : "on"}`}
        disabled={disabled}
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  );
}
