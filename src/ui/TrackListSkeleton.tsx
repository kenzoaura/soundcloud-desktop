import { Skeleton } from './Skeleton'

export default function TrackListSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-0.5 p-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-[1.75rem_2.75rem_1fr_auto] items-center gap-3 px-3 py-1.5">
          <Skeleton className="h-3 w-3 justify-self-end" />
          <Skeleton className="h-11 w-11" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2.5 w-1/3" />
          </div>
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  )
}
