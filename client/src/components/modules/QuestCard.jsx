import React from "react";

import "../../utilities.css";
import { UserContext } from "../App";
import SingleQuestBlock from "./SingleQuestBlock";
import EmptyQuestBlock from "./EmptyQuestBlock";

/**
 * Component to render a single quest block
 *
 * Proptypes
 * @param {boolean} loading
 * @param {boolean} refreshing
 * @param {Array} currentQuests Array of 3 quest objects
 */
const QuestCard = (props) => {
  return (
    <>
      <h1>QuestCard</h1>
      {props.loading ? (
        <p>Loading...</p>
      ) : props.currentQuests.length === 0 ? (
        <p>No current quests yet.</p>
      ) : (
        props.currentQuests.map((quest) => <SingleQuestBlock key={quest.questKey} quest={quest} />)
      )}
    </>
  );
};

export default QuestCard;
