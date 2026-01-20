import React, { useState, useEffect, useContext } from "react";
import { get, patch } from "../../utilities";
import "../../utilities.css";
import { UserContext } from "../App";
import QuestCard from "../modules/QuestCard";

const Quests = () => {
  const { userId } = useContext(UserContext);

  const [currentQuests, setCurrentQuests] = useState([]);
  const [userQuestByKey, setUserQuestByKey] = useState(new Map());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    Promise.all([get("/api/currentquests"), get("/api/userquests")])
      .then(([quests, userQuests]) => {

        setCurrentQuests(quests);
        

        const map = new Map();
        userQuests.forEach((uq) => map.set(uq.questKey, uq));
        setUserQuestByKey(map);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, [userId]);

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
    if (!userId || savingKey) return;
    setSavingKey(questKey);

    // update (treat missing as false)
    setUserQuestByKey((prev) => {
      const next = new Map(prev);
      const prevDoc = next.get(questKey) || { questKey };
      next.set(questKey, { ...prevDoc, questKey, isCompleted });

      console.log("BUTTON TOGGLED SUCCESSFULLY")
      return next;
    });

    patch("/api/userquests", { questKey, isCompleted })
      .then((serverDoc) => {
        setUserQuestByKey((prev) => {
          const next = new Map(prev);
          next.set(questKey, serverDoc); // authoritative doc from server
          return next;
        });
      })
      .catch((err) => {
        console.log(err);
        // rollback
        setUserQuestByKey((prev) => {
          const next = new Map(prev);
          const prevDoc = next.get(questKey) || { questKey };
          next.set(questKey, { ...prevDoc, questKey, isCompleted: !isCompleted });
          return next;
        });
      })
      .finally(() => setSavingKey(null));
  };

  const isCompletedFor = (questKey) => {
    const uq = userQuestByKey.get(questKey);
    return uq?.isCompleted ?? false;
  };

  return (
    <>
      <h1>Quests!</h1>

      <button onClick={refreshQuests} disabled={refreshing}>
        {refreshing ? "Refreshing..." : "Refresh Quests"}
      </button>

      <label htmlFor="sort">Sort By</label>
      <select id="sort" name="sortfilter">
        <option value="rarity">Rarity</option>
        <option value="alpha">Alphabetical</option>
      </select>

      <QuestCard
        currentQuests={currentQuests}
        loading={loading}
        refreshing={refreshing}
        isCompletedFor={isCompletedFor}
        onToggleQuest={handleToggleQuest}
        savingKey={savingKey}
      />
    </>
  );
};

export default Quests;
