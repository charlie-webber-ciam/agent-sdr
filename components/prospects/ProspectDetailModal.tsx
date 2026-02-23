'use client';

import { useState, useEffect } from 'react';
import type { Prospect } from './ProspectTab';
import ProspectTierBadge from './ProspectTierBadge';
import MarkdownBody from './MarkdownBody';
import TagList from './TagList';

interface StoredEmail {
  id: number;
  subject: string;
  body: string;
  status: string;
  email_type: string;
  created_at: string;
}

interface Props {
  prospect: Prospect | null;
  accountId: number;
  allProspects: Prospect[];
  onClose: () => void;
  onSave: () => void;
  onWriteEmail?: (p: Prospect) => void;
  onViewExisting?: (p: Prospect) => void;
}

const ROLE_OPTIONS = [
  { value: '', label: 'Select role...' },
  { value: 'decision_maker', label: 'Decision Maker' },
  { value: 'champion', label: 'Champion' },
  { value: 'influencer', label: 'Influencer' },
  { value: 'blocker', label: 'Blocker' },
  { value: 'end_user', label: 'End User' },
  { value: 'unknown', label: 'Unknown' },
];

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];

export default function ProspectDetailModal({ prospect, accountId, allProspects, onClose, onSave, onWriteEmail, onViewExisting }: Props) {
  const isCreate = !prospect;
  const [duplicateProspect, setDuplicateProspect] = useState<Prospect | null>(null);
  const [form, setForm] = useState({
    first_name: prospect?.first_name || '',
    last_name: prospect?.last_name || '',
    title: prospect?.title || '',
    department: prospect?.department || '',
    role_type: prospect?.role_type || '',
    email: prospect?.email || '',
    phone: prospect?.phone || '',
    mobile: prospect?.mobile || '',
    linkedin_url: prospect?.linkedin_url || '',
    do_not_call: prospect?.do_not_call || 0,
    mailing_address: prospect?.mailing_address || '',
    relationship_status: prospect?.relationship_status || 'new',
    notes: prospect?.notes || '',
    last_activity_date: prospect?.last_activity_date || '',
    source: prospect?.source || 'manual',
    lead_source: prospect?.lead_source || '',
    description: prospect?.description || '',
    parent_prospect_id: prospect?.parent_prospect_id || '',
    value_tier: prospect?.value_tier || '',
    seniority_level: prospect?.seniority_level || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storedEmails, setStoredEmails] = useState<StoredEmail[]>([]);
  const [emailsCopied, setEmailsCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!prospect) return;
    fetch(`/api/prospects/${prospect.id}/emails`)
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.emails) setStoredEmails(data.emails); })
      .catch(() => {});
  }, [prospect]);

  const handleEmailAction = async (emailId: number, status: string) => {
    try {
      await fetch(`/api/prospects/${prospect?.id || 0}/emails/${emailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setStoredEmails(prev => prev.map(e => e.id === emailId ? { ...e, status } : e));
    } catch { /* ignore */ }
  };

  const copyEmail = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setEmailsCopied(id);
    setTimeout(() => setEmailsCopied(null), 2000);
  };

  const update = (field: string, value: any) => setForm(f => ({ ...f, [field]: value }));

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) {
      setError('First name and last name are required');
      return;
    }

    setSaving(true);
    setError(null);
    setDuplicateProspect(null);

    try {
      const body = {
        ...form,
        parent_prospect_id: form.parent_prospect_id ? Number(form.parent_prospect_id) : null,
        role_type: form.role_type || null,
      };

      const url = isCreate
        ? `/api/accounts/${accountId}/prospects`
        : `/api/accounts/${accountId}/prospects/${prospect.id}`;

      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        if (isCreate && res.status === 409 && data.existingProspect) {
          setDuplicateProspect(data.existingProspect as Prospect);
          return;
        }
        throw new Error(data.error || 'Failed to save');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const parentOptions = allProspects.filter(p => !prospect || p.id !== prospect.id);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h3 className="text-lg font-semibold text-gray-900">
            {isCreate ? 'Add Prospect' : `Edit ${prospect.first_name} ${prospect.last_name}`}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          {duplicateProspect && (
            <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg text-sm flex items-start justify-between gap-3">
              <span>
                A prospect named <strong>{duplicateProspect.first_name} {duplicateProspect.last_name}</strong> already exists for this account.
              </span>
              {onViewExisting && (
                <button
                  onClick={() => onViewExisting(duplicateProspect)}
                  className="shrink-0 text-yellow-700 underline hover:text-yellow-900 font-medium"
                >
                  View existing
                </button>
              )}
            </div>
          )}

          {/* AI Enrichment (edit mode only) */}
          {!isCreate && prospect && (
            <section className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">AI Enrichment</h4>
                <div className="flex items-center gap-2">
                  <ProspectTierBadge tier={prospect.value_tier} size="md" />
                  {prospect.call_count > 0 && (
                    <span className="text-xs text-gray-500">
                      {prospect.call_count} calls / {prospect.connect_count} connects
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Value Tier</label>
                  <select value={form.value_tier || ''} onChange={e => update('value_tier', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Unassigned</option>
                    <option value="HVT">HVT</option>
                    <option value="MVT">MVT</option>
                    <option value="LVT">LVT</option>
                    <option value="no_longer_with_company">Left Company</option>
                    <option value="recently_changed_roles">Role Change</option>
                    <option value="gatekeeper">Gatekeeper</option>
                    <option value="technical_evaluator">Tech Evaluator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Seniority</label>
                  <select value={form.seniority_level || ''} onChange={e => update('seniority_level', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Unknown</option>
                    <option value="c_suite">C-Suite</option>
                    <option value="vp">VP</option>
                    <option value="director">Director</option>
                    <option value="manager">Manager</option>
                    <option value="individual_contributor">IC</option>
                  </select>
                </div>
              </div>
              {prospect.ai_summary && (
                <div className="text-sm text-gray-700 bg-white rounded p-2 max-h-32 overflow-y-auto">
                  <MarkdownBody>{prospect.ai_summary}</MarkdownBody>
                </div>
              )}
              {prospect.prospect_tags && (
                <div className="mt-2">
                  <TagList tagsJson={prospect.prospect_tags} />
                </div>
              )}
            </section>
          )}

          {/* Stored Emails */}
          {!isCreate && prospect && storedEmails.length > 0 && (
            <section className="bg-purple-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                Generated Emails ({storedEmails.length})
              </h4>
              <div className="space-y-2">
                {storedEmails.map(email => (
                  <div key={email.id} className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                          email.status === 'sent' ? 'bg-green-100 text-green-700' :
                          email.status === 'archived' ? 'bg-gray-100 text-gray-500' :
                          'bg-blue-100 text-blue-700'
                        }`}>{email.status}</span>
                        <span className="text-xs text-gray-400">{email.email_type}</span>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => copyEmail(`Subject: ${email.subject}\n\n${email.body}`, `modal-${email.id}`)}
                          className="px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 rounded font-medium"
                        >
                          {emailsCopied === `modal-${email.id}` ? 'Copied!' : 'Copy'}
                        </button>
                        {email.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleEmailAction(email.id, 'sent')}
                              className="px-2 py-0.5 text-xs text-green-600 hover:bg-green-50 rounded"
                            >
                              Mark Sent
                            </button>
                            <button
                              onClick={() => handleEmailAction(email.id, 'archived')}
                              className="px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50 rounded"
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Subject: {email.subject}</p>
                    <div className="text-xs text-gray-600 bg-gray-50 rounded p-2 whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {email.body}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Basic */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Basic Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">First Name *</label>
                <input value={form.first_name} onChange={e => update('first_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Name *</label>
                <input value={form.last_name} onChange={e => update('last_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
                <input value={form.title} onChange={e => update('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Department</label>
                <input value={form.department} onChange={e => update('department', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Role Type</label>
                <select value={form.role_type} onChange={e => update('role_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Contact</h4>
            <div className="grid grid-cols-2 gap-4">
              {!isCreate && prospect?.sfdc_id && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-1">Salesforce</label>
                  <a
                    href={`https://okta.lightning.force.com/lightning/r/${prospect.sfdc_id}/view`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    <span>{prospect.sfdc_id}</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => update('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
                <input value={form.phone} onChange={e => update('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Mobile</label>
                <input value={form.mobile} onChange={e => update('mobile', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">LinkedIn URL</label>
                <input value={form.linkedin_url} onChange={e => update('linkedin_url', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.do_not_call === 1}
                    onChange={e => update('do_not_call', e.target.checked ? 1 : 0)}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500" />
                  Do Not Call
                </label>
              </div>
            </div>
          </section>

          {/* Address */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Address</h4>
            <textarea value={form.mailing_address} onChange={e => update('mailing_address', e.target.value)}
              rows={2} placeholder="Mailing address"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </section>

          {/* Engagement */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Engagement</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Relationship Status</label>
                <select value={form.relationship_status} onChange={e => update('relationship_status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Last Activity Date</label>
                <input type="date" value={form.last_activity_date} onChange={e => update('last_activity_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </section>

          {/* Meta */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Meta</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Source</label>
                <span className="inline-block px-3 py-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
                  {form.source.replace(/_/g, ' ')}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Lead Source</label>
                <input value={form.lead_source} onChange={e => update('lead_source', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
                <textarea value={form.description} onChange={e => update('description', e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {!isCreate && prospect?.campaign_name && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Campaign Name</label>
                  <span className="inline-block px-3 py-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
                    {prospect.campaign_name}
                  </span>
                </div>
              )}
              {!isCreate && prospect?.member_status && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Member Status</label>
                  <span className="inline-block px-3 py-2 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
                    {prospect.member_status}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* Hierarchy */}
          <section>
            <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">Hierarchy</h4>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Reports To</label>
              <select value={form.parent_prospect_id} onChange={e => update('parent_prospect_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">None (top level)</option>
                {parentOptions.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}{p.title ? ` - ${p.title}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          {!isCreate && prospect && onWriteEmail && (
            <button
              onClick={() => onWriteEmail(prospect)}
              className="px-4 py-2 text-sm font-medium text-purple-700 border border-purple-300 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Write Email
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Saving...' : isCreate ? 'Create Prospect' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
