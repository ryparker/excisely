'use client'

import { useRef, useState, useTransition } from 'react'
import { Pencil, X } from 'lucide-react'

import { updateApplicantNotes } from '@/app/actions/update-applicant-notes'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Textarea } from '@/components/ui/Textarea'

interface ApplicantNotesProps {
  applicantId: string
  initialNotes: string | null
}

export function ApplicantNotes({
  applicantId,
  initialNotes,
}: ApplicantNotesProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [savedNotes, setSavedNotes] = useState(initialNotes)
  const [draft, setDraft] = useState(initialNotes ?? '')
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleEdit() {
    setDraft(savedNotes ?? '')
    setIsEditing(true)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  function handleCancel() {
    setDraft(savedNotes ?? '')
    setIsEditing(false)
  }

  function handleSave() {
    startTransition(async () => {
      const trimmed = draft.trim() || null
      const result = await updateApplicantNotes(applicantId, trimmed)
      if (result.success) {
        setSavedNotes(trimmed)
        setIsEditing(false)
      }
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">Notes</CardTitle>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={handleEdit}
          >
            <Pencil className="size-3" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add notes about this applicant..."
              rows={4}
              maxLength={2000}
              disabled={isPending}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {draft.length}/2000
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  <X className="mr-1 size-3" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  {isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        ) : savedNotes ? (
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {savedNotes}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground/60 italic">
            No notes yet. Click Edit to add one.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
