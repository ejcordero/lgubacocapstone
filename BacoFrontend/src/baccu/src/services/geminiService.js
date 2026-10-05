import { GoogleGenAI } from "@google/genai";

const BACO_CONTEXT = `
Baco is a 1st class coastal municipality of Oriental Mindoro Province in MiMaRoPa Region (Region 4B), Philippines.
It was the first official capital of Mindoro (1575-1679).
Foundation Day: January 25 (commemorated every year).
Fiesta: March 19 in honor of Saint Joseph.

Geography:
- Location: Northern part of Oriental Mindoro.
- Area: 216.23 km2.
- Population: ~40,159 (2024 census).
- Barangays: 27 (Largest: San Ignacio, Lantuyang, Bayanan; Smallest: Pulantubig).
- Terrain: Mountainous with lowland.
- Major Products: Rice, Corn, Fish, Vegetables, Poultry, Handicraft, Home-made Food Items.

Tourist Spots:
- Mount Halcon (highest peak in the province, 2,586m).
- Blessed Trinity Parish Church.
- Banana Festival.
- Infinity Farm (riverside cottages, boardwalks).
- Tagbungan Mountain Resort & Lantuyang River.
- Hidden Paradise (natural spring, Alpaparay River).
- Tiboy Rapids.
- Al-Khaimah Resort.
- Delfinity Resort.
- Tribu Resort.
- JC Resort.
- Bayanan River.
- Kambal-Bato Mountain River Resort.
- Janaki's Resort.

COMPLETE LIST OF LGU BACO OFFICIALS (2025-2028 term):

MUNICIPAL MAYOR: Hon. Allan A. Roldan

MUNICIPAL VICE MAYOR: Hon. Brederick V. Castillo

MUNICIPAL COUNCILORS (Sangguniang Bayan / Konsehals) — there are 8 regular councilors:
  Councilor 1: Hon. Jay Lorence C. Najito
  Councilor 2: Hon. Arlene M. Pereña
  Councilor 3: Hon. Allan Q. Duka
  Councilor 4: Hon. Clarissa A. Cepillo
  Councilor 5: Hon. Leonardo L. De Ocampo
  Councilor 6: Hon. Severina B. Jimenez
  Councilor 7: Hon. Marciano R. Ical
  Councilor 8: Hon. Rigor A. Aceveda

EX-OFFICIO MEMBERS (Sangguniang Bayan):
  - Hon. Benedicto D. Manimtim — President, Association of Barangay Captains (ABC)
  - Hon. Jordano A. Tecson Jr. — President, Sangguniang Kabataan Municipal Federation
  - Hon. Ferdinando L. Abat — Indigenous Peoples' Mandatory Representative

CONGRESSMAN (1st District, Oriental Mindoro): Arnan Panaligan

IMPORTANT — Sangguniang Bayan vs Sangguniang Panlalawigan:
- Sangguniang Bayan = Baco's municipal council (listed above). BACCU has full information on these members.
- Sangguniang Panlalawigan = Oriental Mindoro's provincial council. This is a separate body. BACCU does not cover SP members. For SP inquiries, contact the Oriental Mindoro Provincial Capitol in Calapan City.
- "Konsehals", "councilors", "council members", and "Sangguniang Bayan members" all refer to the same people listed above.

Vision: By 2028, Baco is an agri-ecotourism destination in Oriental Mindoro with progressive economy, resilient and empowered community living in a safe environment through sustained infrastructure governed by responsible leaders.
Mission: The Local Government Unit of Baco, together with the citizens, believes in helping with enough equipment and skills to develop agriculture, trade, and tourism through clean, honest, and right government.

---

OFFICIAL BACO FARE GUIDE (Transportation to/from/within Baco):
These are the ONLY fare routes BACCU has data on. Do NOT cite any other fares, rates, or per-kilometer formulas not listed here.

Route 1: Calapan City Poblacion → Baco Poblacion
  Mode: Jeepney or Multicab
  Fare: PHP 35–40

Route 2: Calapan Terminal (Jeep) → Dose Baco (Km. 12 area)
  Mode: Jeepney
  Fare: PHP 35

Route 3: Dose Baco → Dulangan 3 (interior barangay)
  Mode: Habal-habal or Tricycle
  Fare: PHP 50–150 (varies by exact drop-off point)

IMPORTANT — Fare Guide Rules:
- These three routes are the complete fare data available. Do not invent fares for other routes.
- Do not use generic Philippine jeepney/tricycle per-kilometer formulas.
- Always remind users that fares are approximate and to confirm with the driver or terminal operator.

---

CITIZENS CHARTER — LGU BACO FRONTLINE SERVICES:

The Citizens Charter outlines the standard operating procedures and commitments of the Local Government Unit of Baco to its constituents. Below are the key frontline services:

1. BUSINESS PERMIT AND LICENSING (Business Permit and Licensing Office - BPLO)
   Services: Issuance of new business permits, renewal of business permits, business closure.
   Requirements (New): Barangay Clearance, DTI/SEC/CDA Registration, Lease Contract or Transfer Certificate of Title, Community Tax Certificate (CTC), Occupancy Permit (if applicable), Sanitary Permit, Zoning Clearance.
   Requirements (Renewal): Previous year's Official Receipt, Barangay Clearance, Updated CTC.
   Processing Time: Same day (if all requirements are complete).
   Fees: Based on the LGU Baco Revenue Code (varies by capitalization and business type).
   How to avail: Submit requirements to BPLO, pay applicable fees at the Municipal Treasurer's Office, claim permit.

2. CIVIL REGISTRY SERVICES (Office of the Municipal Civil Registrar)
   Services: Birth, Marriage, and Death Registration; Issuance of Certified True Copies; Correction of Clerical Errors; Change of First Name (RA 9048); Legitimation; Recognition of Illegitimate Children.
   Requirements (Birth Certificate CTC): Request form, valid ID of requesting party, authorization letter (if not the owner or parent).
   Processing Time: 1–3 working days.
   Fees: PHP 50–150 depending on service (plus PHP 100 for authentication if needed).
   Note: Late registration of birth requires additional supporting documents (Negative Certification from PSA, Affidavit of Two Disinterested Persons, Barangay Certification, etc.).

3. SOCIAL WELFARE SERVICES (Municipal Social Welfare and Development Office - MSWDO)
   Services: Assistance to Individuals in Crisis Situation (AICS), Solo Parent ID Issuance, Senior Citizen Assessment, PWD Assessment and Registration, Referral Services, Indigent Burial Assistance.
   Requirements (AICS): Valid ID, Barangay Indigency Certificate, Medical Abstract or Hospital Bill (for medical assistance), Death Certificate (for burial assistance).
   Processing Time: Same day assessment; financial release depends on fund availability.
   Fees: Free.

4. BUILDING AND CONSTRUCTION PERMITS (Office of the Municipal Engineer)
   Services: Building Permit, Electrical Permit, Sanitary/Plumbing Permit, Occupancy Permit, Demolition Permit.
   Requirements: Accomplished application form, lot/transfer certificate of title or lease contract, building plans (signed and sealed by licensed professionals), Bill of Materials and Cost Estimate, Barangay Clearance, Tax Declaration.
   Processing Time: 5–10 working days (depending on completeness and complexity).
   Fees: Based on the National Building Code and LGU Revenue Code.

5. HEALTH SERVICES (Rural Health Unit - RHU Baco)
   Services: Maternal and Child Health, Family Planning, Immunization, TB-DOTS Program, Dental Services, Consultation, Referral to District/Provincial Hospital.
   Requirements: Valid ID or barangay health record.
   Processing Time: Same day (walk-in consultation).
   Fees: Free for basic consultation and government-funded medicines.
   Operating Hours: Monday–Friday, 8:00 AM – 5:00 PM.

6. AGRICULTURAL SERVICES (Municipal Agriculture Office - MAO)
   Services: Issuance of Farm Registration Certificate, Seeds and Fertilizer Assistance, Technical Assistance and Training, Crop Insurance Referral (PCIC), Livestock Dispersal Program.
   Requirements: Barangay Certification (as farmer/fisherfolk), Land Tenurial Document or Proof of Farm Ownership/Tenancy.
   Processing Time: Varies per program.
   Fees: Free for government-funded assistance.

7. ENVIRONMENTAL AND NATURAL RESOURCES (MENRO)
   Services: Tree Cutting Permit (within private land), Transport Permit for forest products, Environmental Clearance for small projects.
   Requirements: Barangay Resolution or landowner certification, application form.
   Processing Time: 3–5 working days.
   Fees: Based on LGU schedule of fees.

8. SENIOR CITIZEN & PWD SERVICES (OSCA / PWD Affairs Office)
   Services: Senior Citizen ID, PWD ID, Booklet Issuance, Referral for Benefits and Privileges under RA 9994 (Expanded Senior Citizens Act) and RA 7277 (Magna Carta for PWDs).
   Requirements (Senior): Proof of age (birth certificate or valid ID), 1x1 photo, Barangay Clearance.
   Requirements (PWD): Medical Certificate from licensed physician, 1x1 photo, valid ID, Barangay Clearance.
   Processing Time: Same day (if requirements are complete).
   Fees: Free.

9. TREASURY SERVICES (Municipal Treasurer's Office - MTO)
   Services: Payment of Real Property Tax, Business Taxes and Fees, Community Tax Certificate (CTC/Cedula), Issuance of Tax Clearance.
   Requirements: Tax Declaration, Official Receipt of previous payment (for RPT), valid ID.
   Processing Time: Same day.
   Fees: Per applicable tax rates and Revenue Code.
   Note: Real Property Tax discount is available for early payment (January–March of each year).

10. SANGGUNIANG BAYAN SERVICES (Legislative Body)
    Services: Issuance of Certified True Copies of Ordinances and Resolutions, Endorsement of Legislative Documents.
    Requirements: Written request letter, valid ID.
    Processing Time: 1–3 working days.
    Fees: PHP 50–100 per document.

General LGU Baco Service Standards:
- All frontline services follow the Anti-Red Tape Authority (ARTA) standards under RA 11032 (Ease of Doing Business Act).
- Simple transactions: completed within 3 working days.
- Complex transactions: completed within 7 working days.
- Highly technical transactions: completed within 20 working days.
- A Zero Contact Policy is enforced: applicants transact only at the counter; no direct contact with approving officers unless officially required.
- A Public Assistance and Complaints Desk (PACD) is available at the Municipal Hall entrance.
- LGU Baco operating hours: Monday–Friday, 8:00 AM – 5:00 PM (no noon break for frontline services).
`;

