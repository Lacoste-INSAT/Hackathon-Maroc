// ─────────────────────────────────────────────────────────────
// Local Drug Interaction Knowledge Base
// ─────────────────────────────────────────────────────────────
// Source: WHO Essential Medicines, FDA safety labels, clinical pharmacology databases
// This enables the Second Brain to provide immediate value without
// needing cross-patient data in the Knowledge Graph.
// ─────────────────────────────────────────────────────────────

export interface DrugInteraction {
  drugs: string[];           // INN names involved (lowercase)
  severity: 'high' | 'moderate' | 'low';
  effect: string;            // Short clinical description
  action: string;            // What the doctor should do
}

export interface DrugWarning {
  drug: string;              // INN name (lowercase)
  warning: string;           // Key clinical warning
  monitoring: string;        // What to monitor
}

// Known drug-drug interactions (INN names, lowercase)
export const DRUG_INTERACTIONS: DrugInteraction[] = [
  // Analgesic interactions
  {
    drugs: ['paracetamol', 'tramadol'],
    severity: 'moderate',
    effect: 'Combined hepatotoxic potential. Tramadol metabolism may increase paracetamol toxicity.',
    action: 'Monitor total daily paracetamol dose. Do not exceed 3g/day when combined.'
  },
  {
    drugs: ['tramadol', 'prednisone'],
    severity: 'moderate',
    effect: 'Both lower seizure threshold. Increased risk of convulsions.',
    action: 'Monitor for seizure activity. Consider alternative analgesic.'
  },
  {
    drugs: ['aspirin', 'ramipril'],
    severity: 'moderate',
    effect: 'NSAIDs/aspirin may reduce antihypertensive effect of ACE inhibitors.',
    action: 'Monitor blood pressure. Use lowest effective aspirin dose.'
  },
  {
    drugs: ['aspirin', 'prednisone'],
    severity: 'high',
    effect: 'Significantly increased risk of GI bleeding and gastric ulceration.',
    action: 'Add gastroprotection (PPI). Monitor for GI symptoms.'
  },
  {
    drugs: ['ramipril', 'allopurinol'],
    severity: 'moderate',
    effect: 'Increased risk of hypersensitivity reactions and Stevens-Johnson syndrome.',
    action: 'Monitor for skin rashes, fever, or allergic reactions.'
  },
  {
    drugs: ['ramipril', 'potassium'],
    severity: 'high',
    effect: 'ACE inhibitors increase potassium. Risk of hyperkalemia.',
    action: 'Monitor serum potassium regularly.'
  },
  {
    drugs: ['pravastatin', 'ramipril'],
    severity: 'low',
    effect: 'Generally safe combination. Monitor for myalgia with statin.',
    action: 'Routine monitoring of liver enzymes and CK if symptomatic.'
  },
  {
    drugs: ['metformin', 'ramipril'],
    severity: 'low',
    effect: 'ACE inhibitors may enhance hypoglycemic effect of metformin.',
    action: 'Monitor blood glucose more frequently.'
  },
  {
    drugs: ['omeprazole', 'metformin'],
    severity: 'low',
    effect: 'Omeprazole may reduce vitamin B12 absorption long-term.',
    action: 'Monitor B12 levels if on long-term PPI therapy.'
  },
  {
    drugs: ['tramadol', 'omeprazole'],
    severity: 'moderate',
    effect: 'Omeprazole inhibits CYP2D6, may reduce tramadol efficacy.',
    action: 'Monitor pain control. May need dose adjustment.'
  },
  {
    drugs: ['ibuprofen', 'aspirin'],
    severity: 'high',
    effect: 'Dual antiplatelet + NSAID: major GI bleed risk.',
    action: 'Avoid combination. Use paracetamol for pain instead.'
  },
  {
    drugs: ['ibuprofen', 'ramipril'],
    severity: 'moderate',
    effect: 'NSAIDs reduce ACE inhibitor efficacy and increase renal risk.',
    action: 'Monitor renal function and blood pressure.'
  },
  {
    drugs: ['amlodipine', 'atorvastatin'],
    severity: 'moderate',
    effect: 'Amlodipine increases atorvastatin plasma levels via CYP3A4.',
    action: 'Limit atorvastatin to 20mg/day when combined with amlodipine.'
  },
  {
    drugs: ['furosemide', 'ramipril'],
    severity: 'moderate',
    effect: 'First-dose hypotension risk with ACE inhibitor + diuretic.',
    action: 'Start ACE inhibitor at low dose. Monitor BP after first dose.'
  },
  {
    drugs: ['prednisone', 'metformin'],
    severity: 'high',
    effect: 'Corticosteroids cause hyperglycemia, directly opposing metformin.',
    action: 'Monitor blood glucose closely. May need insulin supplementation.'
  },
  {
    drugs: ['allopurinol', 'amoxicillin'],
    severity: 'moderate',
    effect: 'Increased risk of skin rash (up to 3x more likely).',
    action: 'Monitor for rash. Use alternative antibiotic if rash develops.'
  },
];

