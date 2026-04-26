export const AUTH0_VALUE_DRIVERS = [
  'accelerate time to market',
  'elevate the customer experience',
  'protect the brand',
] as const;

export const AUTH0_VALUE_FRAMEWORK_PROMPT_GUIDANCE = `Use the Auth0 Value Framework as the messaging backbone:
- Start from the customer's objective or pressure, not a product pitch.
- Carry the narrative through this chain wherever possible: observed signal -> likely identity problem -> business impact -> desired outcome -> Auth0 angle.
- Map each account to one or two value drivers only when the evidence supports it:
  - Accelerate time to market: reduce identity engineering burden, speed launches, simplify migration, accelerate secure AI-agent rollouts.
  - Elevate the customer experience: reduce login friction, improve onboarding, personalise journeys, increase conversion and retention.
  - Protect the brand: strengthen security, bot and fake-account defence, resilience, compliance, and audit readiness.
- Pull in required capabilities only when they sharpen the case: developer-friendly extensibility, standards support, scale, compliance, AI guardrails, bot protection, B2B/B2C flexibility, and personalisation.
- Use differentiators selectively and only when they fit the account's likely problem:
  - Leading developer experience
  - Extensibility, customization, and orchestration
  - Secure production-ready AI agents
  - One identity platform for every business model
  - Trust: availability, scalability, security, and compliance
- Use proof points sparingly and only when they are a close analogue:
  - Cinepolis: 80% faster time-to-market, 300% loyalty growth, 16% fraud reduction, 35% total cost savings
  - Snyk: nearly 100% sign-up conversion, 1-2 FTEs redirected to core innovation
  - Wyndham: unified 100M identities for a secure omnichannel guest experience
  - FloHealth: sign-up improved from 6% to 75%, driving 12.5x new-user growth
  - Finder: hundreds of engineering hours redirected from auth maintenance to product work
  - Headspace: scaled identity to 70M users across 190 countries with regulatory coverage
- For outbound messaging, translate the framework into one clear business problem, business impact, desired outcome, and one or two concrete Auth0 angles.`;

export const AUTH0_COMMAND_OF_MESSAGE_OUTPUT_GUIDANCE = `Return markdown with these exact headings:
## Company Objectives
- 2-4 bullets on the most likely business, product, customer, or risk objectives visible in public signals.

## Best-Fit Auth0 Value Drivers
- Choose 1-2 value drivers from: Accelerate time to market, Elevate the customer experience, Protect the brand.
- Explain why each one fits this account now.

## Core Messaging Pieces We Can Use Now
- 3 bullets that each follow: observed signal -> likely problem -> business impact -> Auth0 angle.

## Differentiators / Capabilities To Lean On
- 2-4 bullets on the most relevant Auth0 differentiators or required capabilities for this account.

## Proof Points To Reference
- 1-2 bullets with the closest proof points, or state that there is no clean analogue.

## Discovery Questions
- 3 bullets phrased as questions an SDR can use in outreach or a first conversation.

## Source Links
- 2-5 bullets with clickable markdown links to the strongest public sources already used in the research.`;

export const AUTH0_VALUE_FRAMEWORK_EMAIL_GUIDANCE = `For Auth0 messaging:
- Treat the company's objective as the lead idea.
- Pick one primary Auth0 value driver and keep the copy anchored to it.
- Use a differentiator only if it sharpens the problem and desired outcome.
- Do NOT reference specific customer proof points by name in outbound emails. Focus on the prospect's own business context instead.
- If research includes a Command of the Message section, use it as the primary messaging brief and use the rest of the account data as supporting evidence.`;
