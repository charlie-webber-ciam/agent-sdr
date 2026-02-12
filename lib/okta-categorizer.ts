import { Account } from './db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

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
  confidence: {
    tier: number;
    revenue: number;
    employeeCount: number;
    useCases: number;
    skus: number;
  };
}

export async function analyzeOktaAccountData(account: Account): Promise<OktaAISuggestions> {
  const prompt = `You are an Okta Workforce Identity sales intelligence analyst. Analyze the following company research data and provide structured categorization for sales prioritization.

Company: ${account.company_name}
Industry: ${account.industry}
Domain: ${account.domain}

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

---

## Your Task:

Analyze this data and provide the following categorizations:

1. **Tier (A/B/C):**

   **IMPORTANT: Tier A is ONLY for exceptional opportunities. Most accounts should be B or C.**

   - **Tier A** (Rare - only ~5-10% of accounts):
     * **Minimum $250K USD ARR potential** - Large workforce (1000+ employees) OR high-complexity environment requiring multiple Okta products
     * **Near-term buying triggers present** (must have at least 2 of these):
       - Recent significant funding ($20M+) or strong revenue growth
       - M&A activity (merger/acquisition creating identity consolidation needs)
       - Active cloud migration or digital transformation underway
       - Security incident or compliance mandate creating urgency (APRA CPS 234, ASD Essential Eight, Australian Privacy Act)
       - Current IAM solution causing documented pain points (legacy AD, fragmented identity)
       - Rapidly scaling workforce or remote work enablement
       - Public statements about Zero Trust or identity modernization priorities
       - Recent leadership changes (new CIO/CISO) driving change
       - Existing Okta footprint with expansion opportunity
     * Strong Okta fit: Enterprise scale, multi-product opportunity, clear budget authority
     * **High likelihood to purchase within 12 months**

   - **Tier B** (Default - majority of accounts 60-70%):
     * Mid-market companies with moderate IAM needs
     * $50K-$250K ARR potential
     * 250-1000 employees
     * Some growth indicators but no urgent buying triggers
     * Good technical fit but longer sales cycle (12-24 months)
     * Established company with budget, but no immediate catalyst

   - **Tier C** (Lower priority - 20-30%):
     * Small companies or early stage startups
     * < $50K ARR potential
     * < 250 employees
     * Limited budget or poor fit for Okta
     * Basic SSO needs that could use simpler solutions
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

6. **Priority Score (1-10)**: How high priority is this account for SDR outreach? **BE CONSERVATIVE - high scores should be rare.**
   - **9-10** (Very rare - <5%): Tier A with multiple strong buying triggers, immediate opportunity, $250K+ ARR potential, M&A or security incident
   - **7-8** (Rare - ~10%): Tier A or strong Tier B with at least one clear buying trigger (cloud migration, compliance mandate, Zero Trust), $100K+ ARR potential
   - **5-6** (Most common - ~50%): Tier B accounts, moderate fit, some potential but no urgent triggers
   - **3-4** (Common - ~30%): Tier C or weak Tier B, longer-term opportunity, limited triggers
   - **1-2** (Reserved - ~10%): Poor fit, very small, or no clear Okta use case

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
- Only assign Tier A if you can identify $250K+ ARR potential AND at least 2 specific buying triggers
- Be conservative with priority scores - most should be 4-6
- In tierReasoning, explicitly state the buying triggers if Tier A, or why it falls short if B/C
- Consider M&A activity, compliance mandates, and Zero Trust initiatives as strong indicators

Provide ONLY the JSON response, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: 'You are an Okta Workforce Identity sales intelligence analyst. Be highly selective with Tier A assignments - they require $250K+ ARR potential AND multiple buying triggers. Most accounts should be Tier B or C. Respond with valid JSON only.',
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

    return suggestions;
  } catch (error) {
    console.error('Error analyzing Okta account:', error);
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
