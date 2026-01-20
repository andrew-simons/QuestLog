import React, { useEffect, useState, useContext } from "react";
import { get, patch } from "../../utilities";
import { UserContext } from "../App";
import JournalCard from "../modules/JournalCard";

const Journal = () => {
  const { userId } = useContext(UserContext);

  const [completedQuests, setCompletedQuests] = useState([]);
  const [journalByQuestKey, setJournalByQuestKey] = useState(new Map());
  const [loading, setLoading] = useState(true);

  // which quest journal is currently saving (optional UX)
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    get("/api/journal")
      .then(({ quests, journals }) => {
        setCompletedQuests(quests || []);

        const map = new Map();
        (journals || []).forEach((j) => {
          map.set(j.questKey, j);
        });
        setJournalByQuestKey(map);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, [userId]);

  // Save (upsert) one journal doc for a quest
  const saveJournal = (questKey, { text, photoUrls }) => {
    if (!userId) return Promise.reject(new Error("Not logged in"));

    setSavingKey(questKey);

    return patch("/api/journal", { questKey, text, photoUrls })
      .then((updatedDoc) => {
        setJournalByQuestKey((prev) => {
          const next = new Map(prev);
          next.set(questKey, updatedDoc);
          return next;
        });
        return updatedDoc;
      })
      .finally(() => setSavingKey(null));
  };

  const getJournalFor = (questKey) => {
    return (
      journalByQuestKey.get(questKey) || {
        questKey,
        text: "",
        photoUrls: [],
      }
    );
  };

  return (
    <>
      <h1>Journal</h1>

      <JournalCard
        loading={loading}
        completedQuests={completedQuests}
        getJournalFor={getJournalFor}
        onSaveJournal={saveJournal}
        savingKey={savingKey}
      />
    </>
  );
};

export default Journal;
