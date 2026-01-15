import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import "../../utilities.css";
import "./NavBar.css";
import { UserContext } from "../App";

const NavBar = () => {
  const { userId, handleLogin, handleLogout } = useContext(UserContext);
      return (
      <nav className="NavBar-container">
        <div className="NavBar-title u-inlineBlock">QuestLog</div>
        <div className="NavBar-linkContainer u-inlineBlock">
          <Link to="/" className="NavBar-link">
            Home
          </Link>
          <Link to="/quests" className="NavBar-link">
            Quests
          </Link>
          <Link to="/journal" className="NavBar-link">
            Journal
          </Link>
          {userId && (
            <Link to={`/`} className="NavBar-link">
              etc
            </Link>
          )}
          {userId ? (
            <button className="NavBar-link NavBar-login u-inlineBlock" onClick={handleLogout}>
              Sign out
            </button>
          ) : (
            <GoogleLogin
              text="signin_with"
              onSuccess={handleLogin}
              onFailure={(err) => console.log(err)}
              containerProps={{ className: "NavBar-link NavBar-login u-inlineBlock" }}
            />
          )}
        </div>
      </nav>
    );

};

export default NavBar;
