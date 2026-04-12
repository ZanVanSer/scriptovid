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
          {state.splitWarnings.length > 0 ? (
            <ul className={styles.warningList}>
              {state.splitWarnings.map((warning) => (
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
              {state.result?.normalizedText || "Run split to see normalized text."}
            </pre>
          </details>

          <details className={styles.subDetails}>
            <summary className={styles.subSummary}>Scene metadata</summary>
            {state.scenePackResult && state.scenePackResult.scenes.length > 0 ? (
              <ol className={styles.debugList}>
                {state.scenePackResult.scenes.map((scene) => (
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
  );
}