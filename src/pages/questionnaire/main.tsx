import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Questionnaire } from "./Questionnaire.tsx";
import "./questionnaire.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Questionnaire />
  </StrictMode>
);
