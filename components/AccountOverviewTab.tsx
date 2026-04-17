'use client';

import { useEffect, useState } from 'react';
import AccountNotes from '@/components/AccountNotes';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AccountOverviewRecord,
  Auth0ValueDriver,
  BusinessStructureItem,
  TechStackItem,
  createBlankBusinessStructureItem,
  createBlankTechStackItem,
  createBlankTrigger,
  createBlankValueDriver,
  hasMeaningfulOverviewContent,
  hasMeaningfulPov,
  normalizeOverviewInput,
  normalizeOverviewRecord,
} from '@/lib/account-overview';
import { AlertCircle, BarChart3, BookOpen, Building2, Clock, Cpu, FileText, Loader2, RotateCcw, Save, Sparkles, Users, Zap } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import OverviewHeader from '@/components/overview/OverviewHeader';
import OverviewActionBar from '@/components/overview/OverviewActionBar';
import PrioritiesSection from '@/components/overview/PrioritiesSection';
import ValueDriversSection from '@/components/overview/ValueDriversSection';
import TriggersSection from '@/components/overview/TriggersSection';
import BusinessModelSection from '@/components/overview/BusinessModelSection';
import BusinessStructureSection from '@/components/overview/BusinessStructureSection';
import TechStackSection from '@/components/overview/TechStackSection';
import KeyPeopleSection from '@/components/overview/KeyPeopleSection';
import DocumentsSection from '@/components/overview/DocumentsSection';
import StrategicPovSection from '@/components/overview/StrategicPovSection';
import AgentsSection from '@/components/overview/AgentsSection';

type KeyPerson = {
  id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  department: string | null;
  notes: string | null;
  role_type: 'decision_maker' | 'champion' | 'influencer' | 'blocker' | 'end_user' | 'unknown' | null;
  relationship_status: 'new' | 'engaged' | 'warm' | 'cold';
  source: 'manual' | 'salesforce_import' | 'ai_research';
  updated_at: string;
};

