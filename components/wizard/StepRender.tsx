import { MOTION_PRESETS } from "@/lib/motion/motionPresets";
import { CINEMATIC_TRANSITION_OPTIONS, TRANSITION_DURATION_OPTIONS_MS } from "@/lib/render/transition-types";
import { buildRenderProject } from "@/modules/video-renderer/render-project";
import { formatDurationClock, formatFileSize, normalizeSceneDurationOverrideSeconds } from "@/types/api-responses";

import type { WizardState, WizardActions } from "./types";
import styles from "@/app/page.module.css";

interface StepRenderProps {
  state: WizardState;
  actions: WizardActions;
}

export function StepRender({ state, actions }: StepRenderProps) {
  const sceneDurationOverrides = Object.entries(state.sceneDurationOverrideInputs).reduce<Record<number, number>>((acc, [key, value]) => {
    if (!value || !value.trim()) return acc;
    const parsed = Number(value);
    const normalized = normalizeSceneDurationOverrideSeconds(parsed);
    if (normalized !== undefined) {
      acc[Number(key)] = normalized;
    }
    return acc;
  }, {});

  const renderProject = buildRenderProject({
    scenePackResult: state.scenePackResult,
    sceneImages: state.sceneImages,
    sceneDurationOverrides,
    narration: state.narration,
    music: state.music,
    settings: {
      transitions: {
        enabled: state.transitionsEnabled,
        presetPool: state.allowedTransitionPresetIds,
        durationMs: state.transitionDurationMs,
      },
    },
    motionSettings: {
      enabled: state.motionEnabled,
      allowedPresetIds: state.allowedMotionPresetIds,
      assignmentMode: "deterministic-by-scene-index",
      strength: state.motionStrength,
    },
  });

  const assignedMotionCount = renderProject.scenes.filter((scene) => scene.motionPreset).length;
  const sceneOverrideCount = Object.keys(state.sceneDurationOverrideInputs).length;

  return (
    <section className={styles.panel}>
      <div className={styles.sectionRow}>
        <p className={styles.sectionTitle}>5. Render / Export</p>
      </div>
      <div className={styles.motionSection}>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={state.transitionsEnabled}
            onChange={(event) => actions.setTransitionsEnabled(event.target.checked)}
          />
          <span className={styles.fieldLabel}>Enable Transitions</span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Transition Duration</span>
          <select
            className={styles.selectInput}
            value={state.transitionDurationMs}
            disabled={!state.transitionsEnabled}
            onChange={(event) => actions.setTransitionDurationMs(Number(event.target.value))}
          >
            {TRANSITION_DURATION_OPTIONS_MS.map((durationMs) => (
              <option key={durationMs} value={durationMs}>
                {durationMs} ms
              </option>
            ))}
          </select>
        </label>
        <div className={styles.motionPresetGrid}>
          {CINEMATIC_TRANSITION_OPTIONS.map((preset) => (
            <label key={preset.value} className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={state.allowedTransitionPresetIds.includes(preset.value)}
                disabled={!state.transitionsEnabled}
                onChange={() => actions.toggleAllowedTransitionPreset(preset.value)}
              />
              <span className={styles.fieldLabel}>{preset.label}</span>
            </label>
          ))}
        </div>
        <p className={styles.info}>
          Allowed transitions:{" "}
          {state.transitionsEnabled
            ? `${state.allowedTransitionPresetIds.length || 1} preset${state.allowedTransitionPresetIds.length === 1 ? "" : "s"}`
            : "disabled (cuts only)"}
        </p>
        <label className={styles.checkboxField}>
          <input
            type="checkbox"
            checked={state.motionEnabled}
            onChange={(event) => actions.setMotionEnabled(event.target.checked)}
          />
          <span className={styles.fieldLabel}>Enable motion effects</span>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Motion Strength</span>
          <select
            className={styles.selectInput}
            value={state.motionStrength}
            disabled={!state.motionEnabled}
            onChange={(event) => {
              const nextValue = event.target.value;
              if (nextValue === "weak" || nextValue === "strong") {
                actions.setMotionStrength(nextValue);
                return;
              }
              actions.setMotionStrength("medium");
            }}
          >
            <option value="weak">Weak</option>
            <option value="medium">Medium</option>
            <option value="strong">Strong</option>
          </select>
        </label>
        <div className={styles.motionPresetGrid}>
          {MOTION_PRESETS.map((preset) => (
            <label key={preset.id} className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={state.allowedMotionPresetIds.includes(preset.id)}
                disabled={!state.motionEnabled}
                onChange={() => actions.toggleAllowedMotionPreset(preset.id)}
              />
              <span className={styles.fieldLabel}>{preset.name}</span>
            </label>
          ))}
        </div>
        <p className={styles.info}>
          Assigned presets: {assignedMotionCount}/{renderProject.scenes.length}
        </p>
      </div>
      <div className={styles.renderSummary}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>Scenes: {renderProject.scenes.length}</div>
          <div className={styles.summaryItem}>
            Estimated Duration: {formatDurationClock(renderProject.totalEstimatedSceneDuration)}
          </div>
          <div className={styles.summaryItem}>
            Final Duration: {formatDurationClock(renderProject.totalFinalSceneDuration)}
          </div>
          <div className={styles.summaryItem}>
            Narration Duration:{" "}
            {typeof renderProject.narrationDuration === "number"
              ? formatDurationClock(renderProject.narrationDuration)
              : "—"}
          </div>
          <div className={styles.summaryItem}>Timing Strategy: {renderProject.timingStrategy}</div>
          <div className={styles.summaryItem}>
            Transitions: {state.transitionsEnabled ? "enabled" : "disabled"} · {state.transitionDurationMs} ms
          </div>
          <div className={styles.summaryItem}>Duration Overrides: {sceneOverrideCount}</div>
          <div className={styles.summaryItem}>
            Scale Factor: {typeof renderProject.scaleFactor === "number" ? renderProject.scaleFactor.toFixed(3) : "—"}
          </div>
          <div className={styles.summaryItem}>Render Ready: {renderProject.isReady ? "Yes" : "No"}</div>
        </div>
        {renderProject.issues.length > 0 ? (
          <ul className={styles.renderIssueList}>
            {renderProject.issues.map((issue, issueIndex) => (
              <li
                key={`${issue.code}-${issueIndex}`}
                className={`${styles.renderIssueItem} ${
                  issue.level === "error" ? styles.renderIssueError : styles.renderIssueWarning
                }`}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.info}>No render validation issues.</p>
        )}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={actions.handlePreviewVideo}
          >
            Preview Video
          </button>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={() => {
              void actions.handleRenderVideo();
            }}
            disabled={!renderProject.isReady || state.renderStatus === "rendering"}
          >
            {state.renderStatus === "rendering" ? "Rendering video..." : "Render Video"}
          </button>
          <button
            type="button"
            className={styles.smallButton}
            onClick={() => {
              void actions.handleClearGeneratedFiles();
            }}
            disabled={state.isClearingGenerated || state.renderStatus === "rendering"}
          >
            {state.isClearingGenerated ? "Clearing..." : "Clear generated files"}
          </button>
        </div>
        {state.renderStatus === "rendering" ? (
          <div className={styles.renderProgress}>
            <span className={styles.spinner} aria-hidden="true" />
            <span className={styles.info}>Rendering video...</span>
          </div>
        ) : null}
        {state.renderStatus === "success" && state.renderResult ? (
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>File: {state.renderResult.fileName}</div>
            <div className={styles.summaryItem}>Size: {formatFileSize(state.renderResult.fileSize)}</div>
            <a className={styles.smallButton} href={state.renderResult.outputUrl} download={state.renderResult.fileName}>
              Download MP4
            </a>
          </div>
        ) : null}
        {state.renderStatus === "error" && state.renderError ? <p className={styles.error}>{state.renderError}</p> : null}
        {state.previewError ? <p className={styles.error}>{state.previewError}</p> : null}
        {state.clearGeneratedMessage ? <p className={styles.info}>{state.clearGeneratedMessage}</p> : null}
        {state.lastRenderMotionAssignments.length > 0 ? (
          <div className={styles.motionDebugList}>
            {state.lastRenderMotionAssignments.map((row) => (
              <div key={`motion-${row.order}`} className={styles.listMeta}>
                Scene {row.order}: {row.motionPreset}
              </div>
            ))}
          </div>
        ) : null}
        {state.lastRenderTransitionAssignments.length > 0 ? (
          <div className={styles.motionDebugList}>
            {state.lastRenderTransitionAssignments.map((row) => (
              <div key={`transition-${row.order}`} className={styles.listMeta}>
                Scene {row.order} → {row.order + 1}: {row.transitionType} ({row.transitionDurationMs} ms)
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}