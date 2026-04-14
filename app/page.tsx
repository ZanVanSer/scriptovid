"use client";

import { useState } from "react";
import { useWizardState } from "@/components/wizard/useWizardState";
import { StepScriptInput } from "@/components/wizard/StepScriptInput";
import { StepSceneReview } from "@/components/wizard/StepSceneReview";
import { StepStoryboard } from "@/components/wizard/StepStoryboard";
import { StepNarration } from "@/components/wizard/StepNarration";
import { StepRender } from "@/components/wizard/StepRender";
import { TechnicalDetails } from "@/components/wizard/TechnicalDetails";
import { WizardErrorBoundary } from "@/components/wizard/WizardErrorBoundary";

import styles from "./page.module.css";

const STEPS = [
  { id: 1, label: "Script Input" },
  { id: 2, label: "Scene Setup" },
  { id: 3, label: "Storyboard" },
  { id: 4, label: "Narration" },
  { id: 5, label: "Render & Export" },
];

export default function Home() {
  const { state, actions } = useWizardState();
  const [activeStep, setActiveStep] = useState(1);

  const isStepDone = (stepId: number) => {
    switch (stepId) {
      case 1:
        return !!state.result;
      case 2:
        return !!state.scenePackResult;
      case 3:
        return state.scenePackResult && Object.keys(state.sceneImages).length >= state.scenePackResult.totalSceneCount;
      case 4:
        return state.narration.status === "done";
      case 5:
        return state.renderStatus === "success";
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (activeStep) {
      case 1:
        return (
          <WizardErrorBoundary>
            <StepScriptInput 
              state={state} 
              actions={actions} 
              onNext={() => setActiveStep(2)} 
            />
          </WizardErrorBoundary>
        );
      case 2:
        return (
          <WizardErrorBoundary>
            <StepSceneReview 
              state={state} 
              actions={actions} 
              onNext={() => setActiveStep(3)} 
              onBack={() => setActiveStep(1)} 
            />
          </WizardErrorBoundary>
        );
      case 3:
        return (
          <WizardErrorBoundary>
            <StepStoryboard 
              state={state} 
              actions={actions} 
              onNext={() => setActiveStep(4)} 
              onBack={() => setActiveStep(2)} 
            />
          </WizardErrorBoundary>
        );
      case 4:
        return (
          <WizardErrorBoundary>
            <StepNarration 
              state={state} 
              actions={actions} 
              onNext={() => setActiveStep(5)} 
              onBack={() => setActiveStep(3)} 
            />
          </WizardErrorBoundary>
        );
      case 5:
        return (
          <WizardErrorBoundary>
            <StepRender 
              state={state} 
              actions={actions} 
              onBack={() => setActiveStep(4)} 
            />
          </WizardErrorBoundary>
        );
      default:
        return null;
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <h1 className={styles.sidebarTitle}>scriptovid</h1>
        <nav className={styles.nav}>
          {STEPS.map((step) => {
            const done = isStepDone(step.id);
            return (
              <button
                key={step.id}
                className={`${styles.navItem} ${activeStep === step.id ? styles.navItemActive : ""}`}
                onClick={() => setActiveStep(step.id)}
              >
                <span className={`${styles.navNumber} ${done ? styles.navNumberDone : ""}`}>
                  {done ? <span className={styles.navCheck}>✓</span> : step.id}
                </span>
                {step.label}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className={styles.container}>
        {renderStep()}
        
        <WizardErrorBoundary>
          <TechnicalDetails state={state} />
        </WizardErrorBoundary>
      </main>
    </div>
  );
}
