"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_NANOBANANA_MODEL,
  NANOBANANA_MODELS,
  NanobananaError,
  generateNanobananaImage,
  type NanobananaModel,
} from "@/modules/image-generation/nanobanana";
import {
  DEFAULT_VISUAL_STYLE_PRESET_ID,
  VISUAL_STYLE_PRESETS,
  buildSceneImagePrompt,
  type VisualStylePresetId,
} from "@/modules/image-generation/prompt-builder";
import { DEFAULT_WORDS_PER_MINUTE } from "@/modules/scene-splitter/constants";
import { toPackableTimedUnits } from "@/modules/scene-splitter/fallback-splitter";
import { detectSplitWarnings, validateScriptInput } from "@/modules/scene-splitter/input-quality";
import {
  DEFAULT_MAX_SCENE_DURATION_SECONDS,
  DEFAULT_MIN_SCENE_DURATION_SECONDS,
  packSentencesIntoScenes,
} from "@/modules/scene-splitter/scene-packer";
import { SAMPLE_SCRIPT } from "@/modules/scene-splitter/sample-script";
import type { ScenePackResult } from "@/types/scene";
import type { SentenceSplitResponse } from "@/types/sentence";

import styles from "./page.module.css";

type SceneImageState = {
  label: string;
  objectUrl: string;
  source: "manual" | "nanobanana";
  generatedPrompt?: string;
  generatedModel?: string;
};

const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ACCEPTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
type ImageSourceMode = "manual" | "nanobanana";
type SceneGenerationStatus = "idle" | "loading" | "done" | "error";

type SceneGenerationState = {
  status: SceneGenerationStatus;
  errorMessage?: string;
  usedPrompt?: string;
  usedModel?: NanobananaModel;
  imageUrl?: string;
};
type BatchGenerationMode = "generate-all" | "regenerate-all" | "regenerate-failed";

