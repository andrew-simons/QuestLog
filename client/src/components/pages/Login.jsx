import React, { useState, useEffect, useContext } from "react";

import "../../utilities.css";
import { UserContext } from "../App";
import "./Login.css";

import { GoogleLogin } from "@react-oauth/google";

const Login = () => {
  const { userId, handleLogin, handleLogout } = useContext(UserContext);

  return (
    <div className="loginContainer">
      <div className="loginContent">
        <h1 className="u-textCenter">Login Page</h1>
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
    </div>
  );
};

export default Login;
