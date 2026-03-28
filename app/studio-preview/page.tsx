"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Player } from "@remotion/player";

import { convertRenderProjectToPreviewRemotionProps } from "@/lib/preview/preview-remotion-props";
import { readPreviewSnapshot, type PreviewSnapshot } from "@/lib/preview/preview-snapshot";
import { VideoComposition } from "@/remotion/VideoComposition";
import { timelinePlanner } from "@/remotion/lib/timeline-planner";

import styles from "./page.module.css";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; snapshot: PreviewSnapshot };

function formatClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function StudioPreviewPage() {
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });

  useEffect(() => {
    const snapshotIdParam = new URLSearchParams(window.location.search).get("snapshotId");
    const result = readPreviewSnapshot(window.localStorage, snapshotIdParam || undefined);
    if (!result.ok) {
      if (result.errorCode === "NOT_FOUND") {
        setPageState({
          status: "error",
          message: "No studio preview data found. Please return to the main editor and try again.",
        });
        return;
      }
      setPageState({
        status: "error",
        message: "Studio preview data is invalid. Please return to the main editor and create a new snapshot.",
      });
      return;
    }

    setPageState({
      status: "loaded",
      snapshot: result.snapshot,
    });
  }, []);

  const previewData = useMemo(() => {
    if (pageState.status !== "loaded") {
      return null;
    }

    const converted = convertRenderProjectToPreviewRemotionProps(pageState.snapshot.renderProject);
    if (!converted.ok) {
      return {
        ok: false as const,
        message: converted.message,
      };
    }

    const timeline = timelinePlanner({
      fps: converted.props.fps,
      transitions: converted.props.transitions,
      scenes: converted.props.scenes,
    });

    return {
      ok: true as const,
      remotionProps: converted.props,
      timeline,
    };
  }, [pageState]);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.topBar}>
          <p className={styles.title}>Preview Video</p>
          <div className={styles.topActions}>
            <Link className={styles.linkButton} href="/">
              Return to editor
            </Link>
          </div>
        </header>

        {pageState.status === "loading" ? (
          <section className={styles.panel}>
            <p className={styles.muted}>Loading studio preview data...</p>
          </section>
        ) : null}

        {pageState.status === "error" ? (
          <section className={styles.panel}>
            <p className={styles.error}>{pageState.message}</p>
          </section>
        ) : null}

        {pageState.status === "loaded" && previewData && !previewData.ok ? (
          <section className={styles.panel}>
            <p className={styles.error}>{previewData.message}</p>
          </section>
        ) : null}

        {pageState.status === "loaded" && previewData && previewData.ok ? (
          <section className={styles.workspace}>
            <div className={styles.playerPanel}>
              <div className={styles.playerWrap}>
                <Player
                  component={VideoComposition}
                  inputProps={previewData.remotionProps}
                  durationInFrames={previewData.timeline.totalCompositionFrames}
                  fps={previewData.remotionProps.fps}
                  compositionWidth={previewData.remotionProps.width}
                  compositionHeight={previewData.remotionProps.height}
                  acknowledgeRemotionLicense
                  controls
                  loop={false}
                  style={{ width: "100%", height: "100%" }}
                />
              </div>
            </div>

            <aside className={styles.panel}>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>Scenes: {previewData.remotionProps.scenes.length}</div>
                <div className={styles.summaryItem}>
                  Duration: {formatClock(pageState.snapshot.renderProject.totalFinalSceneDuration)}
                </div>
                <div className={styles.summaryItem}>
                  {previewData.remotionProps.width}×{previewData.remotionProps.height} @ {previewData.remotionProps.fps}
                  fps
                </div>
                <div className={styles.summaryItem}>
                  Motion: {pageState.snapshot.renderProject.settings.motion.strength}
                </div>
              </div>

              <div className={styles.sceneList}>
                {previewData.timeline.entries.map((entry, index) => (
                  <div key={entry.id + String(index)} className={styles.sceneItem}>
                    <div className={styles.sceneRow}>
                      <span className={styles.sceneLabel}>Scene {index + 1}</span>
                      <span className={styles.sceneMeta}>
                        {entry.sceneStartFrame}f - {entry.sceneStartFrame + entry.sceneDurationFrames}f
                      </span>
                    </div>
                    <div className={styles.sceneRow}>
                      <span className={styles.sceneMeta}>
                        Transition: {entry.outgoingTransitionType} ({entry.outgoingTransitionFrames}f)
                      </span>
                      <span className={styles.sceneMeta}>Motion: {entry.scene.motionPreset || "static"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </section>
        ) : null}
      </div>
    </main>
  );
}
