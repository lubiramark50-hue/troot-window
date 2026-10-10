/**
 * Troot Window — which category a posting belongs to.
 *
 * Kept separate from the sync so the mapping can be tested on real titles
 * (`npm run test:categories`) without the sync hitting the network.
 *
 * Only the six categories the table allows exist here; anything else is "Other".
 * Technology is tested first because software titles borrow field words
 * ("Staff Infrastructure Software Engineer" is not construction work).
 *
 * Boundaries are per alternative on purpose. A shared trailing \b after a group
 * silently kills every stem in it — `\b(electric|plumb)\b` cannot match
 * "Electrical", "Plumbing" or even the plural "Drivers", which is how a
 * "Rwanda Plumbing and Mechanical Engineer" vacancy was filed as Other.
 */
export const CATEGORY_RULES = [
  ['Technology', /\bsoftware\b|\bdevelopers?\b|\bprogramm(er|ing)s?\b|\bengineering manager\b|\bdevops\b|\bsite reliability\b|\bsre\b|\bdata (analyst|analytics|architect|engineer|lead|manager|scientist|specialist)s?\b|\bmachine learning\b|\bartificial intelligence\b|\bai\b|\bcyber\w*|\binformation (technology|security|systems)\b|\bit\b|\bhelp ?desk\b|\bservice desk\b|\bqa\b|\bquality assurance\b|\bproduct (manager|designer)\b|\bux\b|\bui\b|\bnetwork (engineer|administrator|architect)s?\b|\bdatabase\w*|\bweb\b|\bandroid\b|\bios\b|\bmobile (developer|architect|engineer)s?\b|\banalytics engineer\b|\bsystems? (administrator|engineer)s?\b|\bfull.?stack\b|\bback.?end\b|\bfront.?end\b|\bcloud\b|\bsecurity engineer\b|\btechnical (lead|writer|support)\b|\bfirmware\b|\b(solutions?|enterprise|software) architect\b|\bsolutions? engineer\b/i],
  ['Construction', /\bconstruction\w*|\bbuilding\b|\bcivil\b|\bsite (engineer|manager|supervis\w+)|\barchitects?\b|\barchitecture\b|\bquantity survey\w*|\bsurveyors?\b|\bbricklay\w*|\bmason\w*|\bconcrete\b|\bscaffold\w*|\bearthwork\w*/i],
  ['Trades', /\belectric\w*|\bplumb\w*|\bweld\w*|\bmechanic\w*|\bmechanical\b|\btechnicians?\b|\btechnical\b|\bmaintenance\b|\bartisan\w*|\bcarpent\w*|\bjoiners?\b|\bjoinery\b|\bfitters?\b|\bfitting\b|\binstall\w*|\bsolar\b|\bhvac\b|\brefrigerat\w*|\bpaint\w*|\btailor\w*|\bfabricat\w*/i],
  ['Hospitality', /\bhospitality\b|\bhotels?\b|\brestaurant\w*|\bchefs?\b|\bcooks?\b|\bcooking\b|\bbaristas?\b|\bwait(er|ress|ers|resses|ing|staff)\b|\bhousekeep\w*|\btourism\b|\btour guide\b|\bcatering\b|\bfood service\b|\bkitchen\b|\bfront desk\b|\breception\w*/i],
  ['Transport', /\btransport\w*|\bdrivers?\b|\bdriving\b|\blogistics\b|\bdeliver(y|ies)\b|\bdispatch\w*|\bfleet\b|\bwarehouse\w*|\bstorekeepers?\b|\briders?\b|\bcouriers?\b|\bdistribution\b|\bshipping\b|\bclearing\b|\bfreight\b/i],
];

/**
 * Business and field roles that share words with the technology and trades
 * lists ("Sales Network", "Technical Sales", "Business Development") must not
 * be filed by that word alone.
 */
export const NON_TECH_OVERRIDE =
  /\b(sales|account (executive|manager)|business development|marketing|brand|communications?|finance|financial|accounting|accountant|audit|treasury|legal|counsel|compliance|human resources|\bhr\b|people (ops|operations)|talent|recruit|payroll|procurement|supply chain|operations manager|customer (service|care|support|success)|call cent(er|re)|administrative|executive assistant|partnerships|community manager)\b/i;

/** Words that make a title unambiguously technical even when it also names a
 *  business function ("Technical Sales Engineer" is still a sales role). */
export const STRONG_TECH =
  /\b(software|developer|programmer|devops|data (analyst|scientist|engineer)|machine learning|cyber|information technology|information security|help ?desk|\bqa\b|quality assurance|network (engineer|administrator|architect)|database|full.?stack|back.?end|front.?end|systems? (administrator|engineer))\b/i;

/** "IS" as a department prefix ("IS - Administrator Analyst"). Case-sensitive on
 *  purpose: matching the ordinary word "is" would file half the board as tech. */
const IS_PREFIX = /(?:^|[\s(])IS\s*[-–—/]|(?:^|[\s(])IS\s*$/;

const CATEGORY_NAMES = new Set(CATEGORY_RULES.map(([name]) => name));

/**
 * The job title is the reliable signal, so it is matched first; the employer's
 * own department/team labels are only a fallback. Descriptions are deliberately
 * not used — they are long enough to contain any keyword by accident, which is
 * how "Data Analyst" once became a Trades role.
 */
export function mapCategory(title, ...hints) {
  const headline = String(title ?? '');
  // The guard covers Technology and Trades only. A field role that happens to
  // name a business function ("Logistics Network & Operations Manager") is still
  // a Transport vacancy, so those rules stay in play.
  const businessTitle = NON_TECH_OVERRIDE.test(headline) && !STRONG_TECH.test(headline);
  const allowed = (name) => !(businessTitle && (name === 'Technology' || name === 'Trades'));

  const match = (text) => {
    if (!text) return null;
    if (allowed('Technology') && IS_PREFIX.test(text)) return 'Technology';
    for (const [name, re] of CATEGORY_RULES) if (allowed(name) && re.test(text)) return name;
    return null;
  };

  return match(headline) ?? match(hints.filter(Boolean).join(' ')) ?? 'Other';
}

/** Exported for the check script, so it can prove every name is one the schema allows. */
export const categoryNames = [...CATEGORY_NAMES];
