import React, { useState, useEffect, createContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";

import jwt_decode from "jwt-decode";

import "../utilities.css";

import { socket } from "../client-socket";

import { get, post } from "../utilities";

import NavBar from "./modules/NavBar";
import Login from "./pages/Login";

export const UserContext = createContext(null);

/**
 * Define the "App" component
 */
const App = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState(undefined);

  useEffect(() => {
    get("/api/whoami").then((user) => {
      if (user._id) {
        // they are registed in the database, and currently logged in.
        setUserId(user._id);
      }
    });
  }, []);

  const handleLogin = (credentialResponse) => {
    const userToken = credentialResponse.credential;
    const decodedCredential = jwt_decode(userToken);
    console.log(`Logged in as ${decodedCredential.name}`);
    post("/api/login", { token: userToken }).then((user) => {
      setUserId(user._id);
      post("/api/initsocket", { socketid: socket.id });
    });
    navigate("/home", { replace: true });
  };

  const handleLogout = () => {
    setUserId(undefined);
    post("/api/logout");
    navigate("/", { replace: true });
  };

  const authContextValue = {
    userId,
    handleLogin,
    handleLogout,
  };

  if (userId === undefined) {
    return (
      <>
        <UserContext.Provider value={authContextValue}>
          <Login />
        </UserContext.Provider>
        ;
      </>
    );
  } else {
    return (
      <>
        <UserContext.Provider value={authContextValue}>
          <NavBar />
          <Outlet />
        </UserContext.Provider>
        ;
      </>
    );
  }
};

export default App;
