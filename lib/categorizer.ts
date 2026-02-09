import { Account } from './db';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// Use case to SKU mapping
const USE_CASE_TO_SKU: Record<string, string[]> = {
  'SSO': ['Core'],
  'MFA': ['Core'],
  'Social Login': ['Core'],
  'B2C Authentication': ['Core'],
  'User Management': ['Core'],
  'Password Management': ['Core'],
  'B2B Multi-tenancy': ['FGA', 'Core'],
  'Role-Based Access Control': ['FGA'],
  'Fine-Grained Permissions': ['FGA'],
  'API Security': ['Core'],
  'LLM/AI Authentication': ['Auth for AI'],
  'AI Agent Security': ['Auth for AI'],
  'Chatbot Authentication': ['Auth for AI'],
  'Machine-to-Machine Auth': ['Core'],
  'Compliance & Audit': ['Core'],
};

export interface AISuggestions {
  tier: 'A' | 'B' | 'C';
  tierReasoning: string;
  estimatedAnnualRevenue: string;
  revenueReasoning: string;
  estimatedUserVolume: string;
  volumeReasoning: string;
  useCases: string[];
  useCasesReasoning: string;
  auth0Skus: string[];
  skuReasoning: string;
  priorityScore: number;
  priorityReasoning: string;
  confidence: {
    tier: number;
    revenue: number;
    volume: number;
    useCases: number;
    skus: number;
  };
}

