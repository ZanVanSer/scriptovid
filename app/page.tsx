"use client";

import { useWizardState } from "@/components/wizard/useWizardState";
import { StepScriptInput } from "@/components/wizard/StepScriptInput";
import { StepSceneReview } from "@/components/wizard/StepSceneReview";
import { StepStoryboard } from "@/components/wizard/StepStoryboard";
import { StepNarration } from "@/components/wizard/StepNarration";
import { StepRender } from "@/components/wizard/StepRender";
import { TechnicalDetails } from "@/components/wizard/TechnicalDetails";
import { WizardErrorBoundary } from "@/components/wizard/WizardErrorBoundary";

import styles from "./page.module.css";

export default function Home() {
  const { state, actions } = useWizardState();

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <WizardErrorBoundary>
          <StepScriptInput state={state} actions={actions} />
        </WizardErrorBoundary>

        <WizardErrorBoundary>
          <StepSceneReview state={state} actions={actions} />
        </WizardErrorBoundary>

        <WizardErrorBoundary>
          <StepStoryboard state={state} actions={actions} />
        </WizardErrorBoundary>

        <WizardErrorBoundary>
          <StepNarration state={state} actions={actions} />
        </WizardErrorBoundary>

        <WizardErrorBoundary>
          <StepRender state={state} actions={actions} />
        </WizardErrorBoundary>

        <WizardErrorBoundary>
          <TechnicalDetails state={state} />
        </WizardErrorBoundary>
      </main>
    </div>
  );
}