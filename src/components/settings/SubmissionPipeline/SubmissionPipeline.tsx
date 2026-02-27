'use client'

import { useState, useTransition } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  HardDrive,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { updateSubmissionPipelineModel } from '@/app/actions/update-settings'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Label } from '@/components/ui/Label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import type { SubmissionPipelineModel } from '@/db/queries/settings'

interface SubmissionPipelineProps {
  defaultValue: SubmissionPipelineModel
  cloudAvailable: boolean
}

export function SubmissionPipeline({
  defaultValue,
  cloudAvailable,
}: SubmissionPipelineProps) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState<SubmissionPipelineModel>(defaultValue)

  function handleChange(model: string) {
    const next = model as SubmissionPipelineModel
    if (next === 'cloud' && !cloudAvailable) return
    setValue(next)
    startTransition(async () => {
      const result = await updateSubmissionPipelineModel(next)
      if (!result.success) {
        toast.error(result.error)
        setValue(defaultValue)
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          OCR Model
          {isPending && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
        </CardTitle>
        <CardDescription>
          Choose the OCR pipeline used for new label submissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cloud API status indicator */}
        <div className="flex items-center gap-2 text-sm">
          {cloudAvailable ? (
            <>
              <span className="size-2 rounded-full bg-green-500" />
              <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
                <CheckCircle2 className="size-3.5" />
                Cloud AI Available
              </span>
            </>
          ) : (
            <>
              <span className="size-2 rounded-full bg-muted-foreground/40" />
              <span className="text-muted-foreground">
                Cloud AI Not Configured
              </span>
              <span className="text-xs text-muted-foreground/60">
                — set GOOGLE_APPLICATION_CREDENTIALS and OPENAI_API_KEY in{' '}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.7rem]">
                  .env.local
                </code>{' '}
                (local) or Vercel Environment Variables (production)
              </span>
            </>
          )}
        </div>

        <RadioGroup value={value} onValueChange={handleChange}>
          <label
            htmlFor="pipeline-cloud"
            className={`flex items-start gap-3 rounded-lg border p-4 transition-colors has-[[data-state=checked]]:bg-accent/50 ${
              cloudAvailable
                ? 'cursor-pointer'
                : 'cursor-not-allowed opacity-50'
            }`}
          >
            <RadioGroupItem
              value="cloud"
              id="pipeline-cloud"
              className="mt-0.5"
              disabled={!cloudAvailable}
            />
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <Cloud className="size-4 text-muted-foreground" />
                <Label
                  htmlFor="pipeline-cloud"
                  className={`font-medium ${cloudAvailable ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  Cloud AI
                </Label>
                {!cloudAvailable && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    API keys required
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Google Cloud Vision + GPT-4.1 Nano. Bounding box overlays, ~3-5s
                per label.
              </p>
            </div>
          </label>

          <label
            htmlFor="pipeline-local"
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-[[data-state=checked]]:bg-accent/50"
          >
            <RadioGroupItem
              value="local"
              id="pipeline-local"
              className="mt-0.5"
            />
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <HardDrive className="size-4 text-muted-foreground" />
                <Label
                  htmlFor="pipeline-local"
                  className="cursor-pointer font-medium"
                >
                  Local (Tesseract)
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Tesseract.js OCR. No cloud API calls, zero cost. No bounding box
                overlays.
              </p>
            </div>
          </label>
        </RadioGroup>

        {value === 'local' && (
          <div className="flex gap-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Bounding box overlays won&apos;t be available for labels processed
              with the local model. Field comparison accuracy may differ from
              the cloud pipeline.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
