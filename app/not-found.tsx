import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md items-center justify-center px-4 py-24">
      <Card>
        <CardContent className="py-14 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The page you are looking for does not exist or has been moved.
          </p>
          <Button asChild className="mt-6">
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
