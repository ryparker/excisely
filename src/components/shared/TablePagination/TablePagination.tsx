import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface TablePaginationProps {
  currentPage: number
  totalPages: number
  tableTotal: number
  pageSize: number
  entityName: string
  onPrevious: () => void
  onNext: () => void
  alwaysShowButtons?: boolean
  className?: string
}

export function TablePagination({
  currentPage,
  totalPages,
  tableTotal,
  pageSize,
  entityName,
  onPrevious,
  onNext,
  alwaysShowButtons = false,
  className,
}: TablePaginationProps) {
  const offset = (currentPage - 1) * pageSize
  const plural = tableTotal !== 1 ? 's' : ''

  return (
    <div
      className={cn(
        'flex items-center justify-between border-t px-6 py-3',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground tabular-nums">
        {totalPages > 1
          ? `Showing ${offset + 1}\u2013${Math.min(offset + pageSize, tableTotal)} of ${tableTotal} ${entityName}${plural}`
          : `${tableTotal} ${entityName}${plural}`}
      </p>
      {totalPages > 1 &&
        (alwaysShowButtons ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={onPrevious}
            >
              Previous
            </Button>
            <span className="px-2 text-xs text-muted-foreground tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={onNext}
            >
              Next
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {currentPage > 1 && (
              <Button variant="outline" size="sm" onClick={onPrevious}>
                Previous
              </Button>
            )}
            {currentPage < totalPages && (
              <Button variant="outline" size="sm" onClick={onNext}>
                Next
              </Button>
            )}
          </div>
        ))}
    </div>
  )
}
