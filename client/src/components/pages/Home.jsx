import React, { useContext, useEffect, useRef } from "react";
import { GoogleLogin, googleLogout } from "@react-oauth/google";

import * as THREE from "three"; //3D modeling library (didnt look good :( )

import "../../utilities.css";
import "./Skeleton.css";
import { UserContext } from "../App";


const Home = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    let x = 100;
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "green";
      ctx.fillRect(x, 200, 50, 50);
      x += 1;
      requestAnimationFrame(loop);
    }
    loop();

    return () => {
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} />;
};
export default Home;



// const Home = () => {
//   const { userId, handleLogin, handleLogout } = useContext(UserContext);

//   const canvas = document.getElementById("game");
//   const ctx = canvas.getContext("2d")

//   return (
//     <>
//       <canvas id="game" width="150" height="150"></canvas>
//       <script type="module" src="/main.js"></script>
//     </>
//   );
// };

// export default Home;