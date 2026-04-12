import { formatDurationClock, formatFileSize } from "@/types/api-responses";
import { DEFAULT_ELEVENLABS_MODEL_ID } from "@/types/api-responses";
import type { NarrationMode } from "@/types/narration";

import type { WizardState, WizardActions } from "./types";
import styles from "@/app/page.module.css";

interface StepNarrationProps {
  state: WizardState;
  actions: WizardActions;
}

export function StepNarration({ state, actions }: StepNarrationProps) {
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
        <p className={styles.sectionTitle}>4. Narration</p>
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
        <div className={styles.summaryItem}>Mode: {state.narration.mode}</div>
        <div className={styles.summaryItem}>Status: {state.narration.status}</div>
        <div className={styles.summaryItem}>Provider: {activeNarrationAsset?.provider || "—"}</div>
        <div className={styles.summaryItem}>
          Duration:{" "}
          {typeof activeNarrationAsset?.duration === "number"
            ? formatDurationClock(activeNarrationAsset.duration)
            : "—"}
        </div>
        <div className={styles.summaryItem}>Ready for render: {isNarrationReady ? "Yes" : "No"}</div>
      </div>
      {typeof durationDeltaSeconds === "number" ? (
        <p className={styles.info}>
          Script estimate vs narration: {durationDeltaSeconds >= 0 ? "+" : ""}
          {durationDeltaSeconds.toFixed(1)}s
        </p>
      ) : null}
      {state.narration.mode === "manual" ? (
        <>
          <div
            className={`${styles.narrationDropzone} ${
              state.isNarrationDropActive ? styles.narrationDropzoneActive : ""
            }`}
            onClick={actions.openNarrationFilePicker}
            onDragEnter={(event) => {
              event.preventDefault();
              actions.setIsNarrationDropActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              actions.setIsNarrationDropActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              actions.setIsNarrationDropActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              actions.setIsNarrationDropActive(false);
              const file = event.dataTransfer.files.item(0);
              if (file) {
                void actions.applyManualNarrationFile(file);
              }
            }}
          >
            <p className={styles.placeholderText}>
              {activeNarrationAsset?.audioUrl
                ? "Drop to replace narration audio"
                : "Drop narration audio file here"}
            </p>
          </div>
          <input
            id="narration-upload"
            type="file"
            accept=".mp3,.wav,.m4a,.aac,.ogg,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg"
            className={styles.fileInput}
            onChange={(event) => {
              const file = event.target.files?.item(0);
              if (file) {
                void actions.applyManualNarrationFile(file);
              }
              event.target.value = "";
            }}
          />
          <div className={styles.actions}>
            <button type="button" className={styles.smallButton} onClick={actions.openNarrationFilePicker}>
              {activeNarrationAsset?.audioUrl ? "Replace narration" : "Upload narration"}
            </button>
            {activeNarrationAsset?.audioUrl ? (
              <button type="button" className={styles.smallButton} onClick={actions.clearNarrationAsset}>
                Remove narration
              </button>
            ) : null}
          </div>
          {activeNarrationAsset?.audioUrl ? (
            <audio className={styles.narrationPlayer} controls src={activeNarrationAsset.audioUrl} />
          ) : null}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>File: {activeNarrationAsset?.fileName || "—"}</div>
            <div className={styles.summaryItem}>MIME: {activeNarrationAsset?.mimeType || "—"}</div>
            <div className={styles.summaryItem}>
              Size:{" "}
              {typeof activeNarrationAsset?.fileSize === "number"
                ? formatFileSize(activeNarrationAsset.fileSize)
                : "—"}
            </div>
            <div className={styles.summaryItem}>
              Duration:{" "}
              {typeof activeNarrationAsset?.duration === "number"
                ? formatDurationClock(activeNarrationAsset.duration)
                : "—"}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className={styles.controlsGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Voice ID</span>
              <select
                className={styles.selectInput}
                value={state.narration.elevenLabs.voiceId || ""}
                onChange={(event) => actions.updateElevenLabsSettings("voiceId", event.target.value)}
                disabled={state.isLoadingElevenLabsOptions || state.elevenLabsVoices.length === 0}
              >
                <option value="">
                  {state.isLoadingElevenLabsOptions ? "Loading voices..." : "Select voice"}
                </option>
                {state.elevenLabsVoices.map((voiceOption) => (
                  <option key={voiceOption.id} value={voiceOption.id}>
                    {voiceOption.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Model ID</span>
              <select
                className={styles.selectInput}
                value={state.narration.elevenLabs.modelId || ""}
                onChange={(event) => actions.updateElevenLabsSettings("modelId", event.target.value)}
                disabled={state.isLoadingElevenLabsOptions || state.elevenLabsModels.length === 0}
              >
                <option value="">
                  {state.isLoadingElevenLabsOptions ? "Loading models..." : "Select model"}
                </option>
                {state.elevenLabsModels.map((modelOption) => (
                  <option key={modelOption.id} value={modelOption.id}>
                    {modelOption.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.smallButton}
              onClick={() => {
                void actions.loadElevenLabsOptions();
              }}
              disabled={state.isLoadingElevenLabsOptions}
            >
              {state.isLoadingElevenLabsOptions ? "Refreshing..." : "Refresh voices/models"}
            </button>
            <p className={styles.modeNote}>Options are loaded from your ElevenLabs account tier.</p>
          </div>
          {state.elevenLabsOptionsError ? <p className={styles.error}>{state.elevenLabsOptionsError}</p> : null}
          <details className={styles.subDetails}>
            <summary className={styles.subSummary}>Advanced voice settings</summary>
            <div className={styles.controlsGrid}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Stability (0-1)</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  className={styles.numberInput}
                  value={state.narration.elevenLabs.stability}
                  onChange={(event) =>
                    actions.updateElevenLabsSettings("stability", Number(event.target.value))
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Similarity boost (0-1)</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  className={styles.numberInput}
                  value={state.narration.elevenLabs.similarityBoost}
                  onChange={(event) =>
                    actions.updateElevenLabsSettings("similarityBoost", Number(event.target.value))
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Style (0-1)</span>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  className={styles.numberInput}
                  value={state.narration.elevenLabs.style}
                  onChange={(event) =>
                    actions.updateElevenLabsSettings("style", Number(event.target.value))
                  }
                />
              </label>
              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={state.narration.elevenLabs.useSpeakerBoost}
                  onChange={(event) =>
                    actions.updateElevenLabsSettings("useSpeakerBoost", event.target.checked)
                  }
                />
                <span className={styles.fieldLabel}>Use speaker boost</span>
              </label>
            </div>
          </details>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.buttonPrimary}
              disabled={state.narration.status === "loading"}
              onClick={() => {
                void actions.generateElevenLabsNarration();
              }}
            >
              {activeNarrationAsset?.provider === "elevenlabs" && activeNarrationAsset.audioUrl
                ? state.narration.status === "loading"
                  ? "Regenerating..."
                  : "Regenerate narration"
                : state.narration.status === "loading"
                  ? "Generating..."
                  : "Generate narration"}
            </button>
            {activeNarrationAsset?.audioUrl ? (
              <button type="button" className={styles.button} onClick={actions.clearNarrationAsset}>
                Remove narration
              </button>
            ) : null}
          </div>
          {activeNarrationAsset?.audioUrl ? (
            <audio className={styles.narrationPlayer} controls src={activeNarrationAsset.audioUrl} />
          ) : (
            <div className={styles.emptyState}>Generate narration from the full script to preview audio.</div>
          )}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>File: {activeNarrationAsset?.fileName || "—"}</div>
            <div className={styles.summaryItem}>MIME: {activeNarrationAsset?.mimeType || "—"}</div>
            <div className={styles.summaryItem}>
              Size:{" "}
              {typeof activeNarrationAsset?.fileSize === "number"
                ? formatFileSize(activeNarrationAsset.fileSize)
                : "—"}
            </div>
            <div className={styles.summaryItem}>
              Duration:{" "}
              {typeof activeNarrationAsset?.duration === "number"
                ? formatDurationClock(activeNarrationAsset.duration)
                : "—"}
            </div>
            <div className={styles.summaryItem}>Provider: {activeNarrationAsset?.provider || "—"}</div>
            <div className={styles.summaryItem}>
              Voice ID: {activeNarrationAsset?.voiceId || state.narration.elevenLabs.voiceId || "—"}
            </div>
            <div className={styles.summaryItem}>
              Model ID: {activeNarrationAsset?.modelId || state.narration.elevenLabs.modelId || "—"}
            </div>
          </div>
        </>
      )}
      {state.narration.status === "loading" ? (
        <p className={styles.info}>
          {state.narration.mode === "elevenlabs" ? "Generating narration..." : "Reading audio metadata..."}
        </p>
      ) : null}
      {activeNarrationAsset?.audioUrl &&
      activeNarrationAsset.duration === undefined &&
      state.narration.status === "done" ? (
        <p className={styles.info}>Duration metadata is unavailable for this file.</p>
      ) : null}
      {state.narration.error ? (
        <p className={styles.error}>Error: {state.narration.error}</p>
      ) : null}
      <div className={styles.subSection}>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={state.music.enabled}
            onChange={(event) => {
              actions.setMusic((current) => ({
                ...current,
                enabled: event.target.checked,
              }));
            }}
          />
          <span className={styles.fieldLabel}>Enable Background Music</span>
        </label>
        {state.music.enabled ? (
          <div className={styles.subSectionBody}>
            <input
              id="music-upload"
              type="file"
              accept=".mp3,.wav,.m4a,.aac,.ogg,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg"
              className={styles.fileInput}
              onChange={(event) => {
                const file = event.target.files?.item(0);
                if (file) {
                  void actions.applyMusicFile(file);
                }
                event.target.value = "";
              }}
            />
            <div className={styles.actions}>
              <button type="button" className={styles.smallButton} onClick={actions.openMusicFilePicker}>
                {state.music.audioUrl ? "Replace music" : "Upload music"}
              </button>
              {state.music.audioUrl ? (
                <button type="button" className={styles.smallButton} onClick={actions.clearMusicFile}>
                  Remove music
                </button>
              ) : null}
            </div>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>File: {state.music.fileName || "—"}</div>
              <div className={styles.summaryItem}>
                Duration: {typeof state.music.duration === "number" ? formatDurationClock(state.music.duration) : "—"}
              </div>
              <div className={styles.summaryItem}>Loop: {state.music.loop ? "On" : "Off"}</div>
              <div className={styles.summaryItem}>Volume: {state.music.volume}%</div>
            </div>
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={state.music.loop}
                onChange={(event) => {
                  actions.setMusic((current) => ({
                    ...current,
                    loop: event.target.checked,
                  }));
                }}
              />
              <span className={styles.fieldLabel}>Loop music if shorter than video</span>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Music Volume</span>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={state.music.volume}
                className={styles.rangeInput}
                onChange={(event) => {
                  const nextVolume = Number(event.target.value);
                  actions.setMusic((current) => ({
                    ...current,
                    volume: Number.isFinite(nextVolume)
                      ? Math.min(100, Math.max(0, Math.round(nextVolume)))
                      : 25,
                  }));
                }}
              />
            </label>
            {state.music.audioUrl ? <audio className={styles.narrationPlayer} controls src={state.music.audioUrl} /> : null}
            {!state.music.audioUrl && !state.isMusicUploading ? (
              <div className={styles.emptyState}>Upload a background music file to include with narration.</div>
            ) : null}
            {state.isMusicUploading ? <p className={styles.info}>Reading audio metadata...</p> : null}
            {state.music.audioUrl && state.music.duration === null && !state.isMusicUploading ? (
              <p className={styles.info}>Duration metadata is unavailable for this file.</p>
            ) : null}
            {state.musicError ? <p className={styles.error}>Error: {state.musicError}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}