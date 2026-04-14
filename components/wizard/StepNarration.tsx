import { formatDurationClock, formatFileSize } from "@/types/api-responses";
import { DEFAULT_ELEVENLABS_MODEL_ID } from "@/types/api-responses";
import type { NarrationMode } from "@/types/narration";

import type { WizardState, WizardActions } from "./types";
import styles from "@/app/page.module.css";

interface StepNarrationProps {
  state: WizardState;
  actions: WizardActions;
  onNext: () => void;
  onBack: () => void;
}

export function StepNarration({ state, actions, onNext, onBack }: StepNarrationProps) {
  const activeNarrationAsset = state.narration.asset;
  const isNarrationReady = state.narration.status === "done" && activeNarrationAsset?.audioUrl;
  
  const durationDeltaSeconds =
    typeof activeNarrationAsset?.duration === "number" &&
    typeof state.result?.totalEstimatedDurationSeconds === "number"
      ? activeNarrationAsset.duration - state.result.totalEstimatedDurationSeconds
      : undefined;

  return (
    <section className={styles.panel}>
      <div className={styles.sectionRow}>
        <p className={styles.sectionTitle}>Narration</p>
      </div>
      
      <div className={styles.modeControls}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Narration mode</span>
          <select
            className={styles.selectInput}
            value={state.narration.mode}
            onChange={(event) => {
              const nextMode = event.target.value as NarrationMode;
              actions.setNarration((current) => ({
                ...current,
                mode: nextMode,
                error: undefined,
                elevenLabs: {
                  ...current.elevenLabs,
                  modelId: current.elevenLabs.modelId || DEFAULT_ELEVENLABS_MODEL_ID,
                },
              }));
            }}
          >
            <option value="manual">Manual upload</option>
            <option value="elevenlabs">ElevenLabs</option>
          </select>
        </label>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>Status: {state.narration.status}</div>
        <div className={styles.summaryItem}>
          Duration: {typeof activeNarrationAsset?.duration === "number" ? formatDurationClock(activeNarrationAsset.duration) : "—"}
        </div>
        {typeof durationDeltaSeconds === "number" && (
          <div className={styles.summaryItem}>
            Delta: {durationDeltaSeconds >= 0 ? "+" : ""}{durationDeltaSeconds.toFixed(1)}s
          </div>
        )}
      </div>

      {state.narration.mode === "manual" ? (
        <div className={styles.field}>
          <div
            className={`${styles.imagePlaceholder} ${styles.imagePlaceholderClickable} ${
              state.isNarrationDropActive ? styles.imagePlaceholderActive : ""
            }`}
            style={{ height: "100px", aspectRatio: "auto" }}
            onClick={actions.openNarrationFilePicker}
            onDragEnter={(e) => { e.preventDefault(); actions.setIsNarrationDropActive(true); }}
            onDragOver={(e) => { e.preventDefault(); actions.setIsNarrationDropActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); actions.setIsNarrationDropActive(false); }}
            onDrop={(e) => {
              e.preventDefault();
              actions.setIsNarrationDropActive(false);
              const file = e.dataTransfer.files.item(0);
              if (file) void actions.applyManualNarrationFile(file);
            }}
          >
            <p className={styles.placeholderText}>
              {activeNarrationAsset?.audioUrl ? "Click or drop to replace audio" : "Click or drop narration audio"}
            </p>
          </div>
          <input
            id="narration-upload"
            type="file"
            accept=".mp3,.wav,.m4a,.aac,.ogg,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg"
            className={styles.fileInput}
            onChange={(e) => {
              const file = e.target.files?.item(0);
              if (file) void actions.applyManualNarrationFile(file);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className={styles.modeControls}>
          <div className={styles.controlsGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Voice ID</span>
              <select
                className={styles.selectInput}
                value={state.narration.elevenLabs.voiceId || ""}
                onChange={(e) => actions.updateElevenLabsSettings("voiceId", e.target.value)}
                disabled={state.isLoadingElevenLabsOptions}
              >
                <option value="">{state.isLoadingElevenLabsOptions ? "Loading..." : "Select voice"}</option>
                {state.elevenLabsVoices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Model ID</span>
              <select
                className={styles.selectInput}
                value={state.narration.elevenLabs.modelId || ""}
                onChange={(e) => actions.updateElevenLabsSettings("modelId", e.target.value)}
                disabled={state.isLoadingElevenLabsOptions}
              >
                {state.elevenLabsModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className={styles.smallButton} onClick={() => void actions.loadElevenLabsOptions()}>
            Refresh Options
          </button>
        </div>
      )}

      {activeNarrationAsset?.audioUrl && (
        <audio className={styles.narrationPlayer} controls src={activeNarrationAsset.audioUrl} />
      )}

      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onBack}>Back</button>
        {state.narration.mode === "elevenlabs" && (
          <button
            type="button"
            className={styles.buttonPrimary}
            disabled={state.narration.status === "loading"}
            onClick={() => void actions.generateElevenLabsNarration()}
          >
            {state.narration.status === "loading" ? "Generating..." : "Generate Narration"}
          </button>
        )}
        <button type="button" className={styles.buttonPrimary} onClick={onNext} disabled={!isNarrationReady}>
          Next: Render
        </button>
      </div>

      {state.narration.error && <p className={styles.error}>{state.narration.error}</p>}
    </section>
  );
}
