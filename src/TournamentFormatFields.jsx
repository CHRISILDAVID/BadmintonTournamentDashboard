import React from "react";
import {
  qualificationFormats,
  qualificationFormat,
  isPlayoffFormat,
  playoffPreset,
  scoringRules,
  knockoutStage,
  drawSize,
} from "../shared/format.js";
import "./tournament-format.css";

function RuleFields({ title, value, change }) {
  const update = (key, input) => {
    const next = { ...value, [key]: input };
    if (next.goldenPoint) next.cap = next.points;
    else if (next.cap <= next.points) next.cap = Math.max(30, next.points + 1);
    change(next);
  };
  return (
    <fieldset className="stage-scoring">
      <legend>{title}</legend>
      <div className="form-row three">
        <label className="field">
          <span>Best of</span>
          <select
            aria-label={`${title} best of`}
            value={value.bestOf}
            onChange={(e) => update("bestOf", +e.target.value)}
          >
            {[1, 3, 5].map((n) => (
              <option key={n} value={n}>
                {n} game{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Points per game</span>
          <input
            aria-label={`${title} points`}
            type="number"
            min="5"
            max="50"
            required
            value={value.points}
            onChange={(e) => update("points", +e.target.value)}
          />
        </label>
        <label className="field">
          <span>Finish rule</span>
          <select
            aria-label={`${title} finish rule`}
            value={value.goldenPoint ? "golden" : "deuce"}
            onChange={(e) => update("goldenPoint", e.target.value === "golden")}
          >
            <option value="golden">Golden point</option>
            <option value="deuce">Deuce + cap</option>
          </select>
        </label>
      </div>
      {!value.goldenPoint && (
        <label className="field">
          <span>Score cap</span>
          <input
            aria-label={`${title} score cap`}
            type="number"
            min={value.points + 1}
            max="60"
            required
            value={value.cap}
            onChange={(e) => update("cap", +e.target.value)}
          />
        </label>
      )}
      <p className="help-text">
        {value.goldenPoint
          ? `At ${value.points - 1}–${value.points - 1}, the next point wins. Play stops at ${value.points}.`
          : `Win by two from ${value.points}; at ${value.cap - 1}–${value.cap - 1}, the next point wins.`}
      </p>
    </fieldset>
  );
}

export default function TournamentFormatFields({ form, setForm }) {
  const custom = isPlayoffFormat(form);
  const details = qualificationFormat(form);
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const scoring = form.scoring || {
    league: scoringRules(form),
    knockout: scoringRules(form, "Final"),
  };
  return (
    <>
      <label className="field">
        <span>Qualification format</span>
        <select
          aria-label="Qualification format"
          value={form.qualification || "direct"}
          onChange={(e) => {
            const mode = e.target.value;
            setForm((current) =>
              mode === "direct"
                ? { ...current, qualification: mode }
                : { ...current, ...playoffPreset(mode, current.groups) },
            );
          }}
        >
          {Object.entries(qualificationFormats).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Number of groups</span>
        <input type="number" min="1" max="256" step="1" required
          aria-label="Number of groups" value={form.groups}
          onChange={(e) => change("groups", e.target.value === "" ? "" : +e.target.value)} />
      </label>
      {custom ? (
        <div className="format-preview">
          <div>
            <strong>
              {form.groups} group{form.groups > 1 ? "s" : ""} of{" "}
              {details.teamsPerGroup} doubles teams
            </strong>
            <span>
              Top {details.direct} per group advance directly.{" "}
              {details.pairs
                .map(
                  ([high, low, slot]) =>
                    `${high} vs ${low} plays for slot ${slot}`,
                )
                .join("; ")}{" "}
              in each group.
            </span>
            <span>
              {form.groups * 4} knockout places · Starts at{" "}
              {knockoutStage(drawSize(form.groups * 4))}{" · "}
              {drawSize(form.groups * 4) - form.groups * 4} automatic byes.
              {form.groups > 1
                ? " · Opening matches pair different groups"
                : " · 1st vs 4th, 2nd vs 3rd"}
            </span>
            <span>
              Exactly {form.groups * details.teamsPerGroup} teams required.{" "}
              {form.groups *
                ((details.teamsPerGroup * (details.teamsPerGroup - 1)) / 2 +
                  details.pairs.length +
                  4) -
                1}{" "}
              matches including league, playoffs and main knockout.
            </span>
          </div>
        </div>
      ) : (
        <>
          <div className="form-row">
            <label className="field">
              <span>Qualifiers per group</span>
              <input type="number" min="1" max="256" step="1" required
                value={form.qualify}
                onChange={(e) => change("qualify", e.target.value === "" ? "" : +e.target.value)} />
            </label>
          </div>
          <p className="help-text">
            {form.groups * form.qualify} knockout places; starts at {knockoutStage(drawSize(form.groups * form.qualify))} with {drawSize(form.groups * form.qualify) - form.groups * form.qualify} automatic byes.
            {" "}Add at least {form.groups * Math.max(2, form.qualify)} teams. Groups are balanced automatically; qualifiers are seeded by league place, then group order. At least two knockout places are required.
          </p>
        </>
      )}
      {[
        ["league", "League"],
        ...(custom ? [["playoff", "Qualification playoff"]] : []),
        ["knockout", "Main knockout"],
      ].map(([key, title]) => (
        <RuleFields
          key={key}
          title={title}
          value={scoring[key]}
          change={(value) =>
            setForm((current) => ({
              ...current,
              scoring: { ...(current.scoring || scoring), [key]: value },
            }))
          }
        />
      ))}
      <p className="help-text">
        Standings use wins, game difference, point difference, then seed. Format
        and scoring lock when fixtures are generated.
      </p>
    </>
  );
}
