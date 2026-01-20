import React from "react";

import "../../utilities.css";
import { UserContext } from "../App";


/**
 * Component to render a single quest block
 *
 * Proptypes
 * @param {boolean} loading
 * @param {boolean} refreshing
 * @param {Array} currentQuests Array of 3 quest objects
 */
const SingleJournalBlock = (props) => {
  return (
    <>
      <h5>SingleJournalBlock</h5>
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

export default SingleJournalBlock;
