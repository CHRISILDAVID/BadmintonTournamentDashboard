import { Input } from "./components/ui/input.jsx";
import { NativeSelect } from "./components/ui/native-select.jsx";
import React from "react";
import {
  isPlayoffFormat,
  scoringRules,
  knockoutStage,
  drawSize,
  PLAYOFF_STAGE,
  scoringLabel,
} from "../shared/format.js";
import { Button } from "./components/ui/button.jsx";
import "./tournament-format.css";

export function RuleFields({ title, value, change }) {
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
          <NativeSelect
            aria-label={`${title} best of`}
            value={value.bestOf}
            onChange={(e) => update("bestOf", +e.target.value)}
          >
            {[1, 3, 5].map((n) => (
              <option key={n} value={n}>
                {n} game{n > 1 ? "s" : ""}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="field">
          <span>Points per game</span>
          <Input
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
          <NativeSelect
            aria-label={`${title} finish rule`}
            value={value.goldenPoint ? "golden" : "deuce"}
            onChange={(e) => update("goldenPoint", e.target.value === "golden")}
          >
            <option value="golden">Golden point</option>
            <option value="deuce">Deuce + cap</option>
          </NativeSelect>
        </label>
      </div>
      {!value.goldenPoint && (
        <label className="field">
          <span>Score cap</span>
          <Input
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

export function StageScoringFields({ form, setForm }) {
  const stages = [["league", "League", "League"], ...(isPlayoffFormat(form) ? [["playoff", "Qualification playoff", PLAYOFF_STAGE]] : []), ["knockout", "Main knockout", "Final"]];
  const scoring = Object.fromEntries(stages.map(([key, , stage]) => [key, scoringRules(form, stage)]));
  return <>
    <div className="format-preview"><div><strong>Scoring by stage</strong><span>Each stage has its own rules. Changing League points does not change {isPlayoffFormat(form) ? "playoffs or main knockouts" : "main knockouts"}.</span></div></div>
    <Button type="button" variant="outline" onClick={() => setForm(current => ({ ...current, scoring: Object.fromEntries(stages.map(([key]) => [key, { ...scoringRules(current) }])) }))}>Use league rules for every stage</Button>
    {stages.map(([key, title]) => <RuleFields key={key} title={title} value={scoring[key]} change={value => setForm(current => ({ ...current, scoring: { ...scoring, ...current.scoring, [key]: value } }))}/>)}
    <div className="format-preview" aria-label="Scoring summary"><div><strong>Review scoring</strong>{stages.map(([key, title]) => <span key={key}>{title}: {scoringLabel(scoring[key])}</span>)}</div></div>
  </>;
}

export default function TournamentFormatFields({ form, setForm }) {
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <>
      <label className="field">
        <span>Qualification format</span>
        <NativeSelect
          aria-label="Qualification format"
          value="direct"
          disabled
        >
          <option value="direct">Direct qualification</option>
        </NativeSelect>
      </label>
      <label className="field">
        <span>Number of groups</span>
        <Input type="number" min="1" max="256" step="1" required
          aria-label="Number of groups" value={form.groups}
          onChange={(e) => change("groups", e.target.value === "" ? "" : +e.target.value)} />
      </label>
      <div className="form-row">
        <label className="field">
          <span>Qualifiers per group</span>
          <Input type="number" min="1" max="256" step="1" required
            value={form.qualify}
            onChange={(e) => change("qualify", e.target.value === "" ? "" : +e.target.value)} />
        </label>
      </div>
      <p className="help-text">
        {form.groups * form.qualify} knockout places; starts at {knockoutStage(drawSize(form.groups * form.qualify))} with {drawSize(form.groups * form.qualify) - form.groups * form.qualify} automatic byes.
        {" "}Add at least {form.groups * Math.max(2, form.qualify)} teams. Groups are balanced automatically; qualifiers are seeded by league place, then group order. At least two knockout places are required.
      </p>
      <StageScoringFields form={form} setForm={setForm}/>
      <p className="help-text">
        Standings use wins, game difference, point difference, then seed. Format
        locks when fixtures are generated. Scoring can be corrected later for unfinished matches.
      </p>
    </>
  );
}
