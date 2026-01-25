import React, { useState, useEffect, useContext } from "react";
import { Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import "../../utilities.css";
import "./NavBar.css";
import { UserContext } from "../App";

const NavBar = () => {
  const { userId, handleLogin, handleLogout } = useContext(UserContext);

  return (
    <nav className="NavBar-container sketchNav">
      <div className="sketchNav-left">
        <div className="NavBar-title sketchBrand">QUESTLOG</div>
      </div>

      <div className="NavBar-linkContainer sketchTabs">
        <Link to="/home" className="NavBar-link sketchTab">
          Home
        </Link>
        <Link to="/quests" className="NavBar-link sketchTab">
          Quests
        </Link>
        <Link to="/journal" className="NavBar-link sketchTab">
          Journal
        </Link>
        <Link to="/friends" className="NavBar-link sketchTab">
          Friends
        </Link>

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
                containerProps={{ className: "NavBar-link NavBar-login" }}
              />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
