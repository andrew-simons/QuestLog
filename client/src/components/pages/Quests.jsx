import React, { useState, useEffect, useContext } from "react";
import { get, patch, post } from "../../utilities";
import "../../utilities.css";
import { UserContext } from "../App";
import QuestCard from "../modules/QuestCard";
import "./Quests.css";

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

  const isCustomCompletedFor = (customQuestId) => {
    const uq = userQuestByCustomId.get(String(customQuestId));
    return uq?.isCompleted ?? false;
  };

  const handleToggleCustomQuest = (customQuestId, isCompleted) => {
    if (!userId || savingKey === customQuestId) return;
    setSavingKey(customQuestId);

    const prevWasCompleted = isCustomCompletedFor(customQuestId);

    setUserQuestByCustomId((prev) => {
      const next = new Map(prev);
      const prevDoc = next.get(customQuestId) || { customQuestId, source: "custom" };
      next.set(customQuestId, { ...prevDoc, customQuestId, source: "custom", isCompleted });
      return next;
    });

    patch("/api/userquests", { source: "custom", customQuestId, isCompleted })
      .then((serverResp) => {
        setUserQuestByCustomId((prev) => {
          const next = new Map(prev);
          next.set(customQuestId, serverResp.userQuest);
          return next;
        });
      })
      .catch((err) => {
        console.log(err);
        setUserQuestByCustomId((prev) => {
          const next = new Map(prev);
          const prevDoc = next.get(customQuestId) || { customQuestId, source: "custom" };
          next.set(customQuestId, {
            ...prevDoc,
            customQuestId,
            source: "custom",
            isCompleted: prevWasCompleted,
          });
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

  const handleToggleQuest = (questKey, isCompleted) => {
    if (!userId || savingKey === questKey) return;
    setSavingKey(questKey);

    const prevWasCompleted = isCompletedFor(questKey);

    // optimistic update
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
        // rollback to exact previous state
        setUserQuestByKey((prev) => {
          const next = new Map(prev);
          const prevDoc = next.get(questKey) || { questKey };
          next.set(questKey, { ...prevDoc, questKey, isCompleted: prevWasCompleted });
          return next;
        });
      })
      .finally(() => setSavingKey(null));
  };

  const isCompletedFor = (questKey) => {
    const uq = userQuestByKey.get(questKey);
    return uq?.isCompleted ?? false;
  };

  const handleCreateCustomQuest = async (e) => {
    e.preventDefault();
    if (!userId || creating) return;

    setCreating(true);
    try {
      const tags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await post("/api/customquests", {
        title: newTitle,
        description: newDesc,
        tags,
        visibility: newVis,
      });

      // show it immediately (prepend)
      setCustomQuests((prev) => [created, ...prev]);

      // reset form
      setNewTitle("");
      setNewDesc("");
      setNewTags("");
      setNewVis("public");
    } catch (err) {
      console.log(err);
      alert("Failed to create custom quest");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="questsPage">
      <h1 className="pageTitle">Quests</h1>

      <div className="questsGrid">
        {/* LEFT: Built-in quests */}
        <section className="panel">
          <div className="panelHeader">
            <div>
              <h2 className="panelTitle">Today’s Quests</h2>
              <p className="panelSub">Complete these for coins + XP</p>
            </div>

            <div className="panelActions">
              <label className="inlineField">
                <span>Sort</span>
                <select id="sort" name="sortfilter">
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
              currentQuests={currentQuests}
              loading={loading}
              refreshing={refreshing}
              isCompletedFor={isCompletedFor}
              onToggleQuest={handleToggleQuest}
              savingKey={savingKey}
            />
          </div>
        </section>

        {/* RIGHT: Custom quests */}
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

          <div className="panelBody">
            {customQuests.length === 0 ? (
              <div className="emptyState">
                <p>No custom quests yet.</p>
                <button className="ghostBtn" onClick={() => setShowCreateModal(true)}>
                  Create the first one
                </button>
              </div>
            ) : (
              <div className="customList">
                {customQuests.map((cq) => {
                  const done = isCustomCompletedFor(cq._id);
                  return (
                    <div key={cq._id} className="customCard">
                      <div className="customTop">
                        <h3 className="customTitle">{cq.title}</h3>
                        <span className={`pill ${cq.visibility || "public"}`}>
                          {cq.visibility || "public"}
                        </span>
                      </div>

                      <p className="customDesc">{cq.description}</p>

                      <div className="customActions">
                        <button
                          onClick={() => handleToggleCustomQuest(cq._id, !done)}
                          disabled={savingKey === cq._id}
                          className={done ? "ghostBtn" : "primaryBtn"}
                        >
                          {done ? "Completed" : "Mark Complete"}
                        </button>
                      </div>
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

            <form
              onSubmit={(e) => {
                handleCreateCustomQuest(e);
                // if your handler succeeds, you can also close it there
                // or close it optimistically here:
                // setShowCreateModal(false);
              }}
              className="modalBody"
            >
              <label className="field">
                <span>Title</span>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </label>

              <label className="field">
                <span>Description</span>
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              </label>

              <label className="field">
                <span>Tags (comma-separated)</span>
                <input value={newTags} onChange={(e) => setNewTags(e.target.value)} />
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
