"use client";

import { useState } from "react";

import { DEFAULT_WORDS_PER_MINUTE } from "@/modules/scene-splitter/constants";
import { toPackableTimedUnits } from "@/modules/scene-splitter/fallback-splitter";
import { detectSplitWarnings, validateScriptInput } from "@/modules/scene-splitter/input-quality";
import {
  DEFAULT_MAX_SCENE_DURATION_SECONDS,
  DEFAULT_MIN_SCENE_DURATION_SECONDS,
  packSentencesIntoScenes,
} from "@/modules/scene-splitter/scene-packer";
import { SAMPLE_SCRIPT } from "@/modules/scene-splitter/sample-script";
import type { ScenePackResult } from "@/types/scene";
import type { SentenceSplitResponse } from "@/types/sentence";

import styles from "./page.module.css";

function formatSeconds(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

export default function Home() {
  const [scriptText, setScriptText] = useState("");
  const [result, setResult] = useState<SentenceSplitResponse | null>(null);
  const [scenePackResult, setScenePackResult] = useState<ScenePackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputFeedback, setInputFeedback] = useState<string | null>(null);
  const [splitWarnings, setSplitWarnings] = useState<string[]>([]);
  const [scenePackError, setScenePackError] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [minSceneDurationSeconds, setMinSceneDurationSeconds] = useState(
    String(DEFAULT_MIN_SCENE_DURATION_SECONDS),
  );
  const [maxSceneDurationSeconds, setMaxSceneDurationSeconds] = useState(
    String(DEFAULT_MAX_SCENE_DURATION_SECONDS),
  );

  async function handleSplit() {
    setIsSplitting(true);
    setError(null);
    setInputFeedback(null);

    const validation = validateScriptInput(scriptText);

    if (validation.blockingError) {
      setInputFeedback(validation.blockingError);
      setIsSplitting(false);
      return;
    }

    try {
      const response = await fetch("/api/sentence-split", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: scriptText }),
      });

      if (!response.ok) {
        throw new Error("Split request failed.");
      }

      const data = (await response.json()) as SentenceSplitResponse;
      const warnings = detectSplitWarnings(data.normalizedText);

      setResult(data);
      setScenePackResult(null);
      setScenePackError(null);
      setSplitWarnings(warnings);
      setInputFeedback(validation.advisory);
    } catch {
      setError("Unable to split text right now. Please try again.");
    } finally {
      setIsSplitting(false);
    }
  }

  function handleLoadSample() {
    setScriptText(SAMPLE_SCRIPT);
    setResult(null);
    setScenePackResult(null);
    setError(null);
    setInputFeedback(null);
    setSplitWarnings([]);
    setScenePackError(null);
  }

  function handlePackScenes() {
    setScenePackError(null);

    if (!result || result.sentences.length === 0) {
      setScenePackError("Split text into sentences before packing scenes.");
      setScenePackResult(null);
      return;
    }

    const min = Number(minSceneDurationSeconds);
    const max = Number(maxSceneDurationSeconds);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
      setScenePackError("Scene durations must be numbers greater than 0.");
      setScenePackResult(null);
      return;
    }

    if (min > max) {
      setScenePackError("Minimum scene duration cannot be greater than maximum.");
      setScenePackResult(null);
      return;
    }

    const timedUnits = toPackableTimedUnits(result.sentences, max, DEFAULT_WORDS_PER_MINUTE);
    const packed = packSentencesIntoScenes(timedUnits, {
      minSceneDurationSeconds: min,
      maxSceneDurationSeconds: max,
    });

    setScenePackResult(packed);
  }

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>1. Script input</p>
          </div>
          <label htmlFor="script-input" className={styles.label}>
            Paste script
          </label>
          <textarea
            id="script-input"
            className={styles.textarea}
            value={scriptText}
            onChange={(event) => setScriptText(event.target.value)}
            placeholder="Paste script text here..."
          />

          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={handleLoadSample}>
              Load sample text
            </button>
            <button
              type="button"
              className={styles.buttonPrimary}
              onClick={handleSplit}
              disabled={isSplitting}
            >
              {isSplitting ? "Splitting..." : "Split script"}
            </button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {inputFeedback ? <p className={styles.info}>{inputFeedback}</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>2. Scene review setup</p>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>Sentences: {result?.sentenceCount ?? 0}</div>
            <div className={styles.summaryItem}>Words: {result?.totalWordCount ?? 0}</div>
            <div className={styles.summaryItem}>
              Narration estimate: {formatSeconds(result?.totalEstimatedDurationSeconds ?? 0)}
            </div>
            <div className={styles.summaryItem}>Timing baseline: {DEFAULT_WORDS_PER_MINUTE} WPM</div>
          </div>
          <div className={styles.controlsGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Min scene duration (s)</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className={styles.numberInput}
                value={minSceneDurationSeconds}
                onChange={(event) => setMinSceneDurationSeconds(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Max scene duration (s)</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className={styles.numberInput}
                value={maxSceneDurationSeconds}
                onChange={(event) => setMaxSceneDurationSeconds(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.buttonPrimary}
              onClick={handlePackScenes}
              disabled={!result || result.sentences.length === 0}
            >
              Build storyboard scenes
            </button>
          </div>
          {scenePackError ? <p className={styles.error}>{scenePackError}</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>3. Storyboard review</p>
            <span className={styles.count}>Scenes: {scenePackResult?.totalSceneCount ?? 0}</span>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              Total scene duration:{" "}
              {formatSeconds(scenePackResult?.totalEstimatedDurationSeconds ?? 0)}
            </div>
          </div>
          {scenePackResult && scenePackResult.scenes.length > 0 ? (
            <ol className={styles.storyboardStrip}>
              {scenePackResult.scenes.map((scene) => (
                <li key={scene.index} className={styles.storyboardCard}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>Scene {scene.index}</p>
                    <p className={styles.cardMeta}>{formatSeconds(scene.estimatedDurationSeconds)}</p>
                  </div>
                  <div className={styles.imagePlaceholder}>Image placeholder</div>
                  <p className={styles.scenePreview}>{scene.text}</p>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.emptyState}>Split script and build scenes to review storyboard cards.</div>
          )}
        </section>

        <section className={styles.panel}>
          <details className={styles.previewDetails}>
            <summary className={styles.previewSummary}>Technical details</summary>
            <div className={styles.debugStack}>
              {splitWarnings.length > 0 ? (
                <ul className={styles.warningList}>
                  {splitWarnings.map((warning) => (
                    <li key={warning} className={styles.warningItem}>
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.info}>No split warnings.</p>
              )}

              <details className={styles.subDetails}>
                <summary className={styles.subSummary}>Normalized text preview</summary>
                <pre className={styles.preview}>
                  {result?.normalizedText || "Run split to see normalized text."}
                </pre>
              </details>

              <details className={styles.subDetails}>
                <summary className={styles.subSummary}>Scene metadata</summary>
                {scenePackResult && scenePackResult.scenes.length > 0 ? (
                  <ol className={styles.debugList}>
                    {scenePackResult.scenes.map((scene) => (
                      <li key={scene.index} className={styles.debugItem}>
                        <span className={styles.listMeta}>Scene {scene.index}</span>
                        <span className={styles.listMeta}>Words: {scene.totalWordCount}</span>
                        <span className={styles.listMeta}>Source units: {scene.sourceUnitCount}</span>
                        <span className={styles.listMeta}>Sentences: {scene.sentenceCount}</span>
                        <span className={styles.listMeta}>
                          Sentence indexes: {scene.sentenceIndexRange}
                        </span>
                        <span className={styles.listMeta}>Paragraph range: {scene.paragraphIndexRange}</span>
                        <span className={styles.listMeta}>
                          Crosses paragraph boundary: {scene.crossesParagraphBoundary ? "yes" : "no"}
                        </span>
                        <span className={styles.listMeta}>Unit sources: {scene.unitSourceTypeSummary}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.info}>No scene metadata yet.</p>
                )}
              </details>
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}
