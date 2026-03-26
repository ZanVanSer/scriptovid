"use client";

import { useMemo, useState } from "react";

import { DEFAULT_WORDS_PER_MINUTE } from "@/modules/scene-splitter/constants";
import { SAMPLE_SCRIPT } from "@/modules/scene-splitter/sample-script";
import type { SentenceSplitResponse } from "@/types/sentence";

import styles from "./page.module.css";

export default function Home() {
  const [scriptText, setScriptText] = useState("");
  const [result, setResult] = useState<SentenceSplitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);

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
    } catch {
      setError("Unable to split text right now. Please try again.");
    } finally {
      setIsSplitting(false);
    }
  }

  function handleLoadSample() {
    setScriptText(SAMPLE_SCRIPT);
    setResult(null);
    setError(null);
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
      </main>
    </div>
  );
}
