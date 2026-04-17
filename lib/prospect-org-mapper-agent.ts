import { Agent, run, setDefaultOpenAIClient, setTracingDisabled } from '@openai/agents';
import OpenAI from 'openai';

setTracingDisabled(true);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

setDefaultOpenAIClient(openai);

const ORG_MAPPER_MODEL = process.env.ORG_MAPPER_MODEL || 'gpt-5.4';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProspectToClassify {
  id: number;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  department: string | null;
  linkedin_url: string | null;
}

export interface ClassifiedProspect {
  id: number;
  department: string;
  seniority: string;
  icp_fit: boolean;
  icp_reason: string | null;
}

export interface OrgMapperRequest {
  prospects: ProspectToClassify[];
  company_name: string;
  industry: string | null;
}

export interface OrgMapperResult {
  classifications: ClassifiedProspect[];
  summary: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const DEPARTMENTS = [
  'Engineering',
  'Product',
  'Sales',
  'Marketing',
  'HR',
  'Finance',
  'Legal',
  'Operations',
  'IT/Security',
  'Executive',
  'Customer Success',
  'Design',
  'Unknown',
] as const;

export const SENIORITY_LEVELS = [
  'C-Level',
  'VP',
  'Director',
  'Head of',
  'Senior Manager',
  'Manager',
  'Senior IC',
  'IC',
  'Unknown',
] as const;

// ─── System Instructions ────────────────────────────────────────────────────

const SYSTEM_INSTRUCTIONS = `You are an expert at analyzing job titles and organizational roles. Your task is to classify a list of contacts/prospects at a company into:

1. **Department** — which organizational function they belong to
2. **Seniority** — their level in the hierarchy
3. **ICP Fit** — whether they are a good fit for Auth0/Okta CIAM (Customer Identity & Access Management) sales

## Department Classification
Assign exactly ONE of these departments based on the person's title and any available context:
- **Engineering** — Software engineers, developers, architects, DevOps, SRE, QA engineers
- **Product** — Product managers, product owners, product designers
- **Sales** — Sales reps, account executives, business development, revenue
- **Marketing** — Marketing managers, content, demand gen, growth, brand
- **HR** — Human resources, people ops, talent acquisition, recruiting
- **Finance** — CFO, controllers, accounting, FP&A, procurement
- **Legal** — General counsel, legal ops, compliance officers, privacy officers
- **Operations** — COO, operations managers, business operations, supply chain
- **IT/Security** — IT managers, security engineers, CISO, InfoSec, IAM, identity, infrastructure
- **Executive** — CEO, founders, managing directors, general managers (when no clear functional department)
- **Customer Success** — CS managers, support, implementation, professional services
- **Design** — UX, UI, design systems, creative directors
- **Unknown** — Cannot determine from available information

## Seniority Classification
Assign exactly ONE seniority level:
- **C-Level** — CEO, CTO, CIO, CISO, CFO, COO, CPO, CMO, CDO, any "Chief X Officer"
- **VP** — Vice President, SVP, EVP, "VP of X"
- **Director** — Director, Senior Director, Managing Director (when not CEO-equivalent)
- **Head of** — "Head of X", "Lead of X" (functional leaders below director, above senior manager)
- **Senior Manager** — Senior Manager, Principal, Staff (Staff Engineer, Principal Architect)
- **Manager** — Manager, Team Lead, Supervisor
- **Senior IC** — Senior Engineer, Senior Analyst, Senior Consultant, Senior Designer
- **IC** — Engineer, Analyst, Consultant, Associate, Coordinator, Specialist, Representative
- **Unknown** — Cannot determine from available information

## ICP (Ideal Customer Profile) Fit
Auth0/Okta sells identity and access management solutions. The ICP includes people who:
- **ARE ICP**: Software/platform engineers, security engineers, IT/infrastructure leaders, identity/IAM specialists, CISOs, CTOs, CIOs, DevOps/SRE, product managers (for tech products), engineering managers, architects, anyone involved in software development, security, or IT infrastructure decisions
- **NOT ICP**: Mechanical engineers, civil engineers, electrical engineers (hardware), chemical engineers, manufacturing engineers, medical/clinical staff, pure sales/BD without tech oversight, pure HR/recruiting, pure marketing (non-technical), accountants, lawyers (unless privacy/security-focused), facilities/physical operations, administrative assistants

When icp_fit is false, provide a brief reason (e.g., "Mechanical engineering - not software/IT/security").
When in doubt, lean toward icp_fit = true.

## Output Format
Return ONLY valid JSON:
{
  "classifications": [
    {
      "id": 123,
      "department": "Engineering",
      "seniority": "Senior IC",
      "icp_fit": true,
      "icp_reason": null
    },
    {
      "id": 456,
      "department": "Operations",
      "seniority": "Manager",
      "icp_fit": false,
      "icp_reason": "Supply chain operations - not software/IT/security"
    }
  ],
  "summary": "Classified 15 prospects: 12 ICP fit, 3 not ICP. Departments: 5 Engineering, 3 IT/Security, 2 Product, 2 Sales, 1 Executive, 1 Operations, 1 Unknown."
}`;

// ─── Agent Function ─────────────────────────────────────────────────────────

export async function classifyAccountProspects(
  request: OrgMapperRequest
): Promise<OrgMapperResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  if (request.prospects.length === 0) {
    return { classifications: [], summary: 'No prospects to classify.' };
  }

