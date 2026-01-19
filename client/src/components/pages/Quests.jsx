import React, { useState, useEffect } from "react";
import { get, patch, post } from "../../utilities";

import "../../utilities.css";
import { UserContext } from "../App";
import QuestCard from "../modules/QuestCard";

const Quests = () => {
  const [currentQuests, setCurrentQuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setLoading(true);
    get("/api/currentquests")
      .then((quests) => {
        console.log(quests);
        setCurrentQuests(quests);
      })
      .catch((err) => console.log(err))
      .finally(() => setLoading(false));
  }, []);

  // refresh function
  function refreshQuests() {
    setRefreshing(true);
    patch("/api/currentquests/refresh", {})
      .then((quests) => {
        setCurrentQuests(quests);
      })
      .catch((err) => {
        console.log(err);
        alert("Failed to refresh quests.");
      })
      .finally(() => setRefreshing(false));
  }

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

      <QuestCard currentQuests={currentQuests} loading={loading} refreshing={refreshing} />

    </>
  );
};

export default Quests;
