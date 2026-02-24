import type { BeverageType } from '@/config/beverage-types'

/**
 * A single CFR section relevant to alcohol label verification.
 * Summaries are plain-English — written for humans, not lawyers.
 */
export interface RegulationSection {
  /** Full citation, e.g. "27 CFR 5.63" */
  citation: string
  /** Section number only, e.g. "5.63" — used for anchor links and lookups */
  section: string
  /** CFR Part number (4 = Wine, 5 = Spirits, 7 = Malt, 16 = Health Warning) */
  part: number
  /** Short title */
  title: string
  /** Plain-English 1-2 sentence summary */
  summary: string
  /** Bullet points of what the section requires */
  keyRequirements: string[]
  /** Which beverage types this applies to */
  appliesTo: BeverageType[]
  /** Field keys from FIELD_TOOLTIPS this section relates to */
  relatedFields: string[]
  /** Subpart name for grouping */
  subpart: string
  /** Deep link to eCFR */
  ecfrUrl: string
}

export interface RegulationPart {
  part: number
  title: string
  description: string
  ecfrUrl: string
  sections: RegulationSection[]
}

// ---------------------------------------------------------------------------
// Part 5 — Distilled Spirits
// ---------------------------------------------------------------------------

const PART_5_SECTIONS: RegulationSection[] = [
  {
    citation: '27 CFR 5.61',
    section: '5.61',
    part: 5,
    title: 'What a spirits label must include',
    summary:
      'Lists every piece of information that must appear on a distilled spirits label before it can be sold.',
    keyRequirements: [
      'Brand name',
      'Class and/or type designation',
      'Alcohol content',
      'Net contents',
      'Name and address of bottler or importer',
      'Country of origin (if imported)',
      'GOVERNMENT WARNING statement',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: [
      'brand_name',
      'class_type',
      'alcohol_content',
      'net_contents',
      'name_and_address',
      'health_warning',
      'country_of_origin',
    ],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.61',
  },
  {
    citation: '27 CFR 5.63',
    section: '5.63',
    part: 5,
    title: 'Brand name requirements',
    summary:
      'The brand name must appear on the front label and cannot mislead consumers about the product\u2019s identity, origin, or age.',
    keyRequirements: [
      'Must appear on the brand (front) label',
      'Cannot be misleading about origin, age, or identity',
      'Cannot simulate a government stamp or guarantee',
      'Cannot use "bonded" unless actually bottled in bond',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['brand_name'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.63',
  },
  {
    citation: '27 CFR 5.64',
    section: '5.64',
    part: 5,
    title: 'Fanciful name requirements',
    summary:
      'If the label uses a distinctive or fanciful name (like "Single Barrel Reserve"), it cannot be confused with the class/type designation.',
    keyRequirements: [
      'Must not be misleading about product type or class',
      'Cannot substitute for the required class/type designation',
      'The class/type must still appear separately and prominently',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['fanciful_name', 'class_type'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.64',
  },
  {
    citation: '27 CFR 5.65',
    section: '5.65',
    part: 5,
    title: 'Alcohol content statement',
    summary:
      'The label must state alcohol content as a percentage by volume ("%\u00a0Alc./Vol." or "Proof"). The stated value must be within a narrow tolerance of the actual content.',
    keyRequirements: [
      'Expressed as "__ % Alcohol by Volume" or "__ % Alc./Vol."',
      'May also (or instead) state proof',
      'Must be within \u00b10.15% of actual alcohol content for most spirits',
      'Appears on front or back label',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['alcohol_content'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.65',
  },
  {
    citation: '27 CFR 5.66',
    section: '5.66',
    part: 5,
    title: 'Name and address of bottler/distiller',
    summary:
      'The label must identify who bottled (or imported) the product with their name and city/state. A qualifying phrase like "Bottled by" or "Distilled by" must precede it.',
    keyRequirements: [
      'Name and city/state of the bottler, distiller, or importer',
      'Must be preceded by a qualifying phrase (e.g., "Distilled by")',
      'Trade names are acceptable if registered with TTB',
      'For imported spirits, the U.S. importer must also be listed',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['name_and_address', 'qualifying_phrase'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.66',
  },
  {
    citation: '27 CFR 5.70',
    section: '5.70',
    part: 5,
    title: 'Net contents',
    summary:
      'The label must state how much liquid is in the container, in metric units. Only TTB-approved standard sizes are allowed.',
    keyRequirements: [
      'Stated in metric units (mL or L)',
      'Must conform to standards of fill (approved container sizes)',
      'Placed on front label or blown into the glass',
      'Not less than 1.6mm (containers \u2264200mL) or 3.2mm (larger) type size',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['net_contents', 'standards_of_fill'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.70',
  },
  {
    citation: '27 CFR 5.71',
    section: '5.71',
    part: 5,
    title: 'Standards of fill for spirits',
    summary:
      'Spirits may only be sold in specific approved container sizes (e.g., 50mL, 375mL, 750mL, 1L, 1.75L).',
    keyRequirements: [
      'Only TTB-approved container sizes are permitted',
      'Common sizes: 50mL, 200mL, 375mL, 750mL, 1L, 1.75L',
      'Non-standard sizes require TTB approval',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['net_contents', 'standards_of_fill'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.71',
  },
  {
    citation: '27 CFR 5.74',
    section: '5.74',
    part: 5,
    title: 'Country of origin for imported spirits',
    summary:
      'Imported spirits must clearly state their country of origin (e.g., "Product of Scotland").',
    keyRequirements: [
      '"Product of [country]" or "Made in [country]" required',
      'Must appear on a label attached to the container',
      'Country must be stated in English',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['country_of_origin'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.74',
  },
  {
    citation: '27 CFR 5.141',
    section: '5.141',
    part: 5,
    title: 'Age and percentage statements',
    summary:
      'If a spirits label states an age or uses age-related terms (like "aged" or "old"), the actual aging period must be truthful. Bourbon and rye under 4 years must include an age statement.',
    keyRequirements: [
      'Age must be stated in years (and months if desired)',
      'Bourbon/rye aged less than 4 years must include an age statement',
      'Blends state the age of the youngest component',
      '"Old", "aged", or similar terms trigger the age statement requirement',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['age_statement'],
    subpart: 'Subpart H — Statements of Age and Percentage',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.141',
  },
  {
    citation: '27 CFR 5.142',
    section: '5.142',
    part: 5,
    title: 'State of distillation',
    summary:
      'If a state is referenced on the label in connection with the distilling process, the spirit must actually have been distilled in that state.',
    keyRequirements: [
      'State name on the label must reflect actual place of distillation',
      'Required for types like "Kentucky Straight Bourbon"',
      'Cannot mislead consumers about geographic origin of distillation',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['state_of_distillation'],
    subpart: 'Subpart H — Statements of Age and Percentage',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.142',
  },
  {
    citation: '27 CFR 5.143',
    section: '5.143',
    part: 5,
    title: 'Percentage statements for blends',
    summary:
      'Labels on blended spirits must disclose the percentage of straight whiskey (or other specified spirits) in the blend.',
    keyRequirements: [
      'Blend percentage must be stated if the product is a blend',
      'Percentage refers to the straight whiskey content',
      'Must be stated on a conspicuous label',
    ],
    appliesTo: ['distilled_spirits'],
    relatedFields: ['class_type'],
    subpart: 'Subpart H — Statements of Age and Percentage',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-5.143',
  },
]

// ---------------------------------------------------------------------------
// Part 4 — Wine
// ---------------------------------------------------------------------------

const PART_4_SECTIONS: RegulationSection[] = [
  {
    citation: '27 CFR 4.25',
    section: '4.25',
    part: 4,
    title: 'Appellation of origin',
    summary:
      'If a wine label names where the grapes were grown (e.g., "Napa Valley"), at least 75-85% of the grapes must actually come from that area.',
    keyRequirements: [
      'Country appellation: 75% of grapes from that country',
      'State/county: 75% of grapes from that state/county',
      'AVA (American Viticultural Area): 85% of grapes from that AVA',
      'Cannot use an appellation unless the wine was fully finished in the named state',
    ],
    appliesTo: ['wine'],
    relatedFields: ['appellation_of_origin'],
    subpart: 'Subpart C — Standards of Identity',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-4.25',
  },
  {
    citation: '27 CFR 4.27',
    section: '4.27',
    part: 4,
    title: 'Vintage year requirements',
    summary:
      'If a wine label states a vintage year, at least 85% (AVA) or 95% (country/state) of the grapes must have been harvested that year.',
    keyRequirements: [
      '95% of grapes from that year for country/state appellation',
      '85% of grapes from that year if using an AVA appellation',
      'An appellation of origin is required to use a vintage date',
    ],
    appliesTo: ['wine'],
    relatedFields: ['vintage_year', 'appellation_of_origin'],
    subpart: 'Subpart C — Standards of Identity',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-4.27',
  },
  {
    citation: '27 CFR 4.32',
    section: '4.32',
    part: 4,
    title: 'What a wine label must include',
    summary:
      'Lists everything required on a wine label: brand name, class/type, alcohol content, net contents, name and address, and the health warning.',
    keyRequirements: [
      'Brand name',
      'Class, type, or other designation',
      'Alcohol content (% by volume)',
      'Name and address of bottler or importer',
      'Net contents',
      'Sulfite declaration (if applicable)',
      'GOVERNMENT WARNING statement',
    ],
    appliesTo: ['wine'],
    relatedFields: [
      'brand_name',
      'class_type',
      'alcohol_content',
      'net_contents',
      'name_and_address',
      'sulfite_declaration',
      'health_warning',
    ],
    subpart: 'Subpart D — Labeling Requirements',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-4.32',
  },
  {
    citation: '27 CFR 4.33',
    section: '4.33',
    part: 4,
    title: 'Brand name requirements for wine',
    summary:
      'The wine brand name must appear on the front label and cannot mislead consumers about the wine\u2019s type, origin, or characteristics.',
    keyRequirements: [
      'Must appear on the brand (front) label',
      'Cannot mislead about origin, type, or grape variety',
      'Geographic brand names have specific rules to avoid confusion',
    ],
    appliesTo: ['wine'],
    relatedFields: ['brand_name'],
    subpart: 'Subpart D — Labeling Requirements',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-4.33',
  },
  {
    citation: '27 CFR 4.34',
    section: '4.34',
    part: 4,
    title: 'Class/type designation for wine',
    summary:
      'The label must state the type of wine (e.g., "Table Wine", "Sparkling Wine") using TTB-approved designations.',
    keyRequirements: [
      'Must use a TTB-recognized class or type designation',
      'Varietal names (e.g., "Cabernet Sauvignon") can substitute for type',
      'Semi-generic names (e.g., "Champagne") have specific rules',
    ],
    appliesTo: ['wine'],
    relatedFields: ['class_type', 'grape_varietal'],
    subpart: 'Subpart D — Labeling Requirements',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-4.34',
  },
  {
    citation: '27 CFR 4.35',
    section: '4.35',
    part: 4,
    title: 'Name and address on wine labels',
    summary:
      'The wine label must identify the bottler or importer with their name and city/state, preceded by a qualifying phrase.',
    keyRequirements: [
      'Name and address (city + state) of bottler, packer, or importer',
      'Qualifying phrase like "Produced and bottled by" or "Cellared and bottled by"',
      '"Estate bottled" requires vineyard ownership and winery in the same AVA',
    ],
    appliesTo: ['wine'],
    relatedFields: ['name_and_address', 'qualifying_phrase'],
    subpart: 'Subpart D — Labeling Requirements',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-4.35',
  },
  {
    citation: '27 CFR 4.36',
    section: '4.36',
    part: 4,
    title: 'Alcohol content for wine',
    summary:
      'Wine labels must state alcohol content as a percentage by volume. Table wine can use "Table Wine" as an alternative if between 7-14%.',
    keyRequirements: [
      'Stated as "__ % Alcohol by Volume" or "Alc. __ % by Vol."',
      'Tolerance: \u00b11.5% for table wine (7-14%), \u00b11.0% for others',
      '"Table Wine" or "Light Wine" may substitute for a numeric statement if 7-14%',
    ],
    appliesTo: ['wine'],
    relatedFields: ['alcohol_content'],
    subpart: 'Subpart D — Labeling Requirements',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-4.36',
  },
  {
    citation: '27 CFR 4.37',
    section: '4.37',
    part: 4,
    title: 'Net contents for wine',
    summary:
      'Wine labels must state the volume in metric units. Only approved standard sizes are allowed.',
    keyRequirements: [
      'Metric units (mL or L) required',
      'Must conform to standards of fill',
      'Type size minimums based on container size',
    ],
    appliesTo: ['wine'],
    relatedFields: ['net_contents', 'standards_of_fill'],
    subpart: 'Subpart D — Labeling Requirements',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-4.37',
  },
]

// ---------------------------------------------------------------------------
// Part 7 — Malt Beverages
// ---------------------------------------------------------------------------

const PART_7_SECTIONS: RegulationSection[] = [
  {
    citation: '27 CFR 7.61',
    section: '7.61',
    part: 7,
    title: 'What a malt beverage label must include',
    summary:
      'Lists everything required on a beer or malt beverage label: brand name, class designation, net contents, name and address, and the health warning.',
    keyRequirements: [
      'Brand name',
      'Class designation (e.g., "Ale", "Lager", "Stout")',
      'Net contents',
      'Name and address of brewer or importer',
      'GOVERNMENT WARNING statement',
      'Alcohol content (if required by state law or voluntarily disclosed)',
    ],
    appliesTo: ['malt_beverage'],
    relatedFields: [
      'brand_name',
      'class_type',
      'net_contents',
      'name_and_address',
      'health_warning',
      'alcohol_content',
    ],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-7.61',
  },
  {
    citation: '27 CFR 7.63',
    section: '7.63',
    part: 7,
    title: 'Brand name for malt beverages',
    summary:
      'The brand name must appear on the front label and cannot mislead consumers about the product type or origin.',
    keyRequirements: [
      'Must appear on the brand (front) label',
      'Cannot mislead about the product\u2019s identity or origin',
      'Cannot simulate a government stamp or approval',
    ],
    appliesTo: ['malt_beverage'],
    relatedFields: ['brand_name'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-7.63',
  },
  {
    citation: '27 CFR 7.64',
    section: '7.64',
    part: 7,
    title: 'Class designation for malt beverages',
    summary:
      'The label must use a recognized class term like "Beer", "Ale", "Lager", "Stout", or "Porter".',
    keyRequirements: [
      'Must use a TTB-recognized class designation',
      'Common designations: Beer, Ale, Lager, Stout, Porter, Malt Liquor',
      'Flavored malt beverages have additional rules',
    ],
    appliesTo: ['malt_beverage'],
    relatedFields: ['class_type'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-7.64',
  },
  {
    citation: '27 CFR 7.65',
    section: '7.65',
    part: 7,
    title: 'Alcohol content for malt beverages',
    summary:
      'Malt beverages may (and in some states must) state alcohol content. When stated, it must be accurate and follow specific formatting rules.',
    keyRequirements: [
      'Optional at the federal level but required by some states',
      'Expressed as "Alc. __ % by Vol." or similar',
      'Must be within prescribed tolerance',
      'Cannot be displayed in a way that emphasizes strength',
    ],
    appliesTo: ['malt_beverage'],
    relatedFields: ['alcohol_content'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-7.65',
  },
  {
    citation: '27 CFR 7.66',
    section: '7.66',
    part: 7,
    title: 'Name and address on malt beverage labels',
    summary:
      'The label must identify the brewer or importer with their name and city/state, preceded by a qualifying phrase like "Brewed by".',
    keyRequirements: [
      'Name and address (city + state) of brewer, packer, or importer',
      'Must include a qualifying phrase (e.g., "Brewed by", "Brewed and bottled by")',
      'Trade names acceptable if registered with TTB',
    ],
    appliesTo: ['malt_beverage'],
    relatedFields: ['name_and_address', 'qualifying_phrase'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-7.66',
  },
  {
    citation: '27 CFR 7.70',
    section: '7.70',
    part: 7,
    title: 'Net contents for malt beverages',
    summary:
      'Malt beverage labels must state the volume in U.S. fluid ounces or metric units.',
    keyRequirements: [
      'U.S. fluid ounces or metric units (mL, L)',
      'Type size minimums based on container size',
      'May be blown into the glass or stated on the label',
    ],
    appliesTo: ['malt_beverage'],
    relatedFields: ['net_contents', 'standards_of_fill'],
    subpart: 'Subpart E — Mandatory Label Information',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-7.70',
  },
]

// ---------------------------------------------------------------------------
// Part 16 — Health Warning Statement
// ---------------------------------------------------------------------------

const PART_16_SECTIONS: RegulationSection[] = [
  {
    citation: '27 CFR 16.20',
    section: '16.20',
    part: 16,
    title: 'Scope of the health warning requirement',
    summary:
      'Every alcohol beverage container sold in the U.S. must carry the GOVERNMENT WARNING statement. No exceptions.',
    keyRequirements: [
      'Applies to all alcohol beverages for sale in the United States',
      'Domestic and imported products alike',
      'No exemptions based on container size or alcohol content',
    ],
    appliesTo: ['distilled_spirits', 'wine', 'malt_beverage'],
    relatedFields: ['health_warning'],
    subpart: 'Subpart B — Health Warning Statement',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-16.20',
  },
  {
    citation: '27 CFR 16.21',
    section: '16.21',
    part: 16,
    title: 'Mandatory health warning text',
    summary:
      'The exact text of the GOVERNMENT WARNING that must appear on every label — word-for-word, no substitutions or paraphrasing allowed.',
    keyRequirements: [
      'Must read: "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems."',
      '"GOVERNMENT WARNING" must be in all caps or bold',
      'Text must be on a contrasting background',
      'No other information within the warning statement',
    ],
    appliesTo: ['distilled_spirits', 'wine', 'malt_beverage'],
    relatedFields: ['health_warning'],
    subpart: 'Subpart B — Health Warning Statement',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-16.21',
  },
  {
    citation: '27 CFR 16.22',
    section: '16.22',
    part: 16,
    title: 'Health warning size and legibility',
    summary:
      'Rules for how big the warning text must be, based on the container size. Larger containers need larger text.',
    keyRequirements: [
      'Containers \u2264237mL (8 oz): minimum 1mm type size',
      'Containers 237mL\u20133L: minimum 2mm type size',
      'Containers >3L: minimum 3mm type size',
      'Must be readily legible, on a contrasting background',
      'Must appear on a label affixed to the container',
    ],
    appliesTo: ['distilled_spirits', 'wine', 'malt_beverage'],
    relatedFields: ['health_warning'],
    subpart: 'Subpart B — Health Warning Statement',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/section-16.22',
  },
]

// ---------------------------------------------------------------------------
// Organized by Part
// ---------------------------------------------------------------------------

export const REGULATION_PARTS: RegulationPart[] = [
  {
    part: 5,
    title: 'Distilled Spirits',
    description:
      'Covers age statements, proof/ABV tolerances, state of distillation claims, standards of fill, and bottled-in-bond rules unique to spirits.',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/part-5',
    sections: PART_5_SECTIONS,
  },
  {
    part: 4,
    title: 'Wine',
    description:
      'Covers appellation of origin, vintage year, varietal percentages, sulfite declarations, and "Estate Bottled" rules unique to wine.',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/part-4',
    sections: PART_4_SECTIONS,
  },
  {
    part: 7,
    title: 'Malt Beverages',
    description:
      'Covers class designations (Ale, Lager, Stout), optional vs. state-required ABV disclosure, and flavored malt beverage rules.',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/part-7',
    sections: PART_7_SECTIONS,
  },
  {
    part: 16,
    title: 'Health Warning',
    description:
      'The mandatory GOVERNMENT WARNING statement required on every alcohol beverage sold in the United States — exact text, formatting, and size rules.',
    ecfrUrl: 'https://www.ecfr.gov/current/title-27/part-16',
    sections: PART_16_SECTIONS,
  },
]

/** Flat array of all curated sections for convenience. */
export const ALL_SECTIONS: RegulationSection[] = REGULATION_PARTS.flatMap(
  (p) => p.sections,
)
