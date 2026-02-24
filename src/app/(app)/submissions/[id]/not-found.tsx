import Link from 'next/link'

import { routes } from '@/config/routes'
import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'

export default function SubmissionNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="font-heading">Submission not found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The submission you are looking for does not exist or has been
            removed.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href={routes.submissions()}>Back to Submissions</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
