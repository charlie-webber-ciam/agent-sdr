import { getJob, getJobEventsSince } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const jobIdNum = parseInt(jobId);

  if (isNaN(jobIdNum)) {
    return new Response('Invalid job ID', { status: 400 });
  }

  const lastEventIdHeader = request.headers.get('Last-Event-ID');
  let sinceId = lastEventIdHeader ? parseInt(lastEventIdHeader) : 0;
  if (isNaN(sinceId)) sinceId = 0;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Immediately replay any historical/missed events
      try {
        const past = getJobEventsSince(jobIdNum, 'processing', sinceId);
        for (const evt of past) {
          controller.enqueue(encoder.encode(`id: ${evt.id}\ndata: ${JSON.stringify(evt)}\n\n`));
          sinceId = evt.id;
        }

        // Check if job is already done
        const initialJob = getJob(jobIdNum);
        if (initialJob && initialJob.status !== 'processing' && initialJob.status !== 'pending') {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ event_type: 'job_done', status: initialJob.status })}\n\n`
          ));
          controller.close();
          return;
        }
      } catch (err) {
        console.error('[SSE] Error replaying events:', err);
      }

      // Poll every 500ms for new events
      const timer = setInterval(() => {
        try {
          const newEvts = getJobEventsSince(jobIdNum, 'processing', sinceId);
          for (const evt of newEvts) {
            controller.enqueue(encoder.encode(`id: ${evt.id}\ndata: ${JSON.stringify(evt)}\n\n`));
            sinceId = evt.id;
          }

          const job = getJob(jobIdNum);
          if (job && job.status !== 'processing' && job.status !== 'pending') {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ event_type: 'job_done', status: job.status })}\n\n`
            ));
            clearInterval(timer);
            controller.close();
          }
        } catch (err) {
          console.error('[SSE] Poll error:', err);
          clearInterval(timer);
          try { controller.close(); } catch {}
        }
      }, 500);

      request.signal?.addEventListener('abort', () => {
        clearInterval(timer);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
