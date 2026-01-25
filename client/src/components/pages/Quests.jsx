import React, { useState, useEffect, useContext, useMemo } from "react";
import { get, patch, post } from "../../utilities";
import "../../utilities.css";
import { UserContext } from "../App";
import QuestCard from "../modules/QuestCard";
import "./Quests.css";

const rarityRank = (rarity) => {
  // adjust to your actual rarity values if needed
  const order = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
  };
  if (!rarity) return 999;
  return order[String(rarity).toLowerCase()] ?? 999;
};

const Quests = () => {
  const { userId } = useContext(UserContext);

  const [currentQuests, setCurrentQuests] = useState([]);
  const [userQuestByKey, setUserQuestByKey] = useState(new Map());

  const [customQuests, setCustomQuests] = useState([]);
  const [userQuestByCustomId, setUserQuestByCustomId] = useState(new Map());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTags, setNewTags] = useState("");
  const [newVis, setNewVis] = useState("public");
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // NEW: built-in sorting
  const [sortMode, setSortMode] = useState("rarity"); // "rarity" | "alpha"

  // NEW: custom search + filters
  const [customSearch, setCustomSearch] = useState("");
  const [customSort, setCustomSort] = useState("new"); // "new" | "alpha" | "vis" | "status"
  const [customVisFilter, setCustomVisFilter] = useState("all"); // all/public/friends/private
  const [customShowCompleted, setCustomShowCompleted] = useState(true);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    Promise.all([get("/api/currentquests"), get("/api/userquests"), get("/api/customquests")])
      .then(([quests, userQuests, custom]) => {
        setCurrentQuests(quests);
        setCustomQuests(custom);

        const mapKey = new Map();
        const mapCustom = new Map();

        userQuests.forEach((uq) => {
          if (uq.source === "builtin") mapKey.set(uq.questKey, uq);
          if (uq.source === "custom") mapCustom.set(String(uq.customQuestId), uq);
        });

        setUserQuestByKey(mapKey);
        setUserQuestByCustomId(mapCustom);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, [userId]);

  const isCompletedFor = (questKey) => {
    const uq = userQuestByKey.get(questKey);
    return uq?.isCompleted ?? false;
  };

  const isCustomCompletedFor = (customQuestId) => {
    const uq = userQuestByCustomId.get(String(customQuestId));
    return uq?.isCompleted ?? false;
  };

  // NEW: derived sorted built-in list
  const sortedCurrentQuests = useMemo(() => {
    const copy = [...currentQuests];
    if (sortMode === "alpha") {
      copy.sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
      return copy;
    }
    // rarity (default): higher rarity first, tie-break alphabetical
    copy.sort((a, b) => {
      const dr = rarityRank(b.rarity) - rarityRank(a.rarity);
      if (dr !== 0) return dr;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
    return copy;
  }, [currentQuests, sortMode]);

  // NEW: build tag options from all custom quests
  const customTagOptions = useMemo(() => {
    const set = new Set();
    customQuests.forEach((cq) => {
      (cq.tags || []).forEach((t) => set.add(String(t).toLowerCase()));
    });
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [customQuests]);

  // NEW: derived filtered custom list
  const filteredCustomQuests = useMemo(() => {
    const q = customSearch.trim().toLowerCase();
    const vis = customVisFilter;

    const base = customQuests.filter((cq) => {
      const title = String(cq.title || "").toLowerCase();
      const desc = String(cq.description || "").toLowerCase();
      const tags = (cq.tags || []).map((t) => String(t).toLowerCase()); // still searchable
      const visibility = String(cq.visibility || "public");

      // search text (title/desc/tags)
      if (q) {
        const hit = title.includes(q) || desc.includes(q) || tags.some((t) => t.includes(q));
        if (!hit) return false;
      }

      // visibility filter
      if (vis !== "all" && visibility !== vis) return false;

      // completed filter
      if (!customShowCompleted) {
        const done = isCustomCompletedFor(cq._id);
        if (done) return false;
      }

      return true;
    });

    const getTime = (cq) => (cq.createdAt ? new Date(cq.createdAt).getTime() : 0);

    // sorting
    const sorted = [...base].sort((a, b) => {
      if (customSort === "alpha") {
        return String(a.title || "").localeCompare(String(b.title || ""));
      }
      if (customSort === "vis") {
        const va = String(a.visibility || "public");
        const vb = String(b.visibility || "public");
        const d = va.localeCompare(vb);
        if (d !== 0) return d;
        return getTime(b) - getTime(a);
      }
      if (customSort === "status") {
        // incomplete first, then completed
        const da = isCustomCompletedFor(a._id) ? 1 : 0;
        const db = isCustomCompletedFor(b._id) ? 1 : 0;
        const d = da - db;
        if (d !== 0) return d;
        return getTime(b) - getTime(a);
      }
      // default: newest first
      return getTime(b) - getTime(a);
    });

    return sorted;
  }, [
    customQuests,
    customSearch,
    customVisFilter,
    customShowCompleted,
    customSort,
    userQuestByCustomId, // so "status" updates when completion changes
  ]);

  const handleToggleCustomQuest = (customQuestId, isCompleted) => {
    const idStr = String(customQuestId);
    if (!userId || savingKey === idStr) return;
    setSavingKey(idStr);

    const prevWasCompleted = isCustomCompletedFor(customQuestId);

    // optimistic update
    setUserQuestByCustomId((prev) => {
      const next = new Map(prev);
      const prevDoc = next.get(idStr) || { customQuestId: idStr, source: "custom" };
      next.set(idStr, { ...prevDoc, customQuestId: idStr, source: "custom", isCompleted });
      return next;
    });

    patch("/api/userquests", { source: "custom", customQuestId: idStr, isCompleted })
      .then((serverResp) => {
        setUserQuestByCustomId((prev) => {
          const next = new Map(prev);
          next.set(idStr, serverResp.userQuest);
          return next;
        });
      })
      .catch((err) => {
        console.log(err);
        // rollback
        setUserQuestByCustomId((prev) => {
          const next = new Map(prev);
          const prevDoc = next.get(idStr) || { customQuestId: idStr, source: "custom" };
          next.set(idStr, {
            ...prevDoc,
            customQuestId: idStr,
            source: "custom",
            isCompleted: prevWasCompleted,
          });
          return next;
        });
      })
      .finally(() => setSavingKey(null));
  };

  const handleToggleQuest = (questKey, isCompleted) => {
    if (!userId || savingKey === questKey) return;
    setSavingKey(questKey);

    const prevWasCompleted = isCompletedFor(questKey);

    // optimistic
    setUserQuestByKey((prev) => {
      const next = new Map(prev);
      const prevDoc = next.get(questKey) || { questKey };
      next.set(questKey, { ...prevDoc, questKey, isCompleted });
      return next;
    });

    patch("/api/userquests", { source: "builtin", questKey, isCompleted })
      .then((serverResp) => {
        setUserQuestByKey((prev) => {
          const next = new Map(prev);
          next.set(questKey, serverResp.userQuest);
          return next;
        });
        if (serverResp.currentQuests) setCurrentQuests(serverResp.currentQuests);
      })
      .catch((err) => {
        console.log(err);
        setUserQuestByKey((prev) => {
          const next = new Map(prev);
          const prevDoc = next.get(questKey) || { questKey };
          next.set(questKey, { ...prevDoc, questKey, isCompleted: prevWasCompleted });
          return next;
        });
      })
      .finally(() => setSavingKey(null));
  };

  function refreshQuests() {
    setRefreshing(true);
    patch("/api/currentquests/refresh", {})
      .then((quests) => setCurrentQuests(quests))
      .catch((err) => {
        console.log(err);
        alert("Failed to refresh quests.");
      })
      .finally(() => setRefreshing(false));
  }

  const handleCreateCustomQuest = async (e) => {
    e.preventDefault();
    if (!userId || creating) return;

    setCreating(true);
    try {
      const tags = newTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const created = await post("/api/customquests", {
        title: newTitle,
        description: newDesc,
        tags,
        visibility: newVis,
      });

      setCustomQuests((prev) => [created, ...prev]);

      setNewTitle("");
      setNewDesc("");
      setNewTags("");
      setNewVis("public");

      // optional: close modal on success
      setShowCreateModal(false);
    } catch (err) {
      console.log(err);
      alert("Failed to create custom quest");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="questsPage">
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Quests</h1>
          <p className="pageSub">Side quest challenges + community challenges!</p>
        </div>
      </div>

      <div className="questsGrid">
        {/* LEFT */}
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2 className="panelTitle">Today’s Quests</h2>
              <p className="panelSub">Complete these for coins + XP</p>
            </div>

            <div className="panelActions">
              <label className="inlineField">
                <span>Sort</span>
                <select
                  id="sort"
                  name="sortfilter"
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                >
                  <option value="rarity">Rarity</option>
                  <option value="alpha">Alphabetical</option>
                </select>
              </label>

              <button onClick={refreshQuests} disabled={refreshing} className="primaryBtn">
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>

          <div className="panelBody">
            <QuestCard
              currentQuests={sortedCurrentQuests}
              loading={loading}
              refreshing={refreshing}
              isCompletedFor={isCompletedFor}
              onToggleQuest={handleToggleQuest}
              savingKey={savingKey}
            />
          </div>
        </section>

        {/* RIGHT */}
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2 className="panelTitle">Custom Quests</h2>
              <p className="panelSub">Community-made • always 20 XP • no coins</p>
            </div>

            <button className="primaryBtn" onClick={() => setShowCreateModal(true)}>
              + New
            </button>
          </div>

          {/* NEW: Filter bar */}
          <div className="filterBar">
            <input
              className="searchInput"
              placeholder="Search title, description, tags…"
              value={customSearch}
              onChange={(e) => setCustomSearch(e.target.value)}
            />

            <label className="inlineField">
              <span>Sort</span>
              <select value={customSort} onChange={(e) => setCustomSort(e.target.value)}>
                <option value="new">Newest</option>
                <option value="alpha">Alphabetical</option>
                <option value="vis">Visibility</option>
                <option value="status">Completion</option>
              </select>
            </label>

            <label className="inlineField">
              <span>Visibility</span>
              <select value={customVisFilter} onChange={(e) => setCustomVisFilter(e.target.value)}>
                <option value="all">all</option>
                <option value="public">public</option>
                <option value="friends">friends</option>
                <option value="private">private</option>
              </select>
            </label>

            <label className="checkField">
              <input
                type="checkbox"
                checked={customShowCompleted}
                onChange={(e) => setCustomShowCompleted(e.target.checked)}
              />
              <span>Show completed</span>
            </label>
          </div>

          <div className="panelBody">
            {loading ? (
              <div className="emptyState">
                <p>Loading…</p>
              </div>
            ) : filteredCustomQuests.length === 0 ? (
              <div className="emptyState">
                <p>No matches.</p>
                <button
                  className="ghostBtn"
                  onClick={() => {
                    setCustomSearch("");
                    setCustomTag("all");
                    setCustomSort("new");
                    setCustomShowCompleted(true);
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="customList">
                {filteredCustomQuests.map((cq) => {
                  const done = isCustomCompletedFor(cq._id);
                  const vis = cq.visibility || "public";
                  const tags = (cq.tags || []).slice(0, 4);

                  return (
                    <div key={cq._id} className={`customCard ${done ? "done" : ""}`}>
                      <div className="customTop">
                        <div className="customTopLeft">
                          <h3 className="customTitle">{cq.title}</h3>
                          <div className="tagRow">
                            <span className={`pill ${vis}`}>{vis}</span>
                            {tags.map((t) => (
                              <span key={t} className="tagPill">
                                {t}
                              </span>
                            ))}
                            {(cq.tags || []).length > 4 && (
                              <span className="tagMore">+{cq.tags.length - 4}</span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleCustomQuest(cq._id, !done)}
                          disabled={savingKey === String(cq._id)}
                          className={done ? "ghostBtn" : "primaryBtn"}
                        >
                          {savingKey === String(cq._id)
                            ? "Saving…"
                            : done
                              ? "Completed"
                              : "Mark Complete"}
                        </button>
                      </div>

                      <p className="customDesc">{cq.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* MODAL */}
      {showCreateModal && (
        <div className="modalBackdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <h2>Create a Custom Quest</h2>
              <button className="iconBtn" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCustomQuest} className="modalBody">
              <label className="field">
                <span>Title</span>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} required />
              </label>

              <label className="field">
                <span>Tags (comma-separated)</span>
                <input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="gym, study, social"
                />
              </label>

              <label className="field">
                <span>Visibility</span>
                <select value={newVis} onChange={(e) => setNewVis(e.target.value)}>
                  <option value="public">public</option>
                  <option value="friends">friends</option>
                  <option value="private">private</option>
                </select>
              </label>

              <div className="modalFooter">
                <button
                  type="button"
                  className="ghostBtn"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="primaryBtn" disabled={creating}>
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quests;
