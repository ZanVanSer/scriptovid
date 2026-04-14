import { VISUAL_STYLE_PRESETS, type VisualStylePresetId } from "@/modules/image-generation/prompt-builder";
import { NANOBANANA_MODELS, type NanobananaModel } from "@/modules/image-generation/nanobanana";

import type { WizardState, WizardActions } from "./types";
import styles from "@/app/page.module.css";

interface StepSceneReviewProps {
  state: WizardState;
  actions: WizardActions;
  onNext: () => void;
  onBack: () => void;
}

export function StepSceneReview({ state, actions, onNext, onBack }: StepSceneReviewProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.sectionRow}>
        <p className={styles.sectionTitle}>Scene setup</p>
      </div>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>Sentences: {state.result?.sentenceCount ?? 0}</div>
        <div className={styles.summaryItem}>Words: {state.result?.totalWordCount ?? 0}</div>
        <div className={styles.summaryItem}>
          Narration estimate: {state.result?.totalEstimatedDurationSeconds?.toFixed(1) ?? "0"}s
        </div>
        <div className={styles.summaryItem}>Timing baseline: 150 WPM</div>
      </div>
      <div className={styles.modeControls}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Image source mode</span>
          <select
            className={styles.selectInput}
            value={state.imageSourceMode}
            onChange={(event) => {
              actions.setImageSourceMode(event.target.value as "manual" | "nanobanana");
              actions.setActiveDropSceneIndex(null);
            }}
          >
            <option value="manual">Manual upload</option>
            <option value="nanobanana">Nanobanana API</option>
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Visual style preset</span>
          <select
            className={styles.selectInput}
            value={state.selectedVisualStyle}
            onChange={(event) => actions.setSelectedVisualStyle(event.target.value as VisualStylePresetId)}
          >
            {VISUAL_STYLE_PRESETS.map((stylePreset) => (
              <option key={stylePreset.id} value={stylePreset.id}>
                {stylePreset.label}
              </option>
            ))}
          </select>
        </label>
        {state.imageSourceMode === "nanobanana" ? (
          <>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Nanobanana model</span>
              <select
                className={styles.selectInput}
                value={state.nanobananaModel}
                onChange={(event) => actions.setNanobananaModel(event.target.value as NanobananaModel)}
              >
                {NANOBANANA_MODELS.map((modelOption) => (
                  <option key={modelOption} value={modelOption}>
                    {modelOption}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Local API key override (optional)</span>
              <input
                type="password"
                className={styles.numberInput}
                value={state.nanobananaApiKeyOverride}
                onChange={(event) => actions.setNanobananaApiKeyOverride(event.target.value)}
                placeholder="Uses server GEMINI_API_KEY if empty"
              />
            </label>
          </>
        ) : null}
      </div>
      <div className={styles.controlsGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Min scene duration (s)</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            className={styles.numberInput}
            value={state.minSceneDurationSeconds}
            onChange={(event) => actions.setMinSceneDurationSeconds(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Max scene duration (s)</span>
          <input
            type="number"
            min="0.1"
            step="0.1"
            className={styles.numberInput}
            value={state.maxSceneDurationSeconds}
            onChange={(event) => actions.setMaxSceneDurationSeconds(event.target.value)}
          />
        </label>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={actions.handlePackScenes}
          disabled={!state.result || state.result.sentences.length === 0}
        >
          Build storyboard scenes
        </button>
        {state.scenePackResult && (
          <button type="button" className={styles.buttonPrimary} onClick={onNext}>
            Next: Storyboard
          </button>
        )}
      </div>
      {state.scenePackError ? <p className={styles.error}>{state.scenePackError}</p> : null}
    </section>
  );
}
