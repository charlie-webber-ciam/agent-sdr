export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="skeleton h-10 w-10 rounded-lg" />
        <div className="skeleton h-5 w-5 rounded" />
      </div>
      <div className="skeleton h-5 w-3/4 mb-2" />
      <div className="skeleton h-4 w-1/2" />
    </div>
  );
}

export function SkeletonText({ width = 'w-full', className = '' }: { width?: string; className?: string }) {
  return <div className={`skeleton h-4 ${width} ${className}`} />;
}

export function SkeletonStat({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-4 text-center ${className}`}>
      <div className="skeleton h-8 w-16 mx-auto mb-2" />
      <div className="skeleton h-3 w-20 mx-auto" />
    </div>
  );
}

export function SkeletonAccountCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-6 ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="skeleton h-6 w-3/5 mb-2" />
          <div className="skeleton h-4 w-2/5 mb-2" />
          <div className="flex gap-2 mt-2">
            <div className="skeleton h-5 w-14 rounded-full" />
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="skeleton h-6 w-20 rounded-full" />
      </div>
      <div className="skeleton h-4 w-full mb-1" />
      <div className="skeleton h-4 w-4/5 mb-4" />
      <div className="flex items-center justify-between pt-3 border-t border-gray-200">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-3 w-24" />
      </div>
    </div>
  );
}

export function SkeletonProgressBar({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="skeleton h-7 w-48 mb-2" />
          <div className="skeleton h-4 w-64" />
        </div>
        <div className="skeleton h-10 w-32 rounded-lg" />
      </div>
      <div className="skeleton h-3 w-full rounded-full mb-2" />
      <div className="flex justify-between">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-3 w-16" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <div>
        <div className="skeleton h-9 w-48 mb-2" />
        <div className="skeleton h-4 w-80" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
          <div className="skeleton h-5 w-44 mb-2" />
          <div className="skeleton h-4 w-64 mb-4" />
          <div className="space-y-3">
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-20 w-full" />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="skeleton h-5 w-40 mb-2" />
          <div className="skeleton h-4 w-56 mb-4" />
          <div className="space-y-2">
            <div className="skeleton h-9 w-full" />
            <div className="skeleton h-9 w-full" />
            <div className="skeleton h-9 w-full" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="skeleton h-5 w-32 mb-2" />
        <div className="skeleton h-4 w-52 mb-4" />
        <div className="space-y-2">
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-14 w-full" />
          <div className="skeleton h-14 w-full" />
        </div>
      </div>
    </main>
  );
}

export function AccountsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonAccountCard key={i} />
      ))}
    </div>
  );
}

export function AccountDetailSkeleton() {
  return (
    <main className="min-h-screen p-8 max-w-5xl mx-auto">
      <div className="skeleton h-4 w-32 mb-4" />
      <div className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
        <div className="skeleton h-10 w-2/3 mb-3" />
        <div className="skeleton h-5 w-1/3 mb-3" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-8 mb-8">
        <div className="skeleton h-8 w-48 mb-6" />
        <div className="skeleton h-4 w-full mb-2" />
        <div className="skeleton h-4 w-5/6 mb-2" />
        <div className="skeleton h-4 w-4/6" />
      </div>
    </main>
  );
}
