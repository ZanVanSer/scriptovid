import type { WizardState } from "./types";
import styles from "@/app/page.module.css";

interface TechnicalDetailsProps {
  state: WizardState;
}

export function TechnicalDetails({ state }: TechnicalDetailsProps) {
  return (
    <section className={styles.panel}>
      <details className={styles.previewDetails}>
        <summary className={styles.previewSummary}>Technical details</summary>
        <div className={styles.debugStack}>
          <div>
            <span className={styles.label}>Split Warnings</span>
            {state.splitWarnings.length > 0 ? (
              <ul className={styles.warningList}>
                {state.splitWarnings.map((warning) => (
                  <li key={warning} className={styles.warningItem}>
                    {warning}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.info}>No split warnings detected.</p>
            )}
          </div>

          <details className={styles.subDetails}>
            <summary className={styles.subSummary}>Normalized Text</summary>
            <pre className={styles.preview}>
              {state.result?.normalizedText || "Run split to see normalized text."}
            </pre>
          </details>

          <details className={styles.subDetails}>
            <summary className={styles.subSummary}>Scene Metadata</summary>
            {state.scenePackResult && state.scenePackResult.scenes.length > 0 ? (
              <div className={styles.debugList}>
                {state.scenePackResult.scenes.map((scene) => (
                  <div key={scene.index} className={styles.debugItem}>
                    <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "8px", color: "var(--gray-900)" }}>
                      Scene {scene.index}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                      <span className={styles.listMeta}><strong>Words:</strong> {scene.totalWordCount}</span>
                      <span className={styles.listMeta}><strong>Sentences:</strong> {scene.sentenceCount}</span>
                      <span className={styles.listMeta}><strong>Duration:</strong> {scene.estimatedDurationSeconds.toFixed(1)}s</span>
                      <span className={styles.listMeta}><strong>Sentences:</strong> {scene.sentenceIndexRange}</span>
                      <span className={styles.listMeta}><strong>Paragraphs:</strong> {scene.paragraphIndexRange}</span>
                      <span className={styles.listMeta}><strong>Cross-boundary:</strong> {scene.crossesParagraphBoundary ? "Yes" : "No"}</span>
                    </div>
                    <div className={styles.listMeta} style={{ marginTop: "8px" }}>
                      <strong>Source:</strong> {scene.unitSourceTypeSummary}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.info}>No scene metadata generated yet.</p>
            )}
          </details>
        </div>
      </details>
    </section>
  );
}
