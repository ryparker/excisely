export interface SeedApplicant {
  companyName: string
  contactEmail: string
  contactName: string | null
  notes: string | null
}

export const SEED_APPLICANTS: SeedApplicant[] = [
  // Large importers (5)
  {
    companyName: 'Pacific Rim Imports LLC',
    contactEmail: 'compliance@pacificrim-imports.com',
    contactName: 'David Tanaka',
    notes: 'High-volume importer — Japanese whisky, sake, and shochu',
  },
  {
    companyName: 'European Spirits Group',
    contactEmail: 'labels@eurospiritsgroup.com',
    contactName: 'Marie Fontaine',
    notes: 'Major EU spirits importer — Scotch, cognac, grappa',
  },
  {
    companyName: 'Atlantic Wine Merchants',
    contactEmail: 'regulatory@atlanticwine.com',
    contactName: 'James Harrington',
    notes: 'Largest wine importer on the East Coast',
  },
  {
    companyName: 'East Coast Beverage Distributors',
    contactEmail: 'ttb@eastcoastbev.com',
    contactName: 'Patricia Nguyen',
    notes: 'Full-service distributor — spirits, wine, and beer',
  },
  {
    companyName: 'Global Spirits Trading',
    contactEmail: 'compliance@globalspirits.com',
    contactName: 'Raj Patel',
    notes: 'Multi-national spirits portfolio — 200+ brands',
  },
  // Major domestic (5)
  {
    companyName: 'Old Tom Distillery',
    contactEmail: 'labeling@oldtomdistillery.com',
    contactName: 'Thomas Blackwell',
    notes: 'Kentucky bourbon producer — established 1892',
  },
  {
    companyName: 'Mountain Creek Brewing Co.',
    contactEmail: 'compliance@mountaincreekbrew.com',
    contactName: 'Sarah Bergstrom',
    notes: 'Colorado craft brewery — 50,000 BBL/year',
  },
  {
    companyName: 'Napa Valley Estate Wines',
    contactEmail: 'legal@napavalleyestate.com',
    contactName: 'Catherine Moreau',
    notes: 'Premium estate winery — Napa Valley AVA',
  },
  {
    companyName: 'Southern Comfort Spirits',
    contactEmail: 'regulatory@southerncomfortspirits.com',
    contactName: 'William Grant',
    notes: 'Tennessee whiskey and bourbon producer',
  },
  {
    companyName: 'Blue Ridge Winery',
    contactEmail: 'info@blueridgewinery.com',
    contactName: 'Martha Ashford',
    notes: 'Virginia winery — Viognier and Cab Franc specialist',
  },
  // Mid-size (10)
  {
    companyName: 'Cascade Hop Brewing',
    contactEmail: 'labels@cascadehop.com',
    contactName: 'Mike Olsen',
    notes: 'Pacific Northwest brewery — IPA focused',
  },
  {
    companyName: 'Heritage Distillers',
    contactEmail: 'compliance@heritagedistillers.com',
    contactName: 'Daniel Reeves',
    notes: 'Small-batch craft distillery — Portland, OR',
  },
  {
    companyName: 'Sonoma Craft Cellars',
    contactEmail: 'ttb@sonomacraft.com',
    contactName: 'Elena Vasquez',
    notes: 'Sonoma County winery — organic and biodynamic',
  },
  {
    companyName: 'Great Lakes Brewing Alliance',
    contactEmail: 'regulatory@greatlakesbrew.com',
    contactName: 'Kevin Murphy',
    notes: 'Multi-location brewery group — Midwest region',
  },
  {
    companyName: 'Desert Rose Tequila',
    contactEmail: 'labels@desertrosetequila.com',
    contactName: 'Carlos Mendoza',
    notes: 'Tequila importer — Jalisco partnership',
  },
  {
    companyName: 'Willamette Valley Vintners',
    contactEmail: 'compliance@wvvintners.com',
    contactName: 'Anne Foster',
    notes: 'Oregon Pinot Noir specialist',
  },
  {
    companyName: 'Liberty Bell Spirits',
    contactEmail: 'info@libertybellspirits.com',
    contactName: 'John Adams',
    notes: 'Philadelphia-based rum and gin distillery',
  },
  {
    companyName: 'Nordic Imports Inc.',
    contactEmail: 'labels@nordicimports.com',
    contactName: 'Erik Johansson',
    notes: 'Scandinavian spirits importer — aquavit and vodka',
  },
  {
    companyName: 'Lone Star Brewing Co.',
    contactEmail: 'regulatory@lonestarbrew.com',
    contactName: 'Billy Ray Thompson',
    notes: 'Texas craft brewery — lagers and ales',
  },
  {
    companyName: 'Finger Lakes Wine Group',
    contactEmail: 'ttb@fingerlakeswine.com',
    contactName: 'Rebecca Sterling',
    notes: 'New York state winery cooperative',
  },
  // Small / new (8)
  {
    companyName: 'First Batch Spirits',
    contactEmail: 'hello@firstbatchspirits.com',
    contactName: null,
    notes: 'New distillery — first COLA submission',
  },
  {
    companyName: 'Smith Family Wines',
    contactEmail: 'smithfamily@gmail.com',
    contactName: 'Robert Smith',
    notes: null,
  },
  {
    companyName: 'Hometown Brewery',
    contactEmail: 'brew@hometownbrewery.com',
    contactName: 'Jessica Cooper',
    notes: 'Nano-brewery — <500 BBL/year',
  },
  {
    companyName: 'Copper Pot Distilling',
    contactEmail: 'info@copperpot.com',
    contactName: 'Andrew Mitchell',
    notes: 'Micro-distillery — gin and whiskey',
  },
  {
    companyName: 'Sunrise Cellars',
    contactEmail: 'wine@sunrisecellars.com',
    contactName: 'Diana Reyes',
    notes: null,
  },
  {
    companyName: 'Bayou Spirits Co.',
    contactEmail: 'info@bayouspirits.com',
    contactName: null,
    notes: 'Louisiana rum startup',
  },
  {
    companyName: 'Evergreen Hard Cider',
    contactEmail: 'cider@evergreenhard.com',
    contactName: 'Tom Wallace',
    notes: 'Hard cider producer — Washington state apples',
  },
  {
    companyName: 'Coastal Seltzer Works',
    contactEmail: 'hello@coastalseltzer.com',
    contactName: 'Amy Liu',
    notes: 'Hard seltzer brand — launched Q4 2025',
  },
]
