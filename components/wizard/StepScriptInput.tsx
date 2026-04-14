import type { WizardState, WizardActions } from "./types";
import styles from "@/app/page.module.css";

interface StepScriptInputProps {
  state: WizardState;
  actions: WizardActions;
  onNext: () => void;
}

export function StepScriptInput({ state, actions, onNext }: StepScriptInputProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.sectionRow}>
        <p className={styles.sectionTitle}>Script input</p>
      </div>
      <div>
        <label htmlFor="script-input" className={styles.label}>
          Paste script
        </label>
        <textarea
          id="script-input"
          className={styles.textarea}
          value={state.scriptText}
          onChange={(event) => actions.setScriptText(event.target.value)}
          placeholder="Paste script text here..."
        />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={actions.handleLoadSample}>
          Load sample text
        </button>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={actions.handleSplit}
          disabled={state.isSplitting}
        >
          {state.isSplitting ? "Splitting..." : "Split script"}
        </button>
        {state.result && (
          <button type="button" className={styles.buttonPrimary} onClick={onNext}>
            Next: Scene Setup
          </button>
        )}
      </div>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.inputFeedback ? <p className={styles.info}>{state.inputFeedback}</p> : null}
    </section>
  );
}