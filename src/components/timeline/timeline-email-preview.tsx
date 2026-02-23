'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import type { TimelineEmail } from '@/lib/timeline/types'
import { Button } from '@/components/ui/button'

interface TimelineEmailPreviewProps {
  email: TimelineEmail
}

export function TimelineEmailPreview({ email }: TimelineEmailPreviewProps) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    const full = [
      `From: ${email.from}`,
      `To: ${email.to}`,
      `Subject: ${email.subject}`,
      '',
      email.body,
    ].join('\n')

    navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      {/* Email header */}
      <div className="space-y-1 border-b pb-3 font-mono text-xs">
        <div className="flex gap-2">
          <span className="shrink-0 text-muted-foreground">From:</span>
          <span className="text-foreground">{email.from}</span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 text-muted-foreground">To:</span>
          <span className="text-foreground">{email.to}</span>
        </div>
        <div className="flex gap-2">
          <span className="shrink-0 text-muted-foreground">Subject:</span>
          <span className="font-medium text-foreground">{email.subject}</span>
        </div>
      </div>

      {/* Email body */}
      <pre className="mt-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {email.body}
      </pre>

      {/* Field issues table */}
      {email.fieldIssues && email.fieldIssues.length > 0 && (
        <div className="mt-3 overflow-hidden rounded border">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                  Field
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                  Expected
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">
                  Found
                </th>
              </tr>
            </thead>
            <tbody>
              {email.fieldIssues.map((issue, i) => (
                <tr key={i} className="border-t">
                  <td className="px-3 py-1.5 font-medium">
                    {issue.displayName}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {issue.expected}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground">
                    {issue.found}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Copy button */}
      <div className="mt-3 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="size-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-3" />
              Copy Email
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
