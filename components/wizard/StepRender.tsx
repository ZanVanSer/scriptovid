import { MOTION_PRESETS } from "@/lib/motion/motionPresets";
import { CINEMATIC_TRANSITION_OPTIONS, TRANSITION_DURATION_OPTIONS_MS } from "@/lib/render/transition-types";
import { buildRenderProject } from "@/modules/video-renderer/render-project";
import { formatDurationClock, normalizeSceneDurationOverrideSeconds } from "@/types/api-responses";
import {
  MOTION_STRENGTH_MAX,
  MOTION_STRENGTH_MIN,
  normalizeMotionStrength,
} from "@/types/render-project";

import type { WizardState, WizardActions } from "./types";
import styles from "@/app/page.module.css";

interface StepRenderProps {
  state: WizardState;
  actions: WizardActions;
  onBack: () => void;
}

export function StepRender({ state, actions, onBack }: StepRenderProps) {
  const normalizedMotionStrength = normalizeMotionStrength(state.motionStrength);

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
      strength: normalizedMotionStrength,
    },
  });

  const assignedMotionCount = renderProject.scenes.filter((scene) => scene.motionPreset).length;

  return (
    <section className={styles.panel}>
      <div className={styles.sectionRow}>
        <p className={styles.sectionTitle}>Render & Export</p>
      </div>
      
      <div className={styles.modeControls}>
        <div className={styles.controlsGrid}>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={state.transitionsEnabled}
              onChange={(event) => actions.setTransitionsEnabled(event.target.checked)}
            />
            <span className={styles.fieldLabel}>Transitions</span>
          </label>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={state.motionEnabled}
              onChange={(event) => actions.setMotionEnabled(event.target.checked)}
            />
            <span className={styles.fieldLabel}>Motion Effects</span>
          </label>
        </div>
      </div>

      <div className={styles.renderSummary}>
        <div className={styles.summaryGrid}>
          <div className={styles.summaryItem}>Scenes: {renderProject.scenes.length}</div>
          <div className={styles.summaryItem}>Duration: {formatDurationClock(renderProject.totalFinalSceneDuration)}</div>
          <div className={styles.summaryItem}>Ready: {renderProject.isReady ? "Yes" : "No"}</div>
        </div>
        
        {renderProject.issues.length > 0 && (
          <ul className={styles.renderIssueList}>
            {renderProject.issues.map((issue, idx) => (
              <li 
                key={issue.code + idx} 
                className={`${styles.renderIssueItem} ${issue.level === "error" ? styles.renderIssueError : styles.renderIssueWarning}`}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={onBack}>Back</button>
          <button type="button" className={styles.button} onClick={actions.handlePreviewVideo}>
            Preview
          </button>
          <button
            type="button"
            className={styles.buttonPrimary}
            onClick={() => void actions.handleRenderVideo()}
            disabled={!renderProject.isReady || state.renderStatus === "rendering"}
          >
            {state.renderStatus === "rendering" ? "Rendering..." : "Render Video"}
          </button>
          <button 
            type="button" 
            className={styles.button} 
            onClick={() => void actions.handleClearGeneratedFiles()}
            disabled={state.isClearingGenerated || state.renderStatus === "rendering"}
          >
            {state.isClearingGenerated ? "Clearing..." : "Clear Data"}
          </button>
        </div>

        {state.renderStatus === "success" && state.renderResult && (
          <div className={styles.info}>
            <p>Render successful!</p>
            <a className={styles.buttonPrimary} href={state.renderResult.outputUrl} download={state.renderResult.fileName}>
              Download MP4
            </a>
          </div>
        )}
        {state.clearGeneratedMessage && <p className={styles.info}>{state.clearGeneratedMessage}</p>}
      </div>

      <details className={styles.promptDetails}>
        <summary className={styles.promptSummary}>Advanced Settings</summary>
        <div style={{ marginTop: "16px", display: "grid", gap: "24px" }}>
          <div className={styles.controlsGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Transition Duration (ms)</span>
              <select
                className={styles.selectInput}
                value={state.transitionDurationMs}
                onChange={(e) => actions.setTransitionDurationMs(Number(e.target.value))}
              >
                {TRANSITION_DURATION_OPTIONS_MS.map((d) => <option key={d} value={d}>{d}ms</option>)}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Motion Strength</span>
              <input
                type="range"
                min={MOTION_STRENGTH_MIN}
                max={MOTION_STRENGTH_MAX}
                step={0.1}
                value={normalizedMotionStrength}
                onChange={(e) => actions.setMotionStrength(Number(e.target.value))}
              />
              <span className={styles.info} style={{ margin: 0, padding: 0 }}>
                {normalizedMotionStrength.toFixed(1)}x
              </span>
            </label>
          </div>

          <div>
            <span className={styles.fieldLabel}>Allowed Transitions</span>
            <div className={styles.motionPresetGrid}>
              {CINEMATIC_TRANSITION_OPTIONS.map((preset) => (
                <label key={preset.value} className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={state.allowedTransitionPresetIds.includes(preset.value)}
                    disabled={!state.transitionsEnabled}
                    onChange={() => actions.toggleAllowedTransitionPreset(preset.value)}
                  />
                  <span className={styles.fieldLabel} style={{ fontWeight: 400 }}>{preset.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <span className={styles.fieldLabel}>Allowed Motion Effects</span>
            <div className={styles.motionPresetGrid}>
              {MOTION_PRESETS.map((preset) => (
                <label key={preset.id} className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={state.allowedMotionPresetIds.includes(preset.id)}
                    disabled={!state.motionEnabled}
                    onChange={() => actions.toggleAllowedMotionPreset(preset.id)}
                  />
                  <span className={styles.fieldLabel} style={{ fontWeight: 400 }}>{preset.name}</span>
                </label>
              ))}
            </div>
            <p className={styles.info} style={{ marginTop: "12px", padding: "8px 12px" }}>
              Presets assigned: {assignedMotionCount}/{renderProject.scenes.length}
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