  const agent = new Agent({
    model: ORG_MAPPER_MODEL,
    name: 'Prospect Org Mapper',
    instructions: SYSTEM_INSTRUCTIONS,
    tools: [],
  });

  const prospectList = request.prospects.map(p => {
    const parts = [`ID: ${p.id}`, `Name: ${p.first_name} ${p.last_name}`];
    if (p.title) parts.push(`Title: ${p.title}`);
    if (p.email) parts.push(`Email: ${p.email}`);
    if (p.department) parts.push(`Department: ${p.department}`);
    return parts.join(' | ');
  }).join('\n');

  const prompt = `Classify the following ${request.prospects.length} prospects at ${request.company_name}${request.industry ? ` (industry: ${request.industry})` : ''}.

For each prospect, determine their department, seniority level, and ICP fit for Auth0/Okta CIAM sales.

PROSPECTS:
${prospectList}

Return the classifications as JSON.`;

  console.log(`[OrgMapper] Classifying ${request.prospects.length} prospects for ${request.company_name}`);

  const result = await run(agent, prompt);

  try {
    let responseText = result.finalOutput || '{}';
    console.log(`[OrgMapper] Raw output (first 500 chars): ${responseText.substring(0, 500)}`);

    responseText = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in agent response');

    const parsed = JSON.parse(jsonMatch[0]) as OrgMapperResult;

    if (!Array.isArray(parsed.classifications)) parsed.classifications = [];
    if (!parsed.summary) parsed.summary = `Classified ${parsed.classifications.length} prospects`;

    // Validate and normalize each classification
    const validIds = new Set(request.prospects.map(p => p.id));
    parsed.classifications = parsed.classifications
      .filter(c => validIds.has(c.id))
      .map(c => ({
        id: c.id,
        department: DEPARTMENTS.includes(c.department as any) ? c.department : 'Unknown',
        seniority: SENIORITY_LEVELS.includes(c.seniority as any) ? c.seniority : 'Unknown',
        icp_fit: Boolean(c.icp_fit),
        icp_reason: c.icp_fit ? null : (c.icp_reason || 'Not ICP'),
      }));

    console.log(`[OrgMapper] Classified ${parsed.classifications.length} of ${request.prospects.length} prospects`);

    return parsed;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[OrgMapper] Failed to parse response: ${errMsg}`);
    console.error(`[OrgMapper] Raw output: ${(result.finalOutput || '').substring(0, 500)}`);
    throw new Error(`Failed to classify prospects: ${errMsg}`);
  }
}
