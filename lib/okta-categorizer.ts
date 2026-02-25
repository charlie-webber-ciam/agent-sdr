import { Account } from './db';
import OpenAI from 'openai';
import { logDetailedError } from './error-logger';
import { resolveAndUpdateDomain } from './domain-resolver';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// OktaPatch type — must stay in sync with perspective-context.tsx
export type OktaPatch = 'emerging' | 'crp' | 'ent' | 'stg' | 'pubsec';

// Use case to Okta SKU mapping
const USE_CASE_TO_SKU: Record<string, string[]> = {
  'Single Sign-On (SSO)': ['Workforce Identity Cloud'],
  'Multi-Factor Authentication (MFA)': ['Workforce Identity Cloud'],
  'Adaptive MFA': ['Workforce Identity Cloud'],
  'Passwordless/Passkeys': ['Workforce Identity Cloud'],
  'Universal Directory': ['Workforce Identity Cloud'],
  'User Lifecycle Management': ['Workforce Identity Cloud'],
  'API Access Management': ['Workforce Identity Cloud'],
  'Device Access': ['Workforce Identity Cloud'],
  'Access Gateway': ['Workforce Identity Cloud'],
  'Identity Governance': ['Identity Governance'],
  'Access Certifications': ['Identity Governance'],
  'Access Requests': ['Identity Governance'],
  'IGA (Identity Governance & Administration)': ['Identity Governance'],
  'Segregation of Duties': ['Identity Governance'],
  'Privileged Access Management (PAM)': ['Privileged Access'],
  'Database PAM': ['Privileged Access'],
  'Kubernetes PAM': ['Privileged Access'],
  'Identity Security Posture Management (ISPM)': ['Identity Threat Protection'],
  'Identity Threat Protection': ['Identity Threat Protection'],
  'Okta Workflows': ['Workforce Identity Cloud'],
  'AI Agent Identity': ['Okta for AI Agents'],
  'M&A Identity Integration': ['Workforce Identity Cloud', 'Identity Governance'],
  'Zero Trust Architecture': ['Workforce Identity Cloud', 'Identity Threat Protection'],
};

// --- Scoring dimension definition ---

export interface ScoringDimension {
  name: string;
  maxPoints: number;
  topBandSignals: string[];   // what earns 80-100% of max
  lowBandSignals: string[];   // what earns 0-20% of max
}

// --- Patch-specific configuration ---

interface PatchConfig {
  label: string;
  headcountRange: string;
  tierA: {
    arrMin: string;
    employeeMin: string;
    triggers: string[];
    description: string;
  };
  tierB: {
    arrRange: string;
    employeeRange: string;
    description: string;
  };
  tierC: {
    arrMax: string;
    employeeMax: string;
    description: string;
  };
  entryProducts: string[];
  acvRange: string;
  decisionMakers: string[];
  topCompetitors: string[];
  priorityNotes: string;
  // New scoring framework fields
  scoringDimensions: ScoringDimension[];
  tierThresholds: {
    A: { min: number; max: number };
    B: { min: number; max: number };
    C: { min: number; max: number };
    DQ?: { min: number; max: number };
  };
  icpDefinition: string;
  qualifyingQuestions: string[];
}

// --- Scoring dimensions per patch ---

