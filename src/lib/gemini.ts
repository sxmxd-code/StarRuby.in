// ==============================================================================
// StarRuby.in Banking System — Google Gemini AI Integration Engine
// Powered by Gemini 2.5 Flash & Gemini Embedding 001
// ==============================================================================

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export const isGeminiConfigured = Boolean(
  GEMINI_API_KEY &&
  !GEMINI_API_KEY.includes('PASTE_YOUR') &&
  GEMINI_API_KEY.length > 20
);

const GEMINI_GEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_API_KEY}`;

/**
 * Standard text generation with Gemini 2.5 Flash
 */
export async function generateGeminiContent(
  prompt: string,
  systemInstruction?: string
): Promise<string> {
  if (!isGeminiConfigured) {
    throw new Error('Gemini API key is not configured in .env');
  }

  const payload: any = {
    contents: [{ parts: [{ text: prompt }] }],
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  const res = await fetch(GEMINI_GEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return candidate || '';
}

export interface ExtractedInvoiceData {
  invoice_no?: string;
  date?: string;
  party_name?: string;
  amount?: number;
  currency?: string;
  description?: string;
  confidence: number;
  raw_summary: string;
}

/**
 * Analyzes document text or filename using Gemini to extract key invoice/receipt fields
 */
export async function extractDocumentMetadataAI(
  documentTitle: string,
  sampleContent?: string
): Promise<ExtractedInvoiceData> {
  const prompt = `
You are a senior banking and treasury auditor for StarRuby.in (a luxury gems & jewellery company).
Analyze the following document filename and textual content:
Document Name: "${documentTitle}"
Content Snippet: "${sampleContent || 'Invoice/Receipt document for treasury booking'}"

Extract structured financial details. Return ONLY a valid JSON object without markdown formatting:
{
  "invoice_no": "Extracted invoice or reference number (or null)",
  "date": "YYYY-MM-DD format (or null)",
  "party_name": "Vendor, laboratory or client name (or null)",
  "amount": number (or null),
  "currency": "INR", "AED", or "USD" (default "INR"),
  "description": "One-line clear description for banking books",
  "confidence": number between 0.0 and 1.0,
  "raw_summary": "Brief 1-sentence audit summary"
}
`;

  try {
    const raw = await generateGeminiContent(prompt);
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('Gemini document extraction fallback:', err);
    return {
      confidence: 0.5,
      raw_summary: `Document: ${documentTitle}`,
      currency: 'INR',
    };
  }
}

/**
 * Generates high-dimension vector embedding for semantic search
 */
export async function getVectorEmbedding(text: string): Promise<number[]> {
  if (!isGeminiConfigured) return [];

  try {
    const res = await fetch(GEMINI_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text }] },
      }),
    });

    if (!res.ok) throw new Error(`Embedding API error ${res.status}`);
    const data = await res.json();
    return data.embedding?.values || [];
  } catch (err) {
    console.warn('Failed to generate Gemini embedding:', err);
    return [];
  }
}

/**
 * Computes cosine similarity between two vector embeddings
 */
export function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Auto-generates reusable description templates for a party based on company standards
 */
export async function generatePartyTemplatesAI(
  partyName: string,
  partyGroup?: string
): Promise<string[]> {
  const prompt = `
You are StarRuby.in's treasury manager.
Generate 3 distinct, professional, realistic banking narration description templates for outside vendor/client:
Party Name: "${partyName}"
Group: "${partyGroup || 'General Treasury'}"

Guidelines:
- Professional, concise banking language (under 60 characters each).
- Suitable for NEFT/RTGS/Wire transfer narrations.
- Examples: "Advance payment for rough ruby lot shipment", "Certification and grading charges", "Monthly retainer fees".

Return ONLY a valid JSON array of 3 strings, e.g.: ["Template 1", "Template 2", "Template 3"]
`;

  try {
    const raw = await generateGeminiContent(prompt);
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('Gemini template generation fallback:', err);
    return [
      `Payment for invoice to ${partyName}`,
      `Advance against order shipment - ${partyName}`,
      `Settlement of account balance - ${partyName}`,
    ];
  }
}

/**
 * Intelligently suggests Party System Name from messy bank statement text
 */
export async function suggestPartyFromAliasAI(
  rawAlias: string,
  knownParties: Array<{ id: string; system_name: string }>
): Promise<{ matchedPartyId?: string; cleanedName: string; confidence: number }> {
  const prompt = `
Given raw bank statement or user typed party string: "${rawAlias}"
And known approved Party System Names:
${knownParties.map(p => `- ID: ${p.id}, Name: "${p.system_name}"`).join('\n')}

Identify which known party it refers to (if any), or provide a cleaned-up, proper Company System Name.
Return ONLY valid JSON:
{
  "matchedPartyId": "PTY... or null",
  "cleanedName": "Clean Capitalized Company Name",
  "confidence": number between 0.0 and 1.0
}
`;

  try {
    const raw = await generateGeminiContent(prompt);
    const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('Gemini alias match fallback:', err);
    return {
      cleanedName: rawAlias.trim(),
      confidence: 0.5,
    };
  }
}
