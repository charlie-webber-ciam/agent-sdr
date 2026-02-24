import { Account } from './db';
import OpenAI from 'openai';
import { logDetailedError } from './error-logger';
import { resolveAndUpdateDomain } from './domain-resolver';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// OktaPatch type — must stay in sync with perspective-context.tsx
export type OktaPatch = 'emerging' | 'crp' | 'ent' | 'stg';

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
    priorityNotes: 'For Emerging patch: SOC 2 timelines and first enterprise deals are the strongest triggers. Score 8+ only with active compliance deadline or Series B+ funding with rapid hiring.',
  },
  crp: {
    label: 'Corporate',
    headcountRange: '1,250-5,000 employees',
    tierA: {
      arrMin: '$150K',
      employeeMin: '2,000',
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
      description: 'Mid-market company with $150K+ ARR potential, 2,000+ employees, and at least 2 near-term buying triggers. Multi-product opportunity.',
    },
    tierB: {
      arrRange: '$75K-$150K',
      employeeRange: '1,250-2,000',
      description: 'Solid mid-market company with IAM needs but no urgent catalyst. Good fit for SSO + MFA bundle. 12-18 month cycle.',
    },
    tierC: {
      arrMax: '$75K',
      employeeMax: '1,250',
      description: 'Smaller corporate, limited IAM complexity. Basic SSO needs. May not justify full Okta investment.',
    },
    entryProducts: ['SSO', 'MFA', 'Lifecycle Management'],
    acvRange: '$75K-$300K',
    decisionMakers: ['CISO', 'IT Director', 'VP IT'],
    topCompetitors: ['Microsoft Entra', 'Ping Identity', 'SailPoint'],
    priorityNotes: 'For Corporate patch: M&A and new security leadership are the strongest triggers. Score 8+ only with active vendor evaluation or compliance deadline.',
  },
  ent: {
    label: 'Enterprise',
    headcountRange: 'up to 20,000 employees',
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
    priorityNotes: 'For Enterprise patch: Security incidents and Zero Trust mandates are the strongest triggers. Score 8+ only with active security initiative or competitive displacement opportunity.',
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
    priorityNotes: 'For Strategic patch: Board mandates and regulatory transformation are the strongest triggers. Score 8+ only with executive sponsorship and allocated budget.',
  },
};

export const PATCH_LABELS: Record<OktaPatch, string> = {
  emerging: 'Emerging',
  crp: 'Corporate',
  ent: 'Enterprise',
  stg: 'Strategic',
};

