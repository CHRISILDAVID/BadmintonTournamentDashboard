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
  isKnockoutOnly,
  isLinkedPlayoffs,
  qualificationFormats,
  tournamentFormats,
} from "../shared/format.js";
import { linkedSourceSupportsLeague, qualifiesFromLeague } from "../shared/linked-playoffs.js";
import { Button } from "./components/ui/button.jsx";
import { scoreText } from "./scores.js";
import "./tournament-format.css";

export function RuleFields({ title, value, change }) {
  const update = (key, input) => {
    const next = { ...value, [key]: input };
    if (next.goldenPoint) next.cap = next.points;
    else if ((key === "points" || key === "goldenPoint") && next.cap !== "" &&
      next.points >= 5 && next.points <= 50 && next.cap <= next.points)
      next.cap = Math.max(30, next.points + 1);
    change(next);
  };
  const updateNumber = (key, raw) => {
    const text = scoreText(raw);
    if (text !== null) update(key, text === "" ? "" : Number(text));
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
            value={String(value.points)}
            onChange={(e) => updateNumber("points", e.target.value)}
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
            min={value.points === "" ? undefined : value.points + 1}
            max="60"
            required
            value={String(value.cap)}
            onChange={(e) => updateNumber("cap", e.target.value)}
          />
        </label>
      )}
      <p className="help-text">
        {value.points === "" || value.cap === "" ? "Enter the scoring values to review the finish rule." : value.goldenPoint
          ? `At ${value.points - 1}–${value.points - 1}, the next point wins. Play stops at ${value.points}.`
          : `Win by two from ${value.points}; at ${value.cap - 1}–${value.cap - 1}, the next point wins.`}
      </p>
    </fieldset>
  );
}

export function StageScoringFields({ form, setForm }) {
  const knockoutOnly = isKnockoutOnly(form);
  const stages = [
    ...(!knockoutOnly ? [["league", "League", "League"]] : []),
    ...(isPlayoffFormat(form) ? [["playoff", "Qualification playoff", PLAYOFF_STAGE]] : []),
    ["knockout", isLinkedPlayoffs(form) ? "Linked playoffs" : knockoutOnly ? "Knockout" : "Main knockout", "Final"],
  ];
  const scoring = Object.fromEntries(stages.map(([key, , stage]) => [key, scoringRules(form, stage)]));
  return <>
    {!knockoutOnly && <>
      <div className="format-preview"><div><strong>Scoring by stage</strong><span>Each stage has its own rules. Changing League points does not change {isPlayoffFormat(form) ? "playoffs or main knockouts" : "main knockouts"}.</span></div></div>
      <Button type="button" variant="outline" onClick={() => setForm(current => ({ ...current, scoring: Object.fromEntries(stages.map(([key]) => [key, { ...scoringRules(current) }])) }))}>Use league rules for every stage</Button>
    </>}
    {stages.map(([key, title]) => <RuleFields key={key} title={title} value={scoring[key]} change={value => setForm(current => ({ ...current, scoring: { ...scoring, ...current.scoring, [key]: value } }))}/>)}
    <div className="format-preview" aria-label="Scoring summary"><div><strong>Review scoring</strong>{stages.map(([key, title]) => {
      const rules = scoring[key];
      return <span key={key}>{title}: {rules.points === "" || rules.cap === "" ? "Enter the scoring values" : scoringLabel(rules)}</span>;
    })}</div></div>
  </>;
}

function LinkedPlayoffFields({ form, change, state }) {
  const { mode, sources } = form.linkedPlayoffs;
  const categories = state.tournaments.filter(t => !isLinkedPlayoffs(t) && t.size === form.size);
  const updateSource = (index, source) => change("linkedPlayoffs", {
    mode, sources: sources.map((current, i) => i === index ? source : current),
  });
  return <>
    <label className="field">
      <span>Linked bracket</span>
      <NativeSelect value={mode} onChange={e => change("linkedPlayoffs", { mode: e.target.value, sources })}>
        <option value="final">Grand Final</option>
        <option value="semifinals">Grand Semifinals + Grand Final</option>
      </NativeSelect>
    </label>
    {categories.length < 2 && <p className="help-text">Create two source categories with {form.size} player{form.size === 1 ? "" : "s"} per team first.</p>}
    {sources.map((source, index) => {
      const category = categories.find(t => t.id === source.tournamentId);
      const canUseLeague = category && linkedSourceSupportsLeague(state, category);
      const leagueOnly = category && qualifiesFromLeague(state, category.id);
      return <div className="form-row" key={index}>
        <label className="field">
          <span>Source category {index + 1}</span>
          <NativeSelect required value={category?.id ?? ""} onChange={e => updateSource(index, {
            tournamentId: e.target.value,
            method: qualifiesFromLeague(state, e.target.value) ? "league" : "bracket",
          })}>
            <option value="">Choose a category</option>
            {categories.filter(t => t.id !== sources[1 - index].tournamentId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </NativeSelect>
        </label>
        <label className="field">
          <span>Qualify through</span>
          <NativeSelect value={source.method} disabled={!category} onChange={e => updateSource(index, { ...source, method: e.target.value })}>
            <option value="bracket" disabled={leagueOnly}>{mode === "final" ? "Category winner" : "Category winner and runner-up"}</option>
            <option value="league" disabled={!canUseLeague}>{mode === "final" ? "1st place in league standings" : "Top 2 in league standings"}</option>
          </NativeSelect>
        </label>
      </div>;
    })}
    <p className="help-text">League qualification uses one group and goes directly to linked playoffs. Category bracket results qualify teams after the Category Final.</p>
    {mode === "semifinals" && <p className="help-text">The first-place team from each category plays the second-place team from the other category.</p>}
  </>;
}

export default function TournamentFormatFields({ form, setForm, state, editing }) {
  const knockoutOnly = isKnockoutOnly(form);
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <>
      <label className="field">
        <span>Tournament format</span>
        <NativeSelect value={form.format} onChange={(e) => change("format", e.target.value)}>
          {Object.entries(tournamentFormats).filter(([value]) => !editing || value !== "linked").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </NativeSelect>
      </label>
      {isLinkedPlayoffs(form) ? <LinkedPlayoffFields form={form} change={change} state={state}/> : knockoutOnly ? (
        <p className="help-text">Add at least two teams. All entries go into a seeded, single-elimination bracket. Empty places become automatic byes.</p>
      ) : <>
      <p className="help-text">Teams play everyone in their group once. Qualifiers advance to a single-elimination bracket.</p>
      <label className="field">
        <span>Qualification format</span>
        <NativeSelect value={form.qualification} disabled>
          <option value={form.qualification}>{qualificationFormats[form.qualification]?.label}</option>
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
        {form.groups * form.qualify} knockout places. Starts at {knockoutStage(drawSize(form.groups * form.qualify))} with {drawSize(form.groups * form.qualify) - form.groups * form.qualify} automatic byes.
        {" "}Add at least {form.groups * Math.max(2, form.qualify)} teams. Groups are balanced automatically; qualifiers are seeded by league place, then group order. At least two knockout places are required.
      </p>
      </>}
      <StageScoringFields form={form} setForm={setForm}/>
      <p className="help-text">
        {!knockoutOnly && "Standings use wins, game difference, point difference, then seed. "}
        Format locks when fixtures are generated. Scoring can be corrected later for unfinished matches.
      </p>
    </>
  );
}