function buildScoringDimensions(patch: OktaPatch): ScoringDimension[] {
  const weights: Record<OktaPatch, number[]> = {
    //                    IdInfra  TechEnv  SecComp  OrgCplx  BuySig   CompPos  StratVal
    emerging:            [15,      15,      20,      20,      20,      5,       5],
    crp:                 [20,      15,      20,      15,      15,      10,      5],
    ent:                 [20,      15,      20,      15,      15,      10,      5],
    stg:                 [20,      10,      20,      20,      15,      10,      5],
    pubsec:              [20,      10,      25,      10,      20,      10,      5],
  };

  const w = weights[patch];

  const dimensions: ScoringDimension[] = [
    {
      name: 'Identity Infrastructure Maturity',
      maxPoints: w[0],
      topBandSignals: [
        'Legacy/fragmented IAM (on-prem AD only, no SSO/MFA)',
        'Active IAM platform evaluation or RFP',
        'Known pain with current vendor (outages, gaps)',
      ],
      lowBandSignals: [
        'Already on modern IAM platform with high satisfaction',
        'Recently signed multi-year IAM contract',
      ],
    },
    {
      name: 'Technology Environment',
      maxPoints: w[1],
      topBandSignals: [
        'Multi-cloud or hybrid cloud environment',
        'Active cloud migration or AD consolidation',
        'High SaaS sprawl (100+ apps)',
      ],
      lowBandSignals: [
        'Single-cloud Microsoft-only shop',
        'Minimal SaaS adoption, on-prem only',
      ],
    },
    {
      name: 'Security & Compliance Pressure',
      maxPoints: w[2],
      topBandSignals: patch === 'pubsec'
        ? [
            'ASD Essential Eight gaps (especially MFA maturity)',
            'ISM classification requirements, PSPF obligations',
            'Recent audit findings or security incidents',
            'APRA CPS 234 / CPS 230 compliance deadlines',
          ]
        : [
            'Recent breach or security incident',
            'Active compliance deadline (APRA CPS 234, Essential Eight, SOX)',
            'Board-level security mandate or Zero Trust program',
          ],
      lowBandSignals: patch === 'pubsec'
        ? [
            'Already at Essential Eight Maturity Level 3',
            'No compliance gaps identified',
          ]
        : [
            'No compliance requirements or security pressure',
            'Mature security posture with no gaps',
          ],
    },
    {
      name: 'Org Complexity & Growth',
      maxPoints: w[3],
      topBandSignals: [
        'Recent M&A requiring identity consolidation',
        'Rapid headcount growth (>30% YoY)',
        'Multi-entity / subsidiary complexity',
        'Large contractor/partner workforce',
      ],
      lowBandSignals: [
        'Stable headcount, single entity',
        'No M&A activity, simple org structure',
      ],
    },
    {
      name: 'Buying Signals & Budget',
      maxPoints: w[4],
      topBandSignals: patch === 'pubsec'
        ? [
            'Active tender or panel arrangement for IAM',
            'MYEFO/PAES budget allocation for cyber/identity',
            'New CISO/CIO driving vendor evaluation',
            'Funded security uplift program',
          ]
        : [
            'Active RFP or vendor evaluation',
            'Recent significant funding or strong revenue growth',
            'New CISO/CIO driving change',
            'Budget allocated for identity modernisation',
          ],
      lowBandSignals: patch === 'pubsec'
        ? [
            'No current procurement activity',
            'Budget constrained, no cyber allocation',
          ]
        : [
            'No budget signals or procurement activity',
            'Cost-cutting mode, vendor consolidation away from best-of-breed',
          ],
    },
    {
      name: 'Competitive Position',
      maxPoints: w[5],
      topBandSignals: [
        'Current IAM vendor contract expiring within 12 months',
        'Dissatisfaction with existing vendor (Entra, Ping, etc.)',
        'Greenfield — no incumbent IAM platform',
      ],
      lowBandSignals: [
        'Deeply embedded with Microsoft Entra + E5 licensing',
        'Recently renewed with competitor on multi-year deal',
      ],
    },
    {
      name: 'Strategic Value',
      maxPoints: w[6],
      topBandSignals: [
        'Marquee brand / reference account potential',
        'Industry leader that would drive peer adoption',
        'Existing Okta/Auth0 footprint to expand',
      ],
      lowBandSignals: [
        'Low brand recognition, limited reference value',
        'No strategic alignment',
      ],
    },
  ];

  return dimensions;
}

