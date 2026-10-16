import React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { scoreText, stepScore } from "./scores.js";
import "./score-input.css";

export default function ScoreInput({ label, value, cap, onChange, disabled }) {
  const step = (amount) => onChange(stepScore(value, amount, cap));
  return (
    <div className="score-input">
      <input
        aria-label={label}
        role="spinbutton"
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={value === "" ? undefined : Number(value)}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="Score"
        value={value}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const next = scoreText(e.target.value);
          if (next !== null) onChange(next);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            step(e.key === "ArrowUp" ? 1 : -1);
          }
        }}
      />
      <div className="score-step-buttons">
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || Number(value) >= cap}
          onClick={() => step(1)}
        >
          <ChevronUp size={20} />
        </button>
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value === "0"}
          onClick={() => step(-1)}
        >
          <ChevronDown size={20} />
        </button>
      </div>
    </div>
  );
}
