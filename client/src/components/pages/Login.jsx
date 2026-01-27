import React, { useState, useEffect, useContext } from "react";

import "../../utilities.css";
import { UserContext } from "../App";
import "./Login.css";

import { GoogleLogin } from "@react-oauth/google";

const Login = () => {
  const { handleLogin } = useContext(UserContext);

  return (
    <div className="login-container">
      <div className="login-card">
        <img src="/img/ui/beaver.png" alt="Beaver mascot" className="beaver-img" />

        <h1 className="title">QUESTLOG</h1>
        <p className="subtitle">small quests, real growth</p>

        <div className="login-button">
          <GoogleLogin
            text="signin_with"
            onSuccess={handleLogin}
            onFailure={(err) => console.log(err)}
          />
        </div>
      </div>
    </div>
  );
};

export default Login;
