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
   - **Tier A**: Large enterprise, strong funding, high growth, sophisticated tech stack, clear CIAM needs, ideal Auth0 customer profile
   - **Tier B**: Mid-market, moderate growth, some technical sophistication, decent fit for Auth0
   - **Tier C**: Small company, early stage, limited budget, basic needs, or poor fit

2. **Estimated Annual Revenue**: Provide a range (e.g., "$50M-$100M", "$500M+", "< $10M") based on funding, company size signals, customer base

3. **Estimated User Volume**: How many users/customers do they likely need to authenticate? (e.g., "10K-50K", "500K+", "< 5K")

4. **Use Cases**: Identify which authentication/authorization use cases apply. Choose from:
   ${Object.keys(USE_CASE_TO_SKU).map(uc => `   - ${uc}`).join('\n')}

5. **Auth0 SKUs**: Based on use cases identified, which Auth0 products would fit?
   - **Core**: SSO, MFA, Social Login, User Management, B2C/B2B Auth, API Security
   - **FGA**: Fine-Grained Authorization, Permissions as a Service, B2B multi-tenancy
   - **Auth for AI**: LLM app auth, AI agent security, chatbot authentication

6. **Priority Score (1-10)**: How high priority is this account for outreach?
   - 9-10: Hot lead, perfect fit, high urgency
   - 7-8: Strong opportunity, good fit
   - 4-6: Moderate fit, worth pursuing
   - 1-3: Low priority, poor fit

**Response Format (JSON only):**
\`\`\`json
{
  "tier": "A|B|C",
  "tierReasoning": "Brief explanation",
  "estimatedAnnualRevenue": "$X-$Y",
  "revenueReasoning": "Brief explanation",
  "estimatedUserVolume": "X-Y users",
  "volumeReasoning": "Brief explanation",
  "useCases": ["UseCase1", "UseCase2", ...],
  "useCasesReasoning": "Brief explanation",
  "auth0Skus": ["Core", "FGA", "Auth for AI"],
  "skuReasoning": "Brief explanation",
  "priorityScore": 8,
  "priorityReasoning": "Brief explanation",
  "confidence": {
    "tier": 0.9,
    "revenue": 0.7,
    "volume": 0.8,
    "useCases": 0.85,
    "skus": 0.9
  }
}
\`\`\`

Provide ONLY the JSON response, no additional text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: 'You are an Auth0 CIAM sales intelligence analyst. Respond with valid JSON only.',
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
