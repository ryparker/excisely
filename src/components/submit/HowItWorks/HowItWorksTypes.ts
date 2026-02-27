import {
  Camera,
  CheckCircle2,
  PenLine,
  Send,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

import type { SubmissionStep } from '@/stores/useExtractionStore'

export interface Step {
  icon: LucideIcon
  title: string
  description: string
  hoverTitle: string
  hoverDetail: string
  hoverTip: string
  solidBg: string
  solidText: string
  mutedBg: string
  mutedIcon: string
  ringColor: string
  connectorColor: string
}

// Step 1 — shared
const uploadStep: Step = {
  icon: Camera,
  title: 'Upload Photos',
  description: 'Take a photo of your label',
  hoverTitle: 'Upload label images',
  hoverDetail:
    'Front, back, and neck labels — clear and well-lit for best results.',
  hoverTip: 'A steady hand and good lighting go a long way.',
  solidBg: 'bg-blue-600 dark:bg-blue-500',
  solidText: 'text-white',
  mutedBg: 'bg-blue-50 dark:bg-blue-950/40',
  mutedIcon: 'text-blue-600/40 dark:text-blue-400/40',
  ringColor: 'shadow-blue-400/40 dark:shadow-blue-500/30',
  connectorColor: 'stroke-blue-500 dark:stroke-blue-400',
}

// Step 4 — shared
const submitStep: Step = {
  icon: Send,
  title: 'Submit',
  description: 'Send it to us for review',
  hoverTitle: 'Submit for review',
  hoverDetail:
    'Your application goes to a labeling specialist for final review.',
  hoverTip: 'Track your submission anytime from "My Submissions."',
  solidBg: 'bg-emerald-600 dark:bg-emerald-500',
  solidText: 'text-white',
  mutedBg: 'bg-emerald-50 dark:bg-emerald-950/40',
  mutedIcon: 'text-emerald-600/40 dark:text-emerald-400/40',
  ringColor: 'shadow-emerald-400/40 dark:shadow-emerald-500/30',
  connectorColor: 'stroke-emerald-500 dark:stroke-emerald-400',
}

// Step 5 — shared
const decisionStep: Step = {
  icon: CheckCircle2,
  title: 'Get Your Decision',
  description: 'Hear back within 3 business days',
  hoverTitle: 'Receive your decision',
  hoverDetail:
    "Your application will be Approved, or we'll let you know exactly what needs to change.",
  hoverTip: 'Most corrections can be resolved in a single round.',
  solidBg: 'bg-gold dark:bg-gold',
  solidText: 'text-white dark:text-background',
  mutedBg: 'bg-gold/10 dark:bg-gold/15',
  mutedIcon: 'text-gold/40',
  ringColor: 'shadow-gold/40',
  connectorColor: 'stroke-gold',
}

// Cloud AI steps: Upload → We Read It → You Review → Submit → Decision
export const STEPS: Step[] = [
  uploadStep,
  {
    icon: Sparkles,
    title: 'We Read It',
    description: 'We fill out the form for you',
    hoverTitle: 'Automatic field extraction',
    hoverDetail:
      'Our system reads your label and fills in the fields — usually takes a few seconds.',
    hoverTip: 'The clearer the photo, the more accurate the results.',
    solidBg: 'bg-amber-500 dark:bg-amber-500',
    solidText: 'text-white',
    mutedBg: 'bg-amber-50 dark:bg-amber-950/40',
    mutedIcon: 'text-amber-600/40 dark:text-amber-400/40',
    ringColor: 'shadow-amber-400/40 dark:shadow-amber-500/30',
    connectorColor: 'stroke-amber-500 dark:stroke-amber-400',
  },
  {
    icon: PenLine,
    title: 'You Review',
    description: 'Make any changes before submitting',
    hoverTitle: 'Review & edit',
    hoverDetail:
      'Check the pre-filled fields, fix anything that looks off, add anything we missed.',
    hoverTip: 'Double-check the alcohol content and health warning.',
    solidBg: 'bg-violet-600 dark:bg-violet-500',
    solidText: 'text-white',
    mutedBg: 'bg-violet-50 dark:bg-violet-950/40',
    mutedIcon: 'text-violet-600/40 dark:text-violet-400/40',
    ringColor: 'shadow-violet-400/40 dark:shadow-violet-500/30',
    connectorColor: 'stroke-violet-500 dark:stroke-violet-400',
  },
  submitStep,
  decisionStep,
]

export type StepState = 'completed' | 'active' | 'upcoming'

export function getStepState(
  stepIndex: number,
  currentStep: SubmissionStep,
): StepState {
  const stepNumber = stepIndex + 1
  if (stepNumber < currentStep) return 'completed'
  if (stepNumber === currentStep) return 'active'
  return 'upcoming'
}
