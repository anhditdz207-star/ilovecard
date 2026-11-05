import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { MotionConfig } from "framer-motion";

createRoot(document.getElementById("root")!).render(<MotionConfig reducedMotion="user"><App /></MotionConfig>);
