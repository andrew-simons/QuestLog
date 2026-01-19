import React from "react";

import "../../utilities.css";
import { UserContext } from "../App";

/**
 * Component to render a single quest block
 *
 * Proptypes
 * @param {object} quest Quest object with keys: questKey, title, rarity, xpReward
 */
const SingleQuestBlock = (props) => {
  return (
    <span>
      <h3>{props.quest.title}</h3>
      <input type="checkbox" name="idk" value="on" />
    </span>
  );
};

export default SingleQuestBlock;