export async function analyzeAccountData(account: Account): Promise<AISuggestions> {
  const prompt = `You are an Auth0 CIAM sales intelligence analyst. Analyze the following company research data and provide structured categorization for sales prioritization.

Company: ${account.company_name}
Industry: ${account.industry}
Domain: ${account.domain}

## Research Data:

### Current Authentication Solution:
${account.current_auth_solution || 'Not available'}

### Customer Base & Scale:
${account.customer_base_info || 'Not available'}

### Security & Compliance:
${account.security_incidents || 'Not available'}

### Recent News & Funding:
${account.news_and_funding || 'Not available'}

### Tech Transformation:
${account.tech_transformation || 'Not available'}

### Research Summary:
${account.research_summary || 'Not available'}

---

## Your Task:

Analyze this data and provide the following categorizations:

1. **Tier (A/B/C):**

   **IMPORTANT: Tier A is ONLY for exceptional opportunities. Most accounts should be B or C.**

   - **Tier A** (Rare - only ~5-10% of accounts):
     * **Minimum $250K USD ARR potential** - Large user base (500K+ users) OR high-value B2B with complex auth needs
     * **Near-term buying triggers present** (must have at least 2 of these):
       - Recent significant funding ($20M+) or strong revenue growth
       - Active tech transformation/platform modernization underway
       - Security incident or compliance deadline creating urgency
       - Current auth solution causing documented pain points
       - Rapidly scaling user base requiring enterprise CIAM
       - Public statements about security/identity priorities
       - Recent leadership changes (new CTO/CISO) driving change
       - Migration from legacy systems in progress
     * Strong Auth0 fit: Enterprise scale, sophisticated needs, clear budget authority
     * **High likelihood to purchase within 12 months**

   - **Tier B** (Default - majority of accounts 60-70%):
     * Mid-market companies with moderate CIAM needs
     * $50K-$250K ARR potential
     * Some growth indicators but no urgent buying triggers
     * Good technical fit but longer sales cycle (12-24 months)
     * Established company with budget, but no immediate catalyst

   - **Tier C** (Lower priority - 20-30%):
     * Small companies or early stage startups
     * < $50K ARR potential
     * Limited budget or poor fit for Auth0
     * Basic auth needs that could use simpler solutions
     * Long sales cycle with uncertain timeline

2. **Estimated Annual Revenue**: Provide a range (e.g., "$50M-$100M", "$500M+", "< $10M") based on funding, company size signals, customer base

3. **Estimated User Volume**: How many users/customers do they likely need to authenticate? (e.g., "10K-50K", "500K+", "< 5K")

4. **Use Cases**: Identify which authentication/authorization use cases apply. Choose from:
   ${Object.keys(USE_CASE_TO_SKU).map(uc => `   - ${uc}`).join('\n')}

5. **Auth0 SKUs**: Based on use cases identified, which Auth0 products would fit?
   - **Core**: SSO, MFA, Social Login, User Management, B2C/B2B Auth, API Security
   - **FGA**: Fine-Grained Authorization, Permissions as a Service, B2B multi-tenancy
   - **Auth for AI**: LLM app auth, AI agent security, chatbot authentication

6. **Priority Score (1-10)**: How high priority is this account for SDR outreach? **BE CONSERVATIVE - high scores should be rare.**
   - **9-10** (Very rare - <5%): Tier A with multiple strong buying triggers, immediate opportunity, $250K+ ARR potential
   - **7-8** (Rare - ~10%): Tier A or strong Tier B with at least one clear buying trigger, $100K+ ARR potential
   - **5-6** (Most common - ~50%): Tier B accounts, moderate fit, some potential but no urgent triggers
   - **3-4** (Common - ~30%): Tier C or weak Tier B, longer-term opportunity, limited triggers
   - **1-2** (Reserved - ~10%): Poor fit, very small, or no clear Auth0 use case

**Response Format (JSON only):**
\`\`\`json
{
  "tier": "A|B|C",
  "tierReasoning": "For Tier A: List specific ARR potential ($XXX) AND buying triggers identified. For B/C: Explain why it doesn't meet Tier A criteria.",
  "estimatedAnnualRevenue": "$X-$Y",
  "revenueReasoning": "Brief explanation",
  "estimatedUserVolume": "X-Y users",
  "volumeReasoning": "Brief explanation",
  "useCases": ["UseCase1", "UseCase2", ...],
  "useCasesReasoning": "Brief explanation",
  "auth0Skus": ["Core", "FGA", "Auth for AI"],
  "skuReasoning": "Brief explanation",
  "priorityScore": 5,
  "priorityReasoning": "Justify score based on buying triggers, ARR potential, and timeline. High scores (8+) require specific evidence.",
  "confidence": {
    "tier": 0.9,
    "revenue": 0.7,
    "volume": 0.8,
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

Provide ONLY the JSON response, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: 'You are an Auth0 CIAM sales intelligence analyst. Be highly selective with Tier A assignments - they require $250K+ ARR potential AND multiple buying triggers. Most accounts should be Tier B or C. Respond with valid JSON only.',
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

    const suggestions = JSON.parse(content) as AISuggestions;

    // Validate and ensure all fields are present
    if (!suggestions.tier || !['A', 'B', 'C'].includes(suggestions.tier)) {
      suggestions.tier = 'B'; // Default to B if invalid
    }

    if (!suggestions.priorityScore || suggestions.priorityScore < 1 || suggestions.priorityScore > 10) {
      suggestions.priorityScore = 5; // Default to 5 if invalid
    }

    return suggestions;
  } catch (error) {
    console.error('Error analyzing account:', error);
    // Return default suggestions on error
    return {
      tier: 'B',
      tierReasoning: 'Error during analysis, defaulted to Tier B',
      estimatedAnnualRevenue: 'Unknown',
      revenueReasoning: 'Insufficient data for estimation',
      estimatedUserVolume: 'Unknown',
      volumeReasoning: 'Insufficient data for estimation',
      useCases: [],
      useCasesReasoning: 'Error during analysis',
      auth0Skus: ['Core'],
      skuReasoning: 'Defaulted to Core SKU',
      priorityScore: 5,
      priorityReasoning: 'Default priority due to analysis error',
      confidence: {
        tier: 0.3,
        revenue: 0.3,
        volume: 0.3,
        useCases: 0.3,
        skus: 0.3,
      },
    };
  }
}

// Helper function to auto-suggest SKUs based on use cases
export function suggestSkusFromUseCases(useCases: string[]): string[] {
  const skuSet = new Set<string>();

  useCases.forEach(useCase => {
    const skus = USE_CASE_TO_SKU[useCase];
    if (skus) {
      skus.forEach(sku => skuSet.add(sku));
    }
  });

  return Array.from(skuSet);
}
