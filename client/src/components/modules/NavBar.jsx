import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import "../../utilities.css";
import "./NavBar.css";
import { UserContext } from "../App";

const NavBar = () => {
  const { userId, me, handleLogin, handleLogout } = useContext(UserContext);

  const STEP_TO_TAB = {
    1: "home",
    2: "quests",
    3: "journal",
    4: "friends",
  };

  const tutorialStep = me?.tutorialDone ? null : me?.tutorialStep;
  const highlightedTab = STEP_TO_TAB[tutorialStep] || null;

  const tabClass = (tabKey) =>
    `NavBar-link sketchTab ${highlightedTab === tabKey ? "sketchTab--highlight" : ""}`;

  return (
    <nav className="NavBar-container sketchNav">
      <div className="sketchNav-left">
        <div className="NavBar-title sketchBrand">
          <img src="/img/ui/logoBrown.png" alt="QuestLog" className="sketchLogo" />
        </div>
      </div>

      <div className="NavBar-linkContainer sketchTabs">
        <div className="sketchTabs-main">
          <Link to="/home" className={tabClass("home")}>
            Home
          </Link>
          <Link to="/quests" className={tabClass("quests")}>
            Quests
          </Link>
          <Link to="/journal" className={tabClass("journal")}>
            Journal
          </Link>
          <Link to="/friends" className={tabClass("friends")}>
            Social
          </Link>
        </div>

        <div className="sketchNav-right">
          {userId ? (
            <button
              className="NavBar-link NavBar-login sketchTab sketchAuthBtn"
              onClick={handleLogout}
            >
              Sign out
            </button>
          ) : (
            <div className="sketchGoogleWrap">
              <GoogleLogin
                text="signin_with"
                onSuccess={handleLogin}
                onFailure={(err) => console.log(err)}
              />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