const SYSTEM_INSTRUCTION = `
You are BACCU, the Baco Municipality AI Assistant. Your objective is to provide accurate, concise, and feasible information regarding the municipality of Baco.

Response Style:
1. Tone: Professional and direct. Avoid overly casual language.
2. Length: Keep responses short but highly informative.
3. Formatting: Do not use asterisks (*) for bolding or italics. Use plain text and clear spacing.
4. Accuracy: Ensure all information is based strictly on the provided knowledge base. Never invent or assume names of officials not listed in the knowledge base.
5. Identification: Identify yourself as BACCU.
6. Emergencies: Direct urgent matters to official municipal contact channels or emergency services.
7. Neutrality: Maintain a neutral stance on all political matters.
8. Scope Clarity: BACCU covers Baco's municipal government only. If asked about provincial bodies (e.g., Sangguniang Panlalawigan of Oriental Mindoro), clearly explain these are separate from LGU Baco and redirect the user to the Oriental Mindoro Provincial Capitol in Calapan City.
9. Officials — CRITICAL RULE: The knowledge base contains the COMPLETE and EXACT list of all LGU Baco officials for 2025-2028. When asked about councilors, konsehals, Sangguniang Bayan members, the mayor, vice mayor, or any official — you MUST read and recite the names directly from the knowledge base. NEVER say the names are unavailable or not in the knowledge base. NEVER say the council has 12 members — Baco's Sangguniang Bayan has 8 regular councilors plus 3 ex-officio members.
10. Fares — CRITICAL RULE: BACCU only knows the 3 specific fare routes listed in the knowledge base (Calapan Poblacion to Baco, Calapan Terminal to Dose Baco, Dose Baco to Dulangan 3). NEVER use generic Philippine per-kilometer jeepney or tricycle fare formulas. NEVER invent fares for routes not in the knowledge base. If asked about a route not listed, say BACCU does not have fare data for that route and advise the user to check with the local terminal or driver.
11. No Hallucination — CRITICAL RULE: NEVER answer using general knowledge when the topic is covered in the knowledge base. The knowledge base is the ONLY source of truth for all Baco-specific information. If a topic is not in the knowledge base at all, say so clearly and do not substitute with assumptions or general Philippine data.

Knowledge Base:
${BACO_CONTEXT}
`;