type Note = {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type AccountDocument = {
  id: number;
  filename: string;
  mimeType: string | null;
  fileSizeBytes: number;
  processingStatus: 'processing' | 'ready' | 'failed';
  extractionError: string | null;
  contextMarkdown: string | null;
  uploadedAt: string;
  updatedAt: string;
  downloadUrl: string;
};

interface AccountOverviewTabProps {
  accountId: number;
  accountName: string;
  overview: AccountOverviewRecord;
  notes: Note[];
  documents: AccountDocument[];
  keyPeople: KeyPerson[];
  onNotesChange: (notes: Note[]) => void;
  onRefresh: () => Promise<void>;
  onOpenProspects: () => void;
}

function getTabCompletion(draft: AccountOverviewRecord) {
  const prioritiesFilled = draft.priorities.filter((p) => p.title.trim()).length;
  const driversFilled = draft.valueDrivers.length;
  const triggersFilled = draft.triggers.length;
  const hasBizModel = draft.businessModelMarkdown.trim().length > 0;
  const structureCount = draft.businessStructure.length;
  const techCount = draft.techStack.length;
  const hasPov = draft.povMarkdown.trim().length > 0;

  return {
    priorities: `${prioritiesFilled}/5`,
    drivers: `${driversFilled}/3`,
    triggers: `${triggersFilled}/2`,
    businessContext: `${(hasBizModel ? 1 : 0) + (structureCount > 0 ? 1 : 0) + (techCount > 0 ? 1 : 0)}/3`,
    pov: hasPov ? '1/1' : '0/1',
  };
}

export default function AccountOverviewTab({
  accountId,
  accountName,
  overview,
  notes,
  documents,
  keyPeople,
  onNotesChange,
  onRefresh,
  onOpenProspects,
}: AccountOverviewTabProps) {
  const [draft, setDraft] = useState<AccountOverviewRecord>(normalizeOverviewRecord(overview));
  const [saving, setSaving] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [generatingPov, setGeneratingPov] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingPerson, setAddingPerson] = useState(false);
  const [personError, setPersonError] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [uploadingDocuments, setUploadingDocuments] = useState(false);
  const [removingDocumentId, setRemovingDocumentId] = useState<number | null>(null);

  useEffect(() => {
    setDraft(normalizeOverviewRecord(overview));
  }, [overview]);

  const normalizedDraft = normalizeOverviewInput(draft);
  const normalizedOverview = normalizeOverviewInput(overview);
  const isDirty = JSON.stringify(normalizedDraft) !== JSON.stringify(normalizedOverview);
  const completion = getTabCompletion(draft);

  // --- API handlers ---

  const saveOverview = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${accountId}/overview`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedDraft),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save overview');
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save overview');
    } finally {
      setSaving(false);
    }
  };

  const generateDraft = async () => {
    const hasExisting = hasMeaningfulOverviewContent(normalizedDraft);
    if (hasExisting) {
      const confirmed = window.confirm('Generating a new draft will overwrite the current overview sections. Continue?');
      if (!confirmed) return;
    }
    setGeneratingDraft(true);
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${accountId}/overview/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite: hasExisting }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate overview draft');
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate overview draft');
    } finally {
      setGeneratingDraft(false);
    }
  };

  const generatePov = async () => {
    if (isDirty) {
      setError('Save overview changes before generating the strategic POV.');
      return;
    }
    const hasExisting = hasMeaningfulPov(draft);
    if (hasExisting) {
      const confirmed = window.confirm('Generating a new strategic POV will overwrite the current POV. Continue?');
      if (!confirmed) return;
    }
    setGeneratingPov(true);
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${accountId}/overview/pov/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overwrite: hasExisting }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate strategic POV');
      await onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate strategic POV');
    } finally {
      setGeneratingPov(false);
    }
  };

  const addKeyPerson = async (form: {
    first_name: string;
    last_name: string;
    title: string;
    role_type: string;
    department: string;
    email: string;
    linkedin_url: string;
    notes: string;
  }) => {
    setPersonError(null);
    setAddingPerson(true);
    try {
      const response = await fetch(`/api/accounts/${accountId}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          title: form.title.trim() || undefined,
          department: form.department.trim() || undefined,
          email: form.email.trim() || undefined,
          linkedin_url: form.linkedin_url.trim() || undefined,
          notes: form.notes.trim() || undefined,
          source: 'manual',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to add key person');
      await onRefresh();
    } catch (e) {
      setPersonError(e instanceof Error ? e.message : 'Failed to add key person');
    } finally {
      setAddingPerson(false);
    }
  };

  const uploadDocumentsHandler = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingDocuments(true);
    setDocumentError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
      const response = await fetch(`/api/accounts/${accountId}/documents`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to upload PDFs');
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        setDocumentError(data.errors.join(' '));
      }
      await onRefresh();
    } catch (e) {
      setDocumentError(e instanceof Error ? e.message : 'Failed to upload PDFs');
    } finally {
      setUploadingDocuments(false);
    }
  };

  const removeDocument = async (documentId: number) => {
    const confirmed = window.confirm('Remove this PDF from the account context? Future generations will stop using it.');
    if (!confirmed) return;
    setRemovingDocumentId(documentId);
    setDocumentError(null);
    try {
      const response = await fetch(`/api/accounts/${accountId}/documents/${documentId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to remove PDF');
      await onRefresh();
    } catch (e) {
      setDocumentError(e instanceof Error ? e.message : 'Failed to remove PDF');
    } finally {
      setRemovingDocumentId(null);
    }
  };

  // --- Draft updaters ---

  const updatePriority = (rank: number, field: 'title' | 'rationale' | 'evidence', value: string) => {
    setDraft((current) => ({
      ...current,
      priorities: current.priorities.map((p) => (p.rank === rank ? { ...p, [field]: value } : p)),
    }));
  };

  const updateValueDriver = (index: number, field: 'driver' | 'rationale' | 'evidence', value: string) => {
    setDraft((current) => ({
      ...current,
      valueDrivers: current.valueDrivers.map((d, i) =>
        i === index ? { ...d, [field]: field === 'driver' ? (value as Auth0ValueDriver) : value } : d
      ),
    }));
  };

  const updateTrigger = (index: number, field: 'title' | 'detail' | 'source' | 'dateLabel', value: string) => {
    setDraft((current) => ({
      ...current,
      triggers: current.triggers.map((t, i) => (i === index ? { ...t, [field]: value } : t)),
    }));
  };

  const updateBusinessStructure = (index: number, field: keyof BusinessStructureItem, value: string | string[]) => {
    setDraft((current) => ({
      ...current,
      businessStructure: current.businessStructure.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  const updateTechStack = (index: number, field: keyof TechStackItem, value: string) => {
    setDraft((current) => ({
      ...current,
      techStack: current.techStack.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }));
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Sticky Header */}
      <Card className="border-border/70 bg-gradient-to-br from-card to-muted/20 shadow-sm">
        <CardContent className="p-5">
          <OverviewHeader
            accountName={accountName}
            isDirty={isDirty}
            generatedAt={overview.generatedAt}
            povGeneratedAt={overview.povGeneratedAt}
            lastEditedAt={overview.lastEditedAt}
            documentCount={documents.length}
          />

          {/* Action buttons row */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(normalizeOverviewRecord(overview))}
              disabled={!isDirty || saving || generatingDraft}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={generateDraft}
              disabled={saving || generatingDraft || generatingPov}
            >
              {generatingDraft ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Generating draft...
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {hasMeaningfulOverviewContent(overview) ? 'Regenerate Draft' : 'Generate Draft'}
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={saveOverview}
              disabled={!isDirty || saving || generatingDraft || generatingPov}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save Overview
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="priorities" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="priorities" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Priorities</span>
            <Badge variant="outline" className="ml-0.5 h-4 px-1 text-[9px] font-medium">{completion.priorities}</Badge>
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Business</span>
            <Badge variant="outline" className="ml-0.5 h-4 px-1 text-[9px] font-medium">{completion.businessContext}</Badge>
          </TabsTrigger>
          <TabsTrigger value="people" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">People</span>
            <Badge variant="outline" className="ml-0.5 h-4 px-1 text-[9px] font-medium">{keyPeople.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pov" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">POV</span>
            <Badge variant="outline" className="ml-0.5 h-4 px-1 text-[9px] font-medium">{completion.pov}</Badge>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Docs</span>
            <Badge variant="outline" className="ml-0.5 h-4 px-1 text-[9px] font-medium">{documents.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="agents" className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Agents</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Priorities & Value */}
        <TabsContent value="priorities" className="space-y-5">
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <PrioritiesSection
                priorities={draft.priorities}
                onUpdate={updatePriority}
              />
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <ValueDriversSection
                  valueDrivers={draft.valueDrivers}
                  onUpdate={updateValueDriver}
                  onAdd={() => setDraft((c) => ({ ...c, valueDrivers: [...c.valueDrivers, createBlankValueDriver()] }))}
                  onRemove={(index) => setDraft((c) => ({ ...c, valueDrivers: c.valueDrivers.filter((_, i) => i !== index) }))}
                />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-5">
                <TriggersSection
                  triggers={draft.triggers}
                  onUpdate={updateTrigger}
                  onAdd={() => setDraft((c) => ({ ...c, triggers: [...c.triggers, createBlankTrigger()] }))}
                  onRemove={(index) => setDraft((c) => ({ ...c, triggers: c.triggers.filter((_, i) => i !== index) }))}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Business Context */}
        <TabsContent value="business" className="space-y-5">
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <BusinessModelSection
                value={draft.businessModelMarkdown}
                onChange={(value) => setDraft((c) => ({ ...c, businessModelMarkdown: value }))}
              />
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card className="shadow-sm">
              <CardContent className="p-5">
                <BusinessStructureSection
                  items={draft.businessStructure}
                  onUpdate={updateBusinessStructure}
                  onAdd={() => setDraft((c) => ({ ...c, businessStructure: [...c.businessStructure, createBlankBusinessStructureItem()] }))}
                  onRemove={(index) => setDraft((c) => ({ ...c, businessStructure: c.businessStructure.filter((_, i) => i !== index) }))}
                />
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="p-5">
                <TechStackSection
                  items={draft.techStack}
                  onUpdate={updateTechStack}
                  onAdd={() => setDraft((c) => ({ ...c, techStack: [...c.techStack, createBlankTechStackItem()] }))}
                  onRemove={(index) => setDraft((c) => ({ ...c, techStack: c.techStack.filter((_, i) => i !== index) }))}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 3: People */}
        <TabsContent value="people">
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <KeyPeopleSection
                keyPeople={keyPeople}
                onAddPerson={addKeyPerson}
                onOpenProspects={onOpenProspects}
                addingPerson={addingPerson}
                personError={personError}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Timeline & POV */}
        <TabsContent value="pov" className="space-y-5">
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <StrategicPovSection
                value={draft.povMarkdown}
                onChange={(value) => setDraft((c) => ({ ...c, povMarkdown: value }))}
                onGeneratePov={generatePov}
                generatingPov={generatingPov}
                saving={saving}
                generatingDraft={generatingDraft}
                isDirty={isDirty}
                hasPov={hasMeaningfulPov(overview)}
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-5">
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Timeline</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Account-wide notes and internal context.
                  </p>
                </div>
                <ScrollArea className="max-h-[400px]">
                  <AccountNotes accountId={accountId} notes={notes} onNotesChange={onNotesChange} />
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Documents */}
        <TabsContent value="documents">
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <DocumentsSection
                documents={documents}
                onUpload={uploadDocumentsHandler}
                onRemove={removeDocument}
                uploadingDocuments={uploadingDocuments}
                removingDocumentId={removingDocumentId}
                documentError={documentError}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" forceMount className="data-[state=inactive]:hidden">
          <Card className="shadow-sm">
            <CardContent className="p-5">
              <AgentsSection
                accountId={accountId}
                accountName={accountName}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky Action Bar */}
      <OverviewActionBar
        isDirty={isDirty}
        saving={saving}
        generatingDraft={generatingDraft}
        generatingPov={generatingPov}
        hasExistingContent={hasMeaningfulOverviewContent(overview)}
        onReset={() => setDraft(normalizeOverviewRecord(overview))}
        onGenerateDraft={generateDraft}
        onSave={saveOverview}
      />
    </div>
  );
}
