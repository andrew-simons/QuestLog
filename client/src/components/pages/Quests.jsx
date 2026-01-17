import React from "react";

import "../../utilities.css";
import { UserContext } from "../App";
import QuestCard from "../modules/QuestCard";


const Quests = () => {
  return (
    <>
      <h1>Quests!</h1>
      <label for="sort">Sort By</label>
      <select id="sort" name="sortfilter">
        <option value="rairity">Rairity</option>
        <option value="alpha">Alphabetical</option>
      </select>
      <QuestCard />
    </>
  );
};

export default Quests;