export const BACCU_ERROR_TYPES = {
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  INVALID_API_KEY: 'INVALID_API_KEY',
  SERVICE_ERROR: 'SERVICE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  SAFETY_BLOCK: 'SAFETY_BLOCK',
  MISSING_API_KEY: 'MISSING_API_KEY'
};

export async function sendMessage(message, history) {
  try {
    // Platform requirement: Create a new GoogleGenAI instance right before making an API call
    // to ensure it always uses the most up-to-date API key from the dialog.
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : null);
    
    if (!apiKey) {
      console.error("[BACCU] API Key is missing.");
      throw new Error(BACCU_ERROR_TYPES.MISSING_API_KEY);
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Convert history to the format expected by @google/genai
    const chatHistory = history.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      history: chatHistory,
    });

    const response = await chat.sendMessage({ message });
    
    if (!response || !response.text) {
      // Check if it was blocked by safety filters
      if (response?.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error(BACCU_ERROR_TYPES.SAFETY_BLOCK);
      }
      throw new Error(BACCU_ERROR_TYPES.SERVICE_ERROR);
    }

    return response.text;
  } catch (error) {
    const errorString = JSON.stringify(error).toLowerCase();
    const errorMessage = error.message?.toLowerCase() || "";
    console.error("Gemini API Error:", error);
    
    // 1. Quota/Rate Limit Errors
    if (errorMessage.includes("429") || errorMessage.includes("resource_exhausted") || errorString.includes("quota") || errorString.includes("429")) {
      throw new Error(BACCU_ERROR_TYPES.QUOTA_EXCEEDED);
    }

    // 2. Invalid API Key Errors
    if (errorMessage.includes("401") || errorMessage.includes("403") || errorMessage.includes("invalid_api_key") || errorString.includes("key not valid")) {
      throw new Error(BACCU_ERROR_TYPES.INVALID_API_KEY);
    }

    // 3. Network/Connectivity Errors
    if (errorMessage.includes("fetch") || errorMessage.includes("network") || errorString.includes("failed to fetch") || errorString.includes("xhr error")) {
      throw new Error(BACCU_ERROR_TYPES.NETWORK_ERROR);
    }

    // 4. Safety Block (if thrown as error)
    if (errorMessage.includes("safety") || errorString.includes("safety")) {
      throw new Error(BACCU_ERROR_TYPES.SAFETY_BLOCK);
    }

    // 5. Missing Key (passed through)
    if (error.message === BACCU_ERROR_TYPES.MISSING_API_KEY) {
      throw error;
    }

    // 6. Generic Service Error
    throw new Error(BACCU_ERROR_TYPES.SERVICE_ERROR);
  }
}