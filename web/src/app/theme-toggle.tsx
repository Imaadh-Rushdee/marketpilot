"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const [light,setLight]=useState(false);
  useEffect(()=>{queueMicrotask(()=>{const value=localStorage.getItem("marketpilot.theme")==="light";setLight(value);document.documentElement.dataset.theme=value?"light":"dark";});},[]);
  function toggle(){const next=!light;setLight(next);document.documentElement.dataset.theme=next?"light":"dark";localStorage.setItem("marketpilot.theme",next?"light":"dark");}
  return <button className="icon-btn" title={light?"Use dark mode":"Use light mode"} aria-label={light?"Use dark mode":"Use light mode"} onClick={toggle}>{light?<Moon size={18}/>:<Sun size={18}/>}</button>;
}
