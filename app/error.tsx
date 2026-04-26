'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md items-center justify-center px-4 py-24">
      <Card>
        <CardContent className="py-14 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred.'}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={reset} variant="outline">
              Try again
            </Button>
            <Button asChild>
              <Link href="/">Back to Dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
