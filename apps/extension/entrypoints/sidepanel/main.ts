import "./style.css";

import {
  STAGE_IDS,
  initialThesisState,
  reduceThesis,
  type StreamEvent,
} from "@bit-n-build-2026/contracts";
import { browser } from "wxt/browser";

const port = browser.runtime.connect({ name: "mind-over-money-side-panel" });
const query = document.querySelector<HTMLTextAreaElement>("#query")!;
const analyze = document.querySelector<HTMLButtonElement>("#analyze")!;
const auth = document.querySelector<HTMLButtonElement>("#auth")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const results = document.querySelector<HTMLElement>("#results")!;
const companyContext = document.querySelector<HTMLParagraphElement>("#company-context")!;

let thesis = initialThesisState();
let signingIn = false;

function setStatus(message: string): void {
  status.textContent = message;
}

function renderCompanyContext(context: unknown): void {
  const record = context && typeof context === "object" ? context as Record<string, unknown> : null;
  const companyName = typeof record?.companyName === "string" ? record.companyName : null;
  const message = typeof record?.message === "string" ? record.message : null;
  companyContext.hidden = !companyName;
  companyContext.textContent = companyName ? `Company context: ${companyName}` : "";
  if (companyName) setStatus("Company context is ready. Ask a question before sending.");
  else if (message) setStatus(message);
}

function renderDraft(draft: unknown): void {
  const record = draft && typeof draft === "object" ? draft as Record<string, unknown> : null;
  if (typeof record?.draft !== "string") return;
  query.value = record.draft;
  setStatus("Review the draft before sending it.");
}

function section(title: string): HTMLElement {
  const element = document.createElement("section");
  const heading = document.createElement("h2");
  heading.textContent = title;
  element.append(heading);
  return element;
}

function listItem(list: HTMLUListElement, text: string): void {
  const item = document.createElement("li");
  item.textContent = text;
  list.append(item);
}

function render(): void {
  results.replaceChildren();
  if (thesis.claim?.asset) {
    const asset = document.createElement("p");
    asset.textContent = `Investigating: ${thesis.claim.asset.name} (${thesis.claim.asset.ticker})`;
    results.append(asset);
  }
  for (const stageId of STAGE_IDS) {
    const stage = thesis.stages[stageId];
    if (stage.status === "pending" && stage.findings.length === 0) continue;
    const card = section(`${stage.label} — ${stage.status}`);
    if (stage.message) {
      const message = document.createElement("p");
      message.textContent = stage.message;
      card.append(message);
    }
    const findings = document.createElement("ul");
    for (const finding of stage.findings) {
      listItem(findings, `${finding.text} (${finding.stance}; ${finding.strength})`);
    }
    if (stage.findings.length) card.append(findings);
    results.append(card);
  }
  if (thesis.metrics.length) {
    const card = section("The numbers");
    const metrics = document.createElement("ul");
    for (const metric of thesis.metrics) {
      listItem(metrics, `${metric.label}: ${metric.display}. ${metric.explanation}`);
    }
    card.append(metrics);
    results.append(card);
  }
  for (const source of Object.values(thesis.sources)) {
    const article = document.createElement("article");
    const title = document.createElement("strong");
    title.textContent = source.title;
    const snippet = document.createElement("p");
    snippet.textContent = source.snippet;
    article.append(title, snippet);
    if (source.url) {
      const link = document.createElement("a");
      link.href = source.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open citation";
      article.append(link);
    }
    results.append(article);
  }
  if (thesis.concepts.length) {
    const card = section("What you just learned");
    const concepts = document.createElement("ul");
    for (const concept of thesis.concepts) {
      listItem(concepts, `${concept.term}: ${concept.explanation}`);
    }
    card.append(concepts);
    results.append(card);
  }
  if (thesis.verdict) {
    const card = section("Where you stand");
    const verdict = document.createElement("ul");
    for (const claim of thesis.verdict.holdsOn) listItem(verdict, `Holds on: ${claim}`);
    for (const claim of thesis.verdict.weakOn) listItem(verdict, `Weak on: ${claim}`);
    for (const claim of thesis.verdict.unverified) listItem(verdict, `Unverified: ${claim}`);
    for (const check of thesis.verdict.nextChecks) listItem(verdict, `Next check: ${check}`);
    card.append(verdict);
    const disclaimer = document.createElement("p");
    disclaimer.textContent = thesis.verdict.disclaimer;
    card.append(disclaimer);
    results.append(card);
  }
}

port.onMessage.addListener((message: unknown) => {
  if (!message || typeof message !== "object") return;
  const payload = message as {
    type?: string;
    draft?: { draft?: string } | null;
    context?: unknown;
    event?: StreamEvent;
    message?: string;
  };
  if (payload.type === "draft" && payload.draft?.draft) {
    renderDraft(payload.draft);
  } else if (payload.type === "context") {
    renderCompanyContext(payload.context);
  } else if (payload.type === "signed-in") {
    signingIn = false;
    auth.disabled = false;
    auth.textContent = "Sign out";
    setStatus("Signed in. You can analyze a reviewed thesis.");
  } else if (payload.type === "signed-out") {
    signingIn = false;
    auth.disabled = false;
    auth.textContent = "Sign in";
    setStatus("Signed out.");
  } else if (payload.type === "event" && payload.event) {
    thesis = reduceThesis(thesis, payload.event as never);
    render();
  } else if (payload.type === "completed") {
    analyze.disabled = false;
    setStatus("Investigation complete.");
  } else if (payload.type === "error") {
    if (signingIn) {
      signingIn = false;
      auth.disabled = false;
      auth.textContent = "Sign in";
    }
    analyze.disabled = false;
    setStatus(payload.message ?? "Request failed.");
  }
});

browser.storage.session.onChanged.addListener((changes) => {
  if (changes.draft) renderDraft(changes.draft.newValue);
  if (changes.growwContext || changes.contextMessage) {
    renderCompanyContext(changes.growwContext?.newValue ?? changes.contextMessage?.newValue ?? null);
  }
});

auth.addEventListener("click", () => {
  if (auth.textContent === "Sign out") {
    port.postMessage({ type: "logout" });
    return;
  }
  signingIn = true;
  auth.disabled = true;
  auth.textContent = "Signing in…";
  setStatus("Finish signing in in the secure browser window.");
  port.postMessage({ type: "login" });
});

analyze.addEventListener("click", () => {
  thesis = initialThesisState();
  results.replaceChildren();
  analyze.disabled = true;
  setStatus("Analyzing the reviewed query…");
  port.postMessage({ type: "run", query: query.value });
});

port.postMessage({ type: "draft" });
port.postMessage({ type: "context" });
