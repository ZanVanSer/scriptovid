"use client";

import { useMemo, useState } from "react";

import { DEFAULT_WORDS_PER_MINUTE } from "@/modules/scene-splitter/constants";
import { toPackableTimedUnits } from "@/modules/scene-splitter/fallback-splitter";
import {
  DEFAULT_MAX_SCENE_DURATION_SECONDS,
  DEFAULT_MIN_SCENE_DURATION_SECONDS,
  packSentencesIntoScenes,
} from "@/modules/scene-splitter/scene-packer";
import { SAMPLE_SCRIPT } from "@/modules/scene-splitter/sample-script";
import type { ScenePackResult } from "@/types/scene";
import type { SentenceSplitResponse } from "@/types/sentence";

import styles from "./page.module.css";

export default function Home() {
  const [scriptText, setScriptText] = useState("");
  const [result, setResult] = useState<SentenceSplitResponse | null>(null);
  const [scenePackResult, setScenePackResult] = useState<ScenePackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenePackError, setScenePackError] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [minSceneDurationSeconds, setMinSceneDurationSeconds] = useState(
    String(DEFAULT_MIN_SCENE_DURATION_SECONDS),
  );
  const [maxSceneDurationSeconds, setMaxSceneDurationSeconds] = useState(
    String(DEFAULT_MAX_SCENE_DURATION_SECONDS),
  );

  const hasInput = useMemo(() => scriptText.trim().length > 0, [scriptText]);

  async function handleSplit() {
    setIsSplitting(true);
    setError(null);

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
      setResult(data);
      setScenePackResult(null);
      setScenePackError(null);
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
          <label htmlFor="script-input" className={styles.label}>
            Script Input
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
              disabled={isSplitting || !hasInput}
            >
              {isSplitting ? "Splitting..." : "Split into sentences"}
            </button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </section>

        <section className={styles.panel}>
          <details className={styles.previewDetails}>
            <summary className={styles.previewSummary}>Normalized Text Preview</summary>
            <pre className={styles.preview}>
              {result?.normalizedText || "Run split to see normalized text."}
            </pre>
          </details>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <h2 className={styles.sectionTitle}>Sentences</h2>
            <span className={styles.count}>Total sentences: {result?.sentenceCount ?? 0}</span>
          </div>
          <p className={styles.note}>
            Duration estimate uses {DEFAULT_WORDS_PER_MINUTE} WPM.
          </p>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>Total words: {result?.totalWordCount ?? 0}</div>
            <div className={styles.summaryItem}>
              Total duration: {(result?.totalEstimatedDurationSeconds ?? 0).toFixed(1)}s
            </div>
          </div>

          <ol className={styles.list}>
            {(result?.sentences ?? []).map((sentence) => (
              <li key={sentence.index} className={styles.listItem}>
                <div className={styles.listMeta}>#{sentence.index}</div>
                <p className={styles.sentenceText}>{sentence.text}</p>
                <div className={styles.listMeta}>Words: {sentence.wordCount}</div>
                <div className={styles.listMeta}>
                  Duration: {sentence.estimatedDurationSeconds.toFixed(1)}s
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <h2 className={styles.sectionTitle}>Scene Packer</h2>
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
              Pack sentences into scenes
            </button>
          </div>
          {scenePackError ? <p className={styles.error}>{scenePackError}</p> : null}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              Total scenes: {scenePackResult?.totalSceneCount ?? 0}
            </div>
            <div className={styles.summaryItem}>
              Total scene duration: {(scenePackResult?.totalEstimatedDurationSeconds ?? 0).toFixed(1)}
              s
            </div>
          </div>
          <ol className={styles.sceneList}>
            {(scenePackResult?.scenes ?? []).map((scene) => (
              <li key={scene.index} className={styles.listItem}>
                <div className={styles.listMeta}>Scene {scene.index}</div>
                <p className={styles.sentenceText}>{scene.text}</p>
                <div className={styles.listMeta}>Duration: {scene.estimatedDurationSeconds.toFixed(1)}s</div>
                <div className={styles.listMeta}>Words: {scene.totalWordCount}</div>
                <div className={styles.listMeta}>Sentences: {scene.sentenceCount}</div>
                <div className={styles.listMeta}>Sentence indexes: {scene.sentenceIndexRange}</div>
                <div className={styles.listMeta}>Paragraph range: {scene.paragraphIndexRange}</div>
                <div className={styles.listMeta}>
                  Crosses paragraph boundary: {scene.crossesParagraphBoundary ? "yes" : "no"}
                </div>
                <div className={styles.listMeta}>Unit sources: {scene.unitSourceTypes.join(", ")}</div>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