export const PATCH_CONFIGS: Record<OktaPatch, PatchConfig> = {
  emerging: {
    label: 'Emerging',
    headcountRange: '<300 employees',
    tierA: {
      arrMin: '$30K',
      employeeMin: '150',
      triggers: [
        'SOC 2 or compliance certification in progress',
        'Recent funding round ($5M+)',
        'Rapid hiring (doubling headcount)',
        'First dedicated IT/security hire',
        'Moving off consumer-grade tools (Google Workspace SSO, shared passwords)',
        'First enterprise customer requiring SSO/SAML',
        'Regulatory requirement (HIPAA, SOX for fintech)',
        'Remote-first workforce scaling challenges',
      ],
      description: 'Fast-growing startup with $30K+ ARR potential, 150+ employees, and at least 2 near-term buying triggers. High likelihood to purchase within 6-9 months.',
    },
    tierB: {
      arrRange: '$10K-$30K',
      employeeRange: '50-150',
      description: 'Early-stage company with moderate growth. Some IAM needs but no urgent triggers. Likely 9-18 month sales cycle.',
    },
    tierC: {
      arrMax: '$10K',
      employeeMax: '50',
      description: 'Very early stage, <50 employees, limited budget. Free/low-cost solutions more appropriate. Long timeline.',
    },
    entryProducts: ['SSO', 'MFA'],
    acvRange: '$10K-$50K',
    decisionMakers: ['CTO', 'CEO', 'VP Engineering'],
    topCompetitors: ['JumpCloud', 'Microsoft Entra', 'Google Workspace'],
    priorityNotes: 'For Emerging patch: SOC 2 timelines and first enterprise deals are the strongest triggers.',
    scoringDimensions: buildScoringDimensions('emerging'),
    tierThresholds: {
      A: { min: 75, max: 100 },
      B: { min: 50, max: 74 },
      C: { min: 25, max: 49 },
      DQ: { min: 0, max: 24 },
    },
    icpDefinition: 'Fast-growing ANZ startups (Series A-C) with 50-300 employees, scaling past consumer-grade auth tools, facing first compliance audit or enterprise customer SSO requirement.',
    qualifyingQuestions: [
      'Have you started a SOC 2 or ISO 27001 certification process?',
      'Are enterprise customers asking for SSO/SAML support?',
      'How are you managing employee onboarding/offboarding today?',
      'What happens to app access when someone leaves?',
    ],
  },
  crp: {
    label: 'Corporate',
    headcountRange: '300-1,250 employees',
    tierA: {
      arrMin: '$75K',
      employeeMin: '800',
      triggers: [
        'M&A activity creating identity consolidation needs',
        'New CISO or CIO driving change',
        'HRIS modernization (Workday/SAP migration) requiring lifecycle automation',
        'Cloud migration (Azure AD/Entra hybrid pain)',
        'Failed or stalled identity project needing rescue',
        'Compliance mandate (SOX, GDPR, industry-specific)',
        'Active RFP or vendor evaluation for IAM',
        'Growing contractor/partner workforce needing access management',
      ],
      description: 'Mid-market company with $75K+ ARR potential, 800+ employees, and at least 2 near-term buying triggers. Multi-product opportunity.',
    },
    tierB: {
      arrRange: '$30K-$75K',
      employeeRange: '500-800',
      description: 'Solid mid-market company with IAM needs but no urgent catalyst. Good fit for SSO + MFA bundle. 12-18 month cycle.',
    },
    tierC: {
      arrMax: '$30K',
      employeeMax: '500',
      description: 'Smaller corporate, limited IAM complexity. Basic SSO needs. May not justify full Okta investment.',
    },
    entryProducts: ['SSO', 'MFA', 'Lifecycle Management'],
    acvRange: '$30K-$150K',
    decisionMakers: ['CISO', 'IT Director', 'VP IT'],
    topCompetitors: ['Microsoft Entra', 'Ping Identity', 'SailPoint'],
    priorityNotes: 'For Corporate patch: M&A and new security leadership are the strongest triggers.',
    scoringDimensions: buildScoringDimensions('crp'),
    tierThresholds: {
      A: { min: 75, max: 100 },
      B: { min: 50, max: 74 },
      C: { min: 25, max: 49 },
    },
    icpDefinition: 'ANZ mid-market companies (300-1,250 employees) with growing IT complexity, typically post-M&A or mid-cloud migration, needing unified identity across SSO, lifecycle management, and basic governance.',
    qualifyingQuestions: [
      'How are you handling identity for acquired companies or subsidiaries?',
      'Are you migrating off on-prem AD to cloud identity?',
      'Who manages joiner/mover/leaver processes today?',
      'Do you have visibility into which apps your employees access?',
    ],
  },
  ent: {
    label: 'Enterprise',
    headcountRange: '1,250-20,000 employees',
    tierA: {
      arrMin: '$500K',
      employeeMin: '5,000',
      triggers: [
        'Security breach or incident creating urgency',
        'Zero Trust initiative with board-level mandate',
        'Active Directory end-of-life or hybrid AD pain',
        'Large-scale cloud transformation (multi-cloud)',
        'M&A requiring identity platform consolidation',
        'Compliance mandate (APRA CPS 234, ASD Essential Eight, PCI-DSS)',
        'Current IAM vendor contract renewal approaching',
        'Digital transformation with workforce modernization',
      ],
      description: 'Large enterprise with $500K+ ARR potential, 5,000+ employees, and at least 2 strong buying triggers. Platform sale with governance and PAM upsell.',
    },
    tierB: {
      arrRange: '$300K-$500K',
      employeeRange: '2,000-5,000',
      description: 'Enterprise with moderate IAM complexity. Good multi-product fit but longer 12-24 month evaluation cycle.',
    },
    tierC: {
      arrMax: '$300K',
      employeeMax: '2,000',
      description: 'Smaller enterprise or limited IAM scope. Single-product deal likely. May be better served by Corporate patch.',
    },
    entryProducts: ['SSO', 'MFA', 'Identity Governance'],
    acvRange: '$300K-$1.5M',
    decisionMakers: ['CISO', 'CIO', 'Procurement'],
    topCompetitors: ['Microsoft Entra', 'SailPoint', 'CyberArk'],
    priorityNotes: 'For Enterprise patch: Security incidents and Zero Trust mandates are the strongest triggers.',
    scoringDimensions: buildScoringDimensions('ent'),
    tierThresholds: {
      A: { min: 75, max: 100 },
      B: { min: 50, max: 74 },
      C: { min: 25, max: 49 },
    },
    icpDefinition: 'Large ANZ enterprises (1,250-20,000 employees) with multi-cloud environments, regulatory compliance pressure (APRA, Essential Eight), and need for unified identity governance, PAM, and Zero Trust architecture.',
    qualifyingQuestions: [
      'Where are you on your Zero Trust journey?',
      'How are you addressing ASD Essential Eight MFA requirements?',
      'Is AD consolidation or cloud migration on your roadmap?',
      'How do you manage privileged access across cloud and on-prem?',
    ],
  },
  stg: {
    label: 'Strategic',
    headcountRange: '20,000+ employees',
    tierA: {
      arrMin: '$2M',
      employeeMin: '30,000',
      triggers: [
        'Board-level security mandate after peer breach',
        'Regulatory/compliance transformation (critical infrastructure)',
        'Global identity platform consolidation',
        'Legacy IAM platform migration (CA/IBM/Oracle)',
        'Zero Trust architecture program with allocated budget',
        'M&A integration requiring unified identity across acquired entities',
        'Digital transformation with 50K+ identity footprint',
        'CISO/CIO executive sponsorship for identity modernization',
      ],
      description: 'Global enterprise with $2M+ ARR potential, 30,000+ employees, and at least 2 executive-level buying triggers. Full platform sale with ITP and PAM.',
    },
    tierB: {
      arrRange: '$1.5M-$2M',
      employeeRange: '20,000-30,000',
      description: 'Large enterprise with significant IAM needs but no board-level urgency. Multi-year evaluation likely. 18-36 month cycle.',
    },
    tierC: {
      arrMax: '$1.5M',
      employeeMax: '20,000',
      description: 'May be better categorized in Enterprise patch. Limited strategic value at this scale.',
    },
    entryProducts: ['Full Workforce Identity Platform', 'Identity Threat Protection', 'Privileged Access'],
    acvRange: '$1.5M-$10M+',
    decisionMakers: ['CISO', 'CIO', 'Board/Audit Committee'],
    topCompetitors: ['Microsoft Entra', 'CyberArk', 'SailPoint', 'IBM'],
    priorityNotes: 'For Strategic patch: Board mandates and regulatory transformation are the strongest triggers.',
    scoringDimensions: buildScoringDimensions('stg'),
    tierThresholds: {
      A: { min: 70, max: 100 },
      B: { min: 45, max: 69 },
      C: { min: 25, max: 44 },
    },
    icpDefinition: 'Global enterprises with 20,000+ employees and ANZ presence, undergoing identity platform consolidation, with board-level security mandates and budget for full Okta platform (WIC + IGA + PAM + ITP).',
    qualifyingQuestions: [
      'Is identity consolidation on the board or audit committee agenda?',
      'Are you migrating off legacy IAM (CA, IBM, Oracle)?',
      'How are you managing identity across acquired entities globally?',
      'What is your Zero Trust architecture roadmap and budget?',
    ],
  },
  pubsec: {
    label: 'Public Sector',
    headcountRange: 'Government & public sector entities',
    tierA: {
      arrMin: '$150K',
      employeeMin: '500',
      triggers: [
        'ASD Essential Eight maturity uplift program',
        'ISM classification or PSPF compliance gaps',
        'Active tender or panel arrangement for identity/cyber',
        'MYEFO/PAES budget allocation for cyber security',
        'Machinery of government changes creating consolidation needs',
        'Audit findings requiring identity remediation',
        'New CISO/CIO driving security modernisation',
        'Legacy identity platform end-of-life (on-prem AD)',
      ],
      description: 'Government entity with $150K+ ARR potential, 500+ staff, and at least 2 near-term buying triggers. Compliance-driven sale with governance and MFA focus.',
    },
    tierB: {
      arrRange: '$75K-$150K',
      employeeRange: '200-500',
      description: 'Mid-size agency or statutory authority with identity needs but no active procurement. 12-24 month cycle.',
    },
    tierC: {
      arrMax: '$75K',
      employeeMax: '200',
      description: 'Small agency or local government entity. Limited budget, basic SSO/MFA needs. May use whole-of-government panel arrangements.',
    },
    entryProducts: ['SSO', 'MFA', 'Identity Governance'],
    acvRange: '$75K-$500K',
    decisionMakers: ['CISO/CSO', 'CIO', 'IT Security Lead', 'Procurement Officer'],
    topCompetitors: ['Microsoft Entra', 'SailPoint', 'Ping Identity'],
    priorityNotes: 'For Public Sector: Essential Eight maturity gaps and active tenders are the strongest triggers. Budget cycles (MYEFO/PAES) are critical timing signals.',
    scoringDimensions: buildScoringDimensions('pubsec'),
    tierThresholds: {
      A: { min: 70, max: 100 },
      B: { min: 45, max: 69 },
      C: { min: 25, max: 44 },
    },
    icpDefinition: 'Australian federal, state, and local government agencies and statutory authorities requiring Essential Eight compliance uplift, ISM-aligned identity controls, and phishing-resistant MFA (FIDO2/passkeys). Procurement via panels (e.g., DTA Marketplace, state ICT panels).',
    qualifyingQuestions: [
      'What is your current ASD Essential Eight maturity level for MFA?',
      'Are you on any whole-of-government identity panels or arrangements?',
      'How are you managing identity across agency staff, contractors, and inter-agency access?',
      'Is there a funded cyber security uplift program in the current budget cycle?',
    ],
  },
};

