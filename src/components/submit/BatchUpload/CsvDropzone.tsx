'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { AlertCircle, Download, FileSpreadsheet, Upload } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { useBatchUploadStore } from '@/stores/useBatchUploadStore'

import { parseCsvFile } from './CsvParser'
import { downloadCsvTemplate } from './CsvTemplate'

const CSV_ACCEPT = { 'text/csv': ['.csv'] }

export function CsvDropzone() {
  const setCsvData = useBatchUploadStore((s) => s.setCsvData)
  const [error, setError] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [rowCount, setRowCount] = useState(0)

  const onDrop = useCallback(
    async (accepted: File[]) => {
      setError(null)
      const file = accepted[0]
      if (!file) return

      const result = await parseCsvFile(file)

      if (result.parseErrors.length > 0) {
        setError(result.parseErrors.join('. '))
        return
      }

      setFilename(file.name)
      setRowCount(result.rows.length)
      setCsvData({
        file,
        rows: result.rows,
        validCount: result.validCount,
        invalidCount: result.invalidCount,
        parseErrors: result.parseErrors,
        duplicateImages: result.duplicateImages,
      })
    },
    [setCsvData],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: CSV_ACCEPT,
    maxFiles: 1,
    multiple: false,
  })

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background tabular-nums">
            1
          </span>
          <h3 className="text-[13px] font-semibold">CSV Application Data</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={downloadCsvTemplate}
        >
          <Download className="size-3" />
          Template
        </Button>
      </div>

      <div
        {...getRootProps()}
        className={`group flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed p-6 transition-[border-color,background-color,box-shadow] duration-200 ease-out ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : error
              ? 'border-destructive/40 bg-destructive/5'
              : filename
                ? 'border-primary/40 bg-primary/[0.03]'
                : 'border-muted-foreground/20 bg-muted/30 hover:border-muted-foreground/30 hover:bg-muted/50'
        }`}
      >
        <input {...getInputProps()} />

        {filename ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <FileSpreadsheet className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{filename}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {rowCount} {rowCount === 1 ? 'row' : 'rows'} loaded
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-background shadow-sm ring-1 ring-border/60 transition-shadow duration-200 group-hover:shadow">
              <Upload className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {isDragActive
                  ? 'Drop CSV file here'
                  : 'Drop CSV or click to browse'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                One CSV file with application data (max 50 rows)
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