// Single-drug clinical warnings
export const DRUG_WARNINGS: DrugWarning[] = [
  {
    drug: 'paracetamol',
    warning: 'Hepatotoxicity risk above 4g/day. Leading cause of acute liver failure.',
    monitoring: 'Liver function tests if chronic use or >3g/day.'
  },
  {
    drug: 'tramadol',
    warning: 'Seizure risk, serotonin syndrome potential, dependency risk.',
    monitoring: 'Limit to shortest duration. Monitor CNS effects.'
  },
  {
    drug: 'ramipril',
    warning: 'Contraindicated in pregnancy. Risk of angioedema.',
    monitoring: 'Renal function + potassium at baseline and 1-2 weeks after initiation.'
  },
  {
    drug: 'prednisone',
    warning: 'Adrenal suppression if >7.5mg/day for >3 weeks. Taper required.',
    monitoring: 'Blood glucose, blood pressure, bone density if long-term.'
  },
  {
    drug: 'allopurinol',
    warning: 'Start low (100mg). May precipitate acute gout flare on initiation.',
    monitoring: 'Uric acid level. Full blood count periodically.'
  },
  {
    drug: 'pravastatin',
    warning: 'Myopathy risk. Report unexplained muscle pain immediately.',
    monitoring: 'Liver enzymes at baseline and clinically as needed.'
  },
  {
    drug: 'aspirin',
    warning: 'GI bleeding risk increases with age and concurrent anticoagulants.',
    monitoring: 'Watch for signs of GI bleeding. Consider PPI co-prescription in elderly.'
  },
  {
    drug: 'metformin',
    warning: 'Lactic acidosis risk with renal impairment. Hold before contrast.',
    monitoring: 'eGFR at least annually. Discontinue if eGFR <30.'
  },
  {
    drug: 'amlodipine',
    warning: 'Peripheral edema common. Avoid grapefruit juice.',
    monitoring: 'Blood pressure, heart rate, ankle swelling.'
  },
  {
    drug: 'omeprazole',
    warning: 'Long-term use: hypomagnesemia, B12 deficiency, fracture risk.',
    monitoring: 'Magnesium levels if >1 year. Review need for PPI regularly.'
  },
  {
    drug: 'furosemide',
    warning: 'Electrolyte depletion (K+, Na+, Mg2+). Ototoxicity at high doses.',
    monitoring: 'Electrolytes, renal function, daily weights.'
  },
  {
    drug: 'ibuprofen',
    warning: 'GI ulceration risk. Cardiovascular risk with prolonged use.',
    monitoring: 'Renal function, blood pressure, GI symptoms.'
  },
  {
    drug: 'amoxicillin',
    warning: 'Allergic reactions common. Cross-reactivity with cephalosporins.',
    monitoring: 'Signs of allergy. C. difficile if prolonged course.'
  },
  {
    drug: 'atorvastatin',
    warning: 'Myopathy/rhabdomyolysis risk. Increased by CYP3A4 inhibitors.',
    monitoring: 'Lipid profile, liver enzymes, muscle symptoms.'
  },
];

/**
 * Find all relevant drug interactions for a list of drug names.
 * Matches are case-insensitive and work with INN names.
 */
export function findDrugInteractions(drugNames: string[]): DrugInteraction[] {
  const normalized = drugNames.map(d => d.toLowerCase().trim());
  
  return DRUG_INTERACTIONS.filter(interaction => {
    // Check if at least 2 of the interaction's drugs are in the current list
    const matchCount = interaction.drugs.filter(d => 
      normalized.some(n => n.includes(d) || d.includes(n))
    ).length;
    return matchCount >= 2;
  });
}

/**
 * Find warnings for drugs in the current prescription.
 */
export function findDrugWarnings(drugNames: string[]): DrugWarning[] {
  const normalized = drugNames.map(d => d.toLowerCase().trim());
  
  return DRUG_WARNINGS.filter(w =>
    normalized.some(n => n.includes(w.drug) || w.drug.includes(n))
  );
}

/**
 * Generate a complete Second Brain insight from local knowledge.
 * This works immediately with zero patient data.
 */
export function generateLocalInsight(drugNames: string[]): string {
  const interactions = findDrugInteractions(drugNames);
  const warnings = findDrugWarnings(drugNames);
  
  if (interactions.length === 0 && warnings.length === 0) {
    return '';
  }
  
  const lines: string[] = [];
  lines.push('Second Brain — Clinical Alerts:');
  lines.push('');
  
  // High severity interactions first
  const highInteractions = interactions.filter(i => i.severity === 'high');
  const moderateInteractions = interactions.filter(i => i.severity === 'moderate');
  
  if (highInteractions.length > 0) {
    for (const i of highInteractions) {
      lines.push(`[HIGH RISK] ${i.drugs.join(' + ')}: ${i.effect}`);
      lines.push(`  Action: ${i.action}`);
    }
  }
  
  if (moderateInteractions.length > 0) {
    for (const i of moderateInteractions.slice(0, 3)) {
      lines.push(`[MODERATE] ${i.drugs.join(' + ')}: ${i.effect}`);
      lines.push(`  Action: ${i.action}`);
    }
  }
  
  // Key warnings (only for drugs with high-risk profiles)
  const keyWarnings = warnings.filter(w => 
    !interactions.some(i => i.drugs.includes(w.drug)) // skip if already covered
  ).slice(0, 2);
  
  if (keyWarnings.length > 0) {
    lines.push('');
    for (const w of keyWarnings) {
      lines.push(`${w.drug}: ${w.warning}`);
      lines.push(`  Monitor: ${w.monitoring}`);
    }
  }
  
  return lines.join('\n');
}