export const PATCH_LABELS: Record<OktaPatch, string> = {
  emerging: 'Emerging',
  crp: 'Corporate',
  ent: 'Enterprise',
  stg: 'Strategic',
  pubsec: 'Public Sector',
};

export interface OktaAISuggestions {
  tier: 'A' | 'B' | 'C' | 'DQ';
  tierReasoning: string;
  estimatedAnnualRevenue: string;
  revenueReasoning: string;
  estimatedEmployeeCount: string;
  employeeCountReasoning: string;
  useCases: string[];
  useCasesReasoning: string;
  oktaSkus: string[];
  skuReasoning: string;
  totalScore: number;                  // 0-100
  dimensionReasoning: {
    identityInfrastructure: string;
    technologyEnvironment: string;
    securityCompliance: string;
    orgComplexity: string;
    buyingSignals: string;
    competitivePosition: string;
    strategicValue: string;
  };
  scoreBreakdown: string;             // brief summary
  priorityScore: number;              // kept for backward compat — set = totalScore
  priorityReasoning: string;
  patch?: OktaPatch;
  confidence: {
    tier: number;
    revenue: number;
    employeeCount: number;
    useCases: number;
    skus: number;
  };
}

// Deterministic tier from score + thresholds
function deriveTierFromScore(
  score: number,
  thresholds: PatchConfig['tierThresholds']
): 'A' | 'B' | 'C' | 'DQ' {
  if (score >= thresholds.A.min) return 'A';
  if (score >= thresholds.B.min) return 'B';
  if (thresholds.DQ && score <= thresholds.DQ.max) return 'DQ';
  return 'C';
}