function formatSeconds(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

function isAllowedImageFile(file: File) {
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

export default function Home() {
  const [scriptText, setScriptText] = useState("");
  const [result, setResult] = useState<SentenceSplitResponse | null>(null);
  const [scenePackResult, setScenePackResult] = useState<ScenePackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputFeedback, setInputFeedback] = useState<string | null>(null);
  const [splitWarnings, setSplitWarnings] = useState<string[]>([]);
  const [scenePackError, setScenePackError] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [minSceneDurationSeconds, setMinSceneDurationSeconds] = useState(
    String(DEFAULT_MIN_SCENE_DURATION_SECONDS),
  );
  const [maxSceneDurationSeconds, setMaxSceneDurationSeconds] = useState(
    String(DEFAULT_MAX_SCENE_DURATION_SECONDS),
  );
  const [sceneImages, setSceneImages] = useState<Record<number, SceneImageState>>({});
  const [sceneImageErrors, setSceneImageErrors] = useState<Record<number, string>>({});
  const [activeDropSceneIndex, setActiveDropSceneIndex] = useState<number | null>(null);
  const sceneImagesRef = useRef<Record<number, SceneImageState>>({});
  const [imageSourceMode, setImageSourceMode] = useState<ImageSourceMode>("manual");
  const [nanobananaModel, setNanobananaModel] = useState<NanobananaModel>(DEFAULT_NANOBANANA_MODEL);
  const [selectedVisualStyle, setSelectedVisualStyle] = useState<VisualStylePresetId>(
    DEFAULT_VISUAL_STYLE_PRESET_ID,
  );
  const [nanobananaApiKeyOverride, setNanobananaApiKeyOverride] = useState("");
  const [sceneGenerationStates, setSceneGenerationStates] = useState<Record<number, SceneGenerationState>>(
    {},
  );
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    completed: number;
    total: number;
    mode: BatchGenerationMode;
  } | null>(null);

  useEffect(() => {
    sceneImagesRef.current = sceneImages;
  }, [sceneImages]);

  useEffect(() => {
    return () => {
      Object.values(sceneImagesRef.current).forEach((entry) => {
        URL.revokeObjectURL(entry.objectUrl);
      });
    };
  }, []);

  function clearSceneImageErrorsFor(sceneIndex: number) {
    setSceneImageErrors((current) => {
      if (!current[sceneIndex]) {
        return current;
      }

      const next = { ...current };
      delete next[sceneIndex];
      return next;
    });
  }

  function clearAllSceneImages() {
    setSceneImages((current) => {
      Object.values(current).forEach((entry) => {
        URL.revokeObjectURL(entry.objectUrl);
      });
      return {};
    });
    setSceneImageErrors({});
    setActiveDropSceneIndex(null);
    setSceneGenerationStates({});
    setIsBatchGenerating(false);
    setBatchProgress(null);
  }

  function removeSceneImage(sceneIndex: number) {
    setSceneImages((current) => {
      const existing = current[sceneIndex];
      if (!existing) {
        return current;
      }

      URL.revokeObjectURL(existing.objectUrl);
      const next = { ...current };
      delete next[sceneIndex];
      return next;
    });
    clearSceneImageErrorsFor(sceneIndex);
    setSceneGenerationStates((current) => ({
      ...current,
      [sceneIndex]: {
        status: "idle",
        usedPrompt: current[sceneIndex]?.usedPrompt,
        usedModel: current[sceneIndex]?.usedModel,
        errorMessage: undefined,
        imageUrl: undefined,
      },
    }));
  }

  function applySceneImageFile(sceneIndex: number, file: File) {
    if (!isAllowedImageFile(file)) {
      setSceneImageErrors((current) => ({
        ...current,
        [sceneIndex]: "Please upload a PNG, JPG, JPEG, or WEBP image.",
      }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);

    setSceneImages((current) => {
      const existing = current[sceneIndex];
      if (existing) {
        URL.revokeObjectURL(existing.objectUrl);
      }

      return {
        ...current,
        [sceneIndex]: {
          label: file.name,
          objectUrl,
          source: "manual",
        },
      };
    });
    clearSceneImageErrorsFor(sceneIndex);
    setSceneGenerationStates((current) => ({
      ...current,
      [sceneIndex]: {
        status: "done",
        usedPrompt: scenePrompts[sceneIndex] || current[sceneIndex]?.usedPrompt,
        usedModel: nanobananaModel,
        errorMessage: undefined,
        imageUrl: objectUrl,
      },
    }));
  }

  function resolveNanobananaApiKey() {
    const overrideKey = nanobananaApiKeyOverride.trim();
    if (overrideKey) {
      return overrideKey;
    }

    return process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  }

  async function generateSceneImage(sceneIndex: number, prompt: string, forcedApiKey?: string) {
    const apiKey = forcedApiKey || resolveNanobananaApiKey();
    if (!apiKey) {
      const message =
        "Gemini API key is missing. Set NEXT_PUBLIC_GEMINI_API_KEY or provide a local override key.";
      setSceneGenerationStates((current) => ({
        ...current,
        [sceneIndex]: {
          status: "error",
          errorMessage: message,
          usedPrompt: prompt,
          usedModel: nanobananaModel,
          imageUrl: undefined,
        },
      }));
      setSceneImageErrors((current) => ({
        ...current,
        [sceneIndex]: message,
      }));
      return;
    }

    setSceneGenerationStates((current) => ({
      ...current,
      [sceneIndex]: {
        status: "loading",
        usedPrompt: prompt,
        usedModel: nanobananaModel,
        errorMessage: undefined,
        imageUrl: sceneImages[sceneIndex]?.objectUrl,
      },
    }));
    clearSceneImageErrorsFor(sceneIndex);

    try {
      const result = await generateNanobananaImage({
        prompt,
        model: nanobananaModel,
        apiKey,
        aspectRatio: "16:9",
      });

      const blob = await fetch(result.imageUrl).then(async (response) => response.blob());
      const objectUrl = URL.createObjectURL(blob);

      setSceneImages((current) => {
        const existing = current[sceneIndex];
        if (existing) {
          URL.revokeObjectURL(existing.objectUrl);
        }

        return {
          ...current,
          [sceneIndex]: {
            label: `Generated · ${nanobananaModel}`,
            objectUrl,
            source: "nanobanana",
            generatedPrompt: prompt,
            generatedModel: nanobananaModel,
          },
        };
      });

      setSceneGenerationStates((current) => ({
        ...current,
        [sceneIndex]: {
          status: "done",
          usedPrompt: prompt,
          usedModel: nanobananaModel,
          errorMessage: undefined,
          imageUrl: objectUrl,
        },
      }));
    } catch (generationError) {
      let message = "Image generation failed.";
      if (generationError instanceof NanobananaError) {
        message = generationError.message;
      } else if (generationError instanceof Error) {
        message = generationError.message;
      }

      setSceneGenerationStates((current) => ({
        ...current,
        [sceneIndex]: {
          status: "error",
          errorMessage: message,
          usedPrompt: prompt,
          usedModel: nanobananaModel,
          imageUrl: undefined,
        },
      }));
      setSceneImageErrors((current) => ({
        ...current,
        [sceneIndex]: message,
      }));
    }
  }

  function getBatchTargetScenes(mode: BatchGenerationMode) {
    if (!scenePackResult) {
      return [];
    }

    if (mode === "regenerate-all") {
      return scenePackResult.scenes;
    }

    if (mode === "regenerate-failed") {
      return scenePackResult.scenes.filter((scene) => getSceneGenerationStatus(scene.index).status === "error");
    }

    return scenePackResult.scenes.filter((scene) => !sceneImages[scene.index]);
  }

  async function runBatchGeneration(mode: BatchGenerationMode) {
    if (!scenePackResult || scenePackResult.scenes.length === 0) {
      return;
    }

    const targetScenes = getBatchTargetScenes(mode);
    if (targetScenes.length === 0) {
      return;
    }

    const apiKey = resolveNanobananaApiKey();
    if (!apiKey) {
      const message =
        "Gemini API key is missing. Set NEXT_PUBLIC_GEMINI_API_KEY or provide a local override key.";
      setSceneGenerationStates((current) => {
        const next = { ...current };
        targetScenes.forEach((scene) => {
          next[scene.index] = {
            status: "error",
            errorMessage: message,
            usedPrompt: scenePrompts[scene.index] || scene.text,
            usedModel: nanobananaModel,
            imageUrl: undefined,
          };
        });
        return next;
      });
      setSceneImageErrors((current) => {
        const next = { ...current };
        targetScenes.forEach((scene) => {
          next[scene.index] = message;
        });
        return next;
      });
      return;
    }

    setIsBatchGenerating(true);
    setBatchProgress({ completed: 0, total: targetScenes.length, mode });

    for (let index = 0; index < targetScenes.length; index += 1) {
      const scene = targetScenes[index];
      const prompt = scenePrompts[scene.index] || scene.text;
      await generateSceneImage(scene.index, prompt, apiKey);
      setBatchProgress({
        completed: index + 1,
        total: targetScenes.length,
        mode,
      });
    }

    setIsBatchGenerating(false);
  }

  function openSceneFilePicker(sceneIndex: number) {
    const input = document.getElementById(`scene-upload-${sceneIndex}`) as HTMLInputElement | null;
    input?.click();
  }

  async function handleSplit() {
    setIsSplitting(true);
    setError(null);
    setInputFeedback(null);

    const validation = validateScriptInput(scriptText);

    if (validation.blockingError) {
      setInputFeedback(validation.blockingError);
      setIsSplitting(false);
      return;
    }

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
      const warnings = detectSplitWarnings(data.normalizedText);

      clearAllSceneImages();
      setResult(data);
      setScenePackResult(null);
      setScenePackError(null);
      setSplitWarnings(warnings);
      setInputFeedback(validation.advisory);
    } catch {
      setError("Unable to split text right now. Please try again.");
    } finally {
      setIsSplitting(false);
    }
  }

  function handleLoadSample() {
    clearAllSceneImages();
    setScriptText(SAMPLE_SCRIPT);
    setResult(null);
    setScenePackResult(null);
    setError(null);
    setInputFeedback(null);
    setSplitWarnings([]);
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

    clearAllSceneImages();
    setScenePackResult(packed);
  }

  const scenePrompts = useMemo(() => {
    if (!scenePackResult) {
      return {};
    }

    return scenePackResult.scenes.reduce<Record<number, string>>((acc, scene) => {
      acc[scene.index] = buildSceneImagePrompt({
        sceneText: scene.text,
        style: selectedVisualStyle,
      });
      return acc;
    }, {});
  }, [scenePackResult, selectedVisualStyle]);

  function getSceneGenerationStatus(sceneIndex: number): SceneGenerationState {
    return sceneGenerationStates[sceneIndex] || { status: "idle" };
  }

  function getPerSceneGenerateLabel(sceneIndex: number) {
    const sceneState = getSceneGenerationStatus(sceneIndex);
    if (sceneState.status === "loading") {
      return "Generating...";
    }

    if (sceneState.status === "error") {
      return "Retry";
    }

    if (sceneImages[sceneIndex]) {
      return "Regenerate";
    }

    return "Generate";
  }

  function formatBatchMode(mode: BatchGenerationMode) {
    if (mode === "regenerate-all") {
      return "regenerate all";
    }
    if (mode === "regenerate-failed") {
      return "regenerate failed";
    }
    return "generate all";
  }

  const generationSummary = useMemo(() => {
    if (!scenePackResult) {
      return { done: 0, error: 0, loading: 0 };
    }

    return scenePackResult.scenes.reduce(
      (acc, scene) => {
        const status = getSceneGenerationStatus(scene.index).status;
        if (status === "done") {
          acc.done += 1;
        } else if (status === "error") {
          acc.error += 1;
        } else if (status === "loading") {
          acc.loading += 1;
        }
        return acc;
      },
      { done: 0, error: 0, loading: 0 },
    );
  }, [scenePackResult, sceneGenerationStates]);

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>1. Script input</p>
          </div>
          <label htmlFor="script-input" className={styles.label}>
            Paste script
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
              disabled={isSplitting}
            >
              {isSplitting ? "Splitting..." : "Split script"}
            </button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {inputFeedback ? <p className={styles.info}>{inputFeedback}</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>2. Scene review setup</p>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>Sentences: {result?.sentenceCount ?? 0}</div>
            <div className={styles.summaryItem}>Words: {result?.totalWordCount ?? 0}</div>
            <div className={styles.summaryItem}>
              Narration estimate: {formatSeconds(result?.totalEstimatedDurationSeconds ?? 0)}
            </div>
            <div className={styles.summaryItem}>Timing baseline: {DEFAULT_WORDS_PER_MINUTE} WPM</div>
          </div>
          <div className={styles.modeControls}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Image source mode</span>
              <select
                className={styles.selectInput}
                value={imageSourceMode}
                onChange={(event) => {
                  setImageSourceMode(event.target.value as ImageSourceMode);
                  setActiveDropSceneIndex(null);
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
                value={selectedVisualStyle}
                onChange={(event) => setSelectedVisualStyle(event.target.value as VisualStylePresetId)}
              >
                {VISUAL_STYLE_PRESETS.map((stylePreset) => (
                  <option key={stylePreset.id} value={stylePreset.id}>
                    {stylePreset.label}
                  </option>
                ))}
              </select>
            </label>
            {imageSourceMode === "nanobanana" ? (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Nanobanana model</span>
                  <select
                    className={styles.selectInput}
                    value={nanobananaModel}
                    onChange={(event) => setNanobananaModel(event.target.value as NanobananaModel)}
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
                    value={nanobananaApiKeyOverride}
                    onChange={(event) => setNanobananaApiKeyOverride(event.target.value)}
                    placeholder="Use NEXT_PUBLIC_GEMINI_API_KEY if empty"
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
              Build storyboard scenes
            </button>
          </div>
          {scenePackError ? <p className={styles.error}>{scenePackError}</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>3. Storyboard review</p>
            <span className={styles.count}>Scenes: {scenePackResult?.totalSceneCount ?? 0}</span>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              Total scene duration:{" "}
              {formatSeconds(scenePackResult?.totalEstimatedDurationSeconds ?? 0)}
            </div>
            {imageSourceMode === "nanobanana" ? (
              <>
                <div className={styles.summaryItem}>Done: {generationSummary.done}</div>
                <div className={styles.summaryItem}>Errors: {generationSummary.error}</div>
                <div className={styles.summaryItem}>Loading: {generationSummary.loading}</div>
              </>
            ) : null}
          </div>
          {imageSourceMode === "nanobanana" ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => runBatchGeneration("generate-all")}
                disabled={!scenePackResult || scenePackResult.scenes.length === 0 || isBatchGenerating}
              >
                Generate all images
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => runBatchGeneration("regenerate-all")}
                disabled={!scenePackResult || scenePackResult.scenes.length === 0 || isBatchGenerating}
              >
                Regenerate all images
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => runBatchGeneration("regenerate-failed")}
                disabled={!scenePackResult || scenePackResult.scenes.length === 0 || isBatchGenerating}
              >
                Regenerate failed images
              </button>
              {isBatchGenerating && batchProgress ? (
                <p className={styles.modeNote}>
                  Running {formatBatchMode(batchProgress.mode)}: {batchProgress.completed}/
                  {batchProgress.total}
                </p>
              ) : null}
            </div>
          ) : null}
          {scenePackResult && scenePackResult.scenes.length > 0 ? (
            <ol className={styles.storyboardStrip}>
              {scenePackResult.scenes.map((scene) => (
                <li key={scene.index} className={styles.storyboardCard}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>Scene {scene.index}</p>
                    <p className={styles.cardMeta}>{formatSeconds(scene.estimatedDurationSeconds)}</p>
                  </div>
                  <div
                    className={`${styles.imagePlaceholder} ${
                      activeDropSceneIndex === scene.index ? styles.imagePlaceholderActive : ""
                    } ${styles.imagePlaceholderClickable}`}
                    onClick={() => {
                      openSceneFilePicker(scene.index);
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setActiveDropSceneIndex(scene.index);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setActiveDropSceneIndex(scene.index);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      if (activeDropSceneIndex === scene.index) {
                        setActiveDropSceneIndex(null);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setActiveDropSceneIndex(null);
                      const file = event.dataTransfer.files.item(0);
                      if (file) {
                        applySceneImageFile(scene.index, file);
                      }
                    }}
                  >
                    {sceneImages[scene.index] ? (
                      <img
                        src={sceneImages[scene.index].objectUrl}
                        alt={`Scene ${scene.index} uploaded preview`}
                        className={styles.sceneImage}
                      />
                    ) : (
                      <p className={styles.placeholderText}>
                        {imageSourceMode === "manual"
                          ? "Image placeholder"
                          : "Generated image placeholder"}
                      </p>
                    )}
                  </div>
                  <input
                    id={`scene-upload-${scene.index}`}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    className={styles.fileInput}
                    onChange={(event) => {
                      const file = event.target.files?.item(0);
                      if (file) {
                        applySceneImageFile(scene.index, file);
                      }
                      event.target.value = "";
                    }}
                  />
                  {imageSourceMode === "nanobanana" ? (
                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.smallButton}
                        disabled={
                          getSceneGenerationStatus(scene.index).status === "loading" || isBatchGenerating
                        }
                        onClick={() => generateSceneImage(scene.index, scenePrompts[scene.index] || scene.text)}
                      >
                        {getPerSceneGenerateLabel(scene.index)}
                      </button>
                      <p className={styles.modeNote}>Uses selected style + model for this scene.</p>
                    </div>
                  ) : null}
                  <div className={styles.cardActions}>
                    <label htmlFor={`scene-upload-${scene.index}`} className={styles.smallButton}>
                      {sceneImages[scene.index] ? "Replace" : "Upload"}
                    </label>
                    {sceneImages[scene.index] ? (
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => removeSceneImage(scene.index)}
                      >
                        Remove
                      </button>
                    ) : null}
                    {imageSourceMode === "nanobanana" ? (
                      <p className={styles.modeNote}>Manual upload can override generated result.</p>
                    ) : null}
                  </div>
                  {sceneImages[scene.index] ? (
                    <p className={styles.fileMeta}>{sceneImages[scene.index].label}</p>
                  ) : null}
                  {imageSourceMode === "nanobanana" ? (
                    <div className={styles.statusRow}>
                      <span
                        className={`${styles.statusPill} ${
                          getSceneGenerationStatus(scene.index).status === "done"
                            ? styles.statusDone
                            : getSceneGenerationStatus(scene.index).status === "error"
                              ? styles.statusError
                              : getSceneGenerationStatus(scene.index).status === "loading"
                                ? styles.statusLoading
                                : styles.statusIdle
                        }`}
                      >
                        {getSceneGenerationStatus(scene.index).status}
                      </span>
                      <span className={styles.fileMeta}>
                        {getSceneGenerationStatus(scene.index).usedModel
                          ? `Model: ${getSceneGenerationStatus(scene.index).usedModel}`
                          : `Model: ${nanobananaModel}`}
                      </span>
                    </div>
                  ) : null}
                  {sceneImageErrors[scene.index] ? (
                    <p className={styles.inlineError}>{sceneImageErrors[scene.index]}</p>
                  ) : null}
                  <p className={styles.scenePreview}>{scene.text}</p>
                  <details className={styles.promptDetails}>
                    <summary className={styles.promptSummary}>Prompt preview</summary>
                    <p className={styles.promptSource}>Scene text: {scene.text}</p>
                    <p className={styles.promptText}>{scenePrompts[scene.index] || "Prompt unavailable."}</p>
                    {getSceneGenerationStatus(scene.index).usedPrompt ? (
                      <p className={styles.promptSource}>
                        Last generated prompt: {getSceneGenerationStatus(scene.index).usedPrompt}
                      </p>
                    ) : null}
                    {getSceneGenerationStatus(scene.index).errorMessage ? (
                      <p className={styles.promptSource}>
                        Last error: {getSceneGenerationStatus(scene.index).errorMessage}
                      </p>
                    ) : null}
                  </details>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.emptyState}>Split script and build scenes to review storyboard cards.</div>
          )}
        </section>

        <section className={styles.panel}>
          <details className={styles.previewDetails}>
            <summary className={styles.previewSummary}>Technical details</summary>
            <div className={styles.debugStack}>
              {splitWarnings.length > 0 ? (
                <ul className={styles.warningList}>
                  {splitWarnings.map((warning) => (
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
                  {result?.normalizedText || "Run split to see normalized text."}
                </pre>
              </details>

              <details className={styles.subDetails}>
                <summary className={styles.subSummary}>Scene metadata</summary>
                {scenePackResult && scenePackResult.scenes.length > 0 ? (
                  <ol className={styles.debugList}>
                    {scenePackResult.scenes.map((scene) => (
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
      </main>
    </div>
  );
}