export interface OktaAISuggestions {
  tier: 'A' | 'B' | 'C';
  tierReasoning: string;
  estimatedAnnualRevenue: string;
  revenueReasoning: string;
  estimatedEmployeeCount: string;
  employeeCountReasoning: string;
  useCases: string[];
  useCasesReasoning: string;
  oktaSkus: string[];
  skuReasoning: string;
  priorityScore: number;
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

function buildOktaCategorizerPrompt(
  account: Account,
  resolvedDomain: string,
  opportunityContext: string | undefined,
  patchConfig: PatchConfig
): string {
  const oppSection = opportunityContext
    ? `\n### Salesforce Opportunity History:\n${opportunityContext}\n`
    : '';

  const triggersFormatted = patchConfig.tierA.triggers
    .map(t => `       - ${t}`)
    .join('\n');

  return `You are an Okta Workforce Identity sales intelligence analyst. You are evaluating accounts for the **${patchConfig.label}** segment (${patchConfig.headcountRange}). Analyze the following company research data and provide structured categorization for sales prioritization.

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

## Your Task:

Analyze this data and provide the following categorizations:

1. **Tier (A/B/C):**

   **IMPORTANT: Tier A is ONLY for exceptional opportunities. Most accounts should be B or C.**

   - **Tier A** (Rare - only ~5-10% of accounts):
     * ${patchConfig.tierA.description}
     * **Minimum ${patchConfig.tierA.arrMin} USD ARR potential** — ${patchConfig.tierA.employeeMin}+ employees
     * **Near-term buying triggers present** (must have at least 2 of these):
${triggersFormatted}
     * Strong Okta fit: multi-product opportunity, clear budget authority
     * **High likelihood to purchase within 12 months**

   - **Tier B** (Default - majority of accounts 60-70%):
     * ${patchConfig.tierB.description}
     * ${patchConfig.tierB.arrRange} ARR potential
     * ${patchConfig.tierB.employeeRange} employees
     * Some growth indicators but no urgent buying triggers
     * Good technical fit but longer sales cycle

   - **Tier C** (Lower priority - 20-30%):
     * ${patchConfig.tierC.description}
     * < ${patchConfig.tierC.arrMax} ARR potential
     * < ${patchConfig.tierC.employeeMax} employees
     * Limited budget or poor fit for Okta at this segment level
     * Long sales cycle with uncertain timeline

2. **Estimated Annual Revenue**: Provide a range (e.g., "$50M-$100M", "$500M+", "< $10M") based on funding, company size signals, workforce size

3. **Estimated Employee Count**: How many employees/workforce members need identity management? (e.g., "500-1000", "5000+", "< 100")

4. **Use Cases**: Identify which Okta use cases apply. Choose from:
   ${Object.keys(USE_CASE_TO_SKU).map(uc => `   - ${uc}`).join('\n')}

5. **Okta SKUs**: Based on use cases identified, which Okta products would fit?
   - **Workforce Identity Cloud**: SSO, MFA, Lifecycle Management, Universal Directory, API Access Management, Device Access, Access Gateway, Workflows
   - **Identity Governance**: Access Certifications, Access Requests, IGA, Segregation of Duties
   - **Privileged Access**: PAM, Database PAM, Kubernetes PAM (enhanced with Axiom acquisition)
   - **Identity Threat Protection**: ISPM, Real-time threat detection
   - **Okta for AI Agents**: Securing and managing AI agent identities
   Entry products for this segment: ${patchConfig.entryProducts.join(', ')}
   Expected ACV range: ${patchConfig.acvRange}
   Key decision makers: ${patchConfig.decisionMakers.join(', ')}
   Top competitors: ${patchConfig.topCompetitors.join(', ')}

6. **Priority Score (1-10)**: How high priority is this account for SDR outreach? **BE CONSERVATIVE - high scores should be rare.**
   - **9-10** (Very rare - <5%): Tier A with multiple strong buying triggers, immediate opportunity
   - **7-8** (Rare - ~10%): Tier A or strong Tier B with at least one clear buying trigger
   - **5-6** (Most common - ~50%): Tier B accounts, moderate fit, some potential but no urgent triggers
   - **3-4** (Common - ~30%): Tier C or weak Tier B, longer-term opportunity, limited triggers
   - **1-2** (Reserved - ~10%): Poor fit, very small, or no clear Okta use case
   ${patchConfig.priorityNotes}

**Response Format (JSON only):**
\`\`\`json
{
  "tier": "A|B|C",
  "tierReasoning": "For Tier A: List specific ARR potential ($XXX) AND buying triggers identified. For B/C: Explain why it doesn't meet Tier A criteria.",
  "estimatedAnnualRevenue": "$X-$Y",
  "revenueReasoning": "Brief explanation",
  "estimatedEmployeeCount": "X-Y employees",
  "employeeCountReasoning": "Brief explanation",
  "useCases": ["UseCase1", "UseCase2", ...],
  "useCasesReasoning": "Brief explanation",
  "oktaSkus": ["Workforce Identity Cloud", "Identity Governance", "Privileged Access", "Identity Threat Protection", "Okta for AI Agents"],
  "skuReasoning": "Brief explanation",
  "priorityScore": 5,
  "priorityReasoning": "Justify score based on buying triggers, ARR potential, and timeline. High scores (8+) require specific evidence.",
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
- Default to Tier B unless strong evidence supports A or C
- Only assign Tier A if you can identify ${patchConfig.tierA.arrMin}+ ARR potential AND at least 2 specific buying triggers
- Be conservative with priority scores - most should be 4-6
- In tierReasoning, explicitly state the buying triggers if Tier A, or why it falls short if B/C
- Consider M&A activity, compliance mandates, and Zero Trust initiatives as strong indicators

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
          content: `You are an Okta Workforce Identity sales intelligence analyst evaluating accounts for the ${patchConfig.label} segment (${patchConfig.headcountRange}). Be highly selective with Tier A assignments - they require ${patchConfig.tierA.arrMin}+ ARR potential AND multiple buying triggers. Most accounts should be Tier B or C. Respond with valid JSON only.`,
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

    // Validate and ensure all fields are present
    if (!suggestions.tier || !['A', 'B', 'C'].includes(suggestions.tier)) {
      suggestions.tier = 'B'; // Default to B if invalid
    }

    if (!suggestions.priorityScore || suggestions.priorityScore < 1 || suggestions.priorityScore > 10) {
      suggestions.priorityScore = 5; // Default to 5 if invalid
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
      priorityScore: 5,
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
