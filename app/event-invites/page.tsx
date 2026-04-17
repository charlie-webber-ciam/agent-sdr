'use client';

import EventInvitationWriter from '@/components/EventInvitationWriter';

export default function EventInvitesPage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Event Invitation Writer</h1>
        <p className="text-sm text-gray-600">
          Generate personalised event invitations using live company research or saved account context.
        </p>
      </div>

      <EventInvitationWriter />
    </main>
  );
}
