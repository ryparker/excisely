'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Cloud, HardDrive, Loader2, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import { routes } from '@/config/routes'
import { updateSubmissionPipelineModel } from '@/app/actions/update-settings'
import { Switch } from '@/components/ui/Switch'

interface CloudUpgradeBannerProps {
  cloudAvailable: boolean
  pipelineModel: string
}

export function CloudUpgradeBanner({
  cloudAvailable,
  pipelineModel,
}: CloudUpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const isCloud = pipelineModel === 'cloud'

  if (dismissed) return null

  function handleToggle() {
    const target = isCloud ? 'local' : 'cloud'
    startTransition(async () => {
      const result = await updateSubmissionPipelineModel(target)
      if (result.success) {
        toast.success(
          target === 'cloud'
            ? 'Switched to Cloud AI pipeline'
            : 'Switched to Local pipeline',
        )
        router.refresh()
      } else {
        toast.error(result.error ?? 'Failed to switch pipeline')
      }
    })
  }

  const Icon = isCloud ? Cloud : HardDrive

  return (
    <div
      className={`relative rounded-lg p-4 text-sm ${
        isCloud
          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
          : 'bg-sky-500/10 text-sky-800 dark:text-sky-300'
      }`}
    >
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className={`absolute top-3 right-3 rounded-sm p-0.5 transition-colors ${
          isCloud
            ? 'text-emerald-600/60 hover:text-emerald-800 dark:text-emerald-400/60 dark:hover:text-emerald-200'
            : 'text-sky-600/60 hover:text-sky-800 dark:text-sky-400/60 dark:hover:text-sky-200'
        }`}
        aria-label="Dismiss banner"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-2">
          {isCloud ? (
            <p>
              Using <strong className="font-medium">Cloud AI</strong> — Google
              Cloud Vision + GPT-4.1 Nano for bounding box overlays, AI field
              scanning, and higher accuracy.
            </p>
          ) : cloudAvailable ? (
            <p>
              Using <strong className="font-medium">Local</strong> processing.
              Cloud AI is ready — toggle to enable bounding box overlays, AI
              field scanning, and higher accuracy.
            </p>
          ) : (
            <p>
              Using <strong className="font-medium">Local</strong> processing.{' '}
              <Link
                href={routes.settings()}
                className="inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
              >
                <Settings className="size-3" />
                Add API keys
              </Link>{' '}
              to unlock Cloud AI with bounding box overlays, AI field scanning,
              and higher accuracy.
            </p>
          )}

          {cloudAvailable && (
            <label className="flex items-center gap-2 select-none">
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Switch
                  size="sm"
                  checked={isCloud}
                  onCheckedChange={handleToggle}
                  disabled={isPending}
                />
              )}
              <span className="text-xs font-medium">
                {isCloud ? 'Cloud AI' : 'Local'}
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  )
}