function buildOktaCategorizerPrompt(
  account: Account,
  resolvedDomain: string,
  opportunityContext: string | undefined,
  patchConfig: PatchConfig
): string {
  const oppSection = opportunityContext
    ? `\n### Salesforce Opportunity History:\n${opportunityContext}\n`
    : '';

  // Build scoring rubric table
  const rubricRows = patchConfig.scoringDimensions
    .map(d => `| ${d.name} | ${d.maxPoints} | ${d.topBandSignals.join('; ')} | ${d.lowBandSignals.join('; ')} |`)
    .join('\n');

  // Build tier threshold text
  const thresholdText = Object.entries(patchConfig.tierThresholds)
    .map(([tier, { min, max }]) => `  - **Tier ${tier}**: Score ${min}-${max}`)
    .join('\n');

  return `You are an Okta Workforce Identity sales intelligence analyst. You are evaluating accounts for the **${patchConfig.label}** segment (${patchConfig.headcountRange}). Analyze the following company research data and provide a structured 0-100 score.

**ICP Definition:** ${patchConfig.icpDefinition}

Company: ${account.company_name}
Industry: ${account.industry}
Domain: ${resolvedDomain}

## Research Data:

### Current IAM Solution:
${account.okta_current_iam_solution || 'Not available'}

### Workforce & IT Complexity:
${account.okta_workforce_info || 'Not available'}

### Security & Compliance:
${account.okta_security_incidents || 'Not available'}

### Recent News & Funding:
${account.okta_news_and_funding || 'Not available'}

### Tech Transformation:
${account.okta_tech_transformation || 'Not available'}

### Okta Ecosystem:
${account.okta_ecosystem || 'Not available'}

### Research Summary:
${account.okta_research_summary || 'Not available'}

### Opportunity Type:
${account.okta_opportunity_type || 'Not available'}
${oppSection}
---

## Scoring Framework (0-100 points)

Assess the account across these 7 dimensions. For each, consider where the evidence places the account on a scale from low-band (0-20% of max points) to top-band (80-100% of max points).

| Dimension | Max Pts | Top-Band Signals (80-100%) | Low-Band Signals (0-20%) |
|-----------|---------|---------------------------|-------------------------|
${rubricRows}

**Sum all dimensions for a total score out of 100.**

## Tier Assignment (deterministic from score):
${thresholdText}

## Additional Context:
- Entry products for this segment: ${patchConfig.entryProducts.join(', ')}
- Expected ACV range: ${patchConfig.acvRange}
- Key decision makers: ${patchConfig.decisionMakers.join(', ')}
- Top competitors: ${patchConfig.topCompetitors.join(', ')}
- ${patchConfig.priorityNotes}

## Your Task:

1. Assess each of the 7 scoring dimensions based on the research data
2. Sum to produce a **totalScore** (0-100)
3. The tier is determined by the score thresholds above — assign accordingly
4. Estimate annual revenue, employee count, use cases, and Okta SKUs
5. Provide brief per-dimension reasoning (1-2 sentences each)

**Use Cases** — choose from:
${Object.keys(USE_CASE_TO_SKU).map(uc => `   - ${uc}`).join('\n')}

**Okta SKUs:**
- **Workforce Identity Cloud**: SSO, MFA, Lifecycle Management, Universal Directory, API Access Management, Device Access, Access Gateway, Workflows
- **Identity Governance**: Access Certifications, Access Requests, IGA, Segregation of Duties
- **Privileged Access**: PAM, Database PAM, Kubernetes PAM (enhanced with Axiom acquisition)
- **Identity Threat Protection**: ISPM, Real-time threat detection
- **Okta for AI Agents**: Securing and managing AI agent identities

**Response Format (JSON only):**
\`\`\`json
{
  "totalScore": 65,
  "tier": "B",
  "tierReasoning": "Score 65/100 maps to Tier B. Moderate IAM needs without urgent triggers.",
  "dimensionReasoning": {
    "identityInfrastructure": "Brief reasoning for this dimension",
    "technologyEnvironment": "Brief reasoning",
    "securityCompliance": "Brief reasoning",
    "orgComplexity": "Brief reasoning",
    "buyingSignals": "Brief reasoning",
    "competitivePosition": "Brief reasoning",
    "strategicValue": "Brief reasoning"
  },
  "scoreBreakdown": "One-sentence summary of the strongest and weakest dimensions",
  "estimatedAnnualRevenue": "$X-$Y",
  "revenueReasoning": "Brief explanation",
  "estimatedEmployeeCount": "X-Y employees",
  "employeeCountReasoning": "Brief explanation",
  "useCases": ["UseCase1", "UseCase2"],
  "useCasesReasoning": "Brief explanation",
  "oktaSkus": ["Workforce Identity Cloud"],
  "skuReasoning": "Brief explanation",
  "priorityReasoning": "Brief summary of why this score is appropriate",
  "confidence": {
    "tier": 0.9,
    "revenue": 0.7,
    "employeeCount": 0.8,
    "useCases": 0.85,
    "skus": 0.9
  }
}
\`\`\`

**CRITICAL INSTRUCTIONS:**
- Score conservatively — most accounts should land 40-65 (Tier B range)
- Top-band scores (75+) require multiple strong signals backed by evidence
- Provide totalScore as an integer 0-100
- The tier MUST match the score thresholds — do not override
- In dimensionReasoning, cite specific evidence from the research data
- Default to moderate scores when evidence is lacking

Provide ONLY the JSON response, no additional text.`;
}

