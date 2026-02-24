'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function AuthError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="font-heading">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred. Please try again.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button onClick={reset}>Try again</Button>
        </CardFooter>
      </Card>
    </div>
  )
}
