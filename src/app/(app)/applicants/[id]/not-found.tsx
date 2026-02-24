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

export default function ApplicantNotFound() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="font-heading">Applicant not found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The applicant you are looking for does not exist or has been
            removed.
          </p>
        </CardContent>
        <CardFooter className="justify-center">
          <Button asChild>
            <Link href={routes.applicants()}>Back to Applicants</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