export async function analyzeOktaAccountData(
  account: Account,
  opportunityContext?: string,
  patch?: OktaPatch
): Promise<OktaAISuggestions> {
  const resolvedPatch = patch || 'ent';
  const patchConfig = PATCH_CONFIGS[resolvedPatch];
  const resolvedDomain = await resolveAndUpdateDomain(account);

  const prompt = buildOktaCategorizerPrompt(account, resolvedDomain, opportunityContext, patchConfig);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: `You are an Okta Workforce Identity sales intelligence analyst evaluating accounts for the ${patchConfig.label} segment (${patchConfig.headcountRange}). Score accounts 0-100 across 7 dimensions. Be conservative — most accounts should score 40-65. Respond with valid JSON only.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content in response');
    }

    const suggestions = JSON.parse(content) as OktaAISuggestions;

    // Validate totalScore
    if (typeof suggestions.totalScore !== 'number' || suggestions.totalScore < 0 || suggestions.totalScore > 100) {
      suggestions.totalScore = 50; // Default to 50 if invalid
    }
    suggestions.totalScore = Math.round(suggestions.totalScore);

    // Deterministic tier from score — override AI's tier if it doesn't match
    const derivedTier = deriveTierFromScore(suggestions.totalScore, patchConfig.tierThresholds);
    if (suggestions.tier !== derivedTier) {
      suggestions.tier = derivedTier;
    }

    // Validate tier
    if (!suggestions.tier || !['A', 'B', 'C', 'DQ'].includes(suggestions.tier)) {
      suggestions.tier = derivedTier;
    }

    // Set priorityScore = totalScore for backward compatibility
    suggestions.priorityScore = suggestions.totalScore;

    // Ensure dimensionReasoning exists
    if (!suggestions.dimensionReasoning) {
      suggestions.dimensionReasoning = {
        identityInfrastructure: 'Not assessed',
        technologyEnvironment: 'Not assessed',
        securityCompliance: 'Not assessed',
        orgComplexity: 'Not assessed',
        buyingSignals: 'Not assessed',
        competitivePosition: 'Not assessed',
        strategicValue: 'Not assessed',
      };
    }

    if (!suggestions.scoreBreakdown) {
      suggestions.scoreBreakdown = `Total score: ${suggestions.totalScore}/100`;
    }

    // Tag with the patch used (set at call site, not by LLM)
    suggestions.patch = resolvedPatch;

    return suggestions;
  } catch (error) {
    logDetailedError(`[Okta Categorizer] Failed to analyze account ${account.company_name} (domain: ${(account as { domain?: string }).domain || 'none'}, industry: ${account.industry}, patch: ${resolvedPatch})`, error);
    // Return default suggestions on error
    return {
      tier: 'B',
      tierReasoning: 'Error during analysis, defaulted to Tier B',
      estimatedAnnualRevenue: 'Unknown',
      revenueReasoning: 'Insufficient data for estimation',
      estimatedEmployeeCount: 'Unknown',
      employeeCountReasoning: 'Insufficient data for estimation',
      useCases: [],
      useCasesReasoning: 'Error during analysis',
      oktaSkus: ['Workforce Identity Cloud'],
      skuReasoning: 'Defaulted to Workforce Identity Cloud',
      totalScore: 50,
      dimensionReasoning: {
        identityInfrastructure: 'Error during analysis',
        technologyEnvironment: 'Error during analysis',
        securityCompliance: 'Error during analysis',
        orgComplexity: 'Error during analysis',
        buyingSignals: 'Error during analysis',
        competitivePosition: 'Error during analysis',
        strategicValue: 'Error during analysis',
      },
      scoreBreakdown: 'Error during analysis — default score 50/100',
      priorityScore: 50,
      priorityReasoning: 'Default priority due to analysis error',
      patch: resolvedPatch,
      confidence: {
        tier: 0.3,
        revenue: 0.3,
        employeeCount: 0.3,
        useCases: 0.3,
        skus: 0.3,
      },
    };
  }
}

// Helper function to auto-suggest SKUs based on use cases
export function suggestOktaSkusFromUseCases(useCases: string[]): string[] {
  const skuSet = new Set<string>();

  useCases.forEach(useCase => {
    const skus = USE_CASE_TO_SKU[useCase];
    if (skus) {
      skus.forEach(sku => skuSet.add(sku));
    }
  });

  return Array.from(skuSet);
}
