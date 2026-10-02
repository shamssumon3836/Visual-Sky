export interface IndustryBlueprint {
  id: string;
  name: string;
  icon: string;
  badge: string;
  description: string;
  niche: string;
  targetRole: string;
  location: string;
  companySize: string;
  selectedSocials: string[];
  selectedDirectories: string[];
  suggestedPrompt: string;
}

export const INDUSTRY_BLUEPRINTS: IndustryBlueprint[] = [
  {
    id: 'b2b_saas',
    name: 'Venture-Backed SaaS Founders',
    icon: '🚀',
    badge: 'Tech & Cloud',
    description: 'B2B software founders, CTOs & VPs of Product with active platforms.',
    niche: 'B2B SaaS & Cloud Software',
    targetRole: 'Founder & CEO',
    location: 'United States & Canada',
    companySize: '11-50 employees',
    selectedSocials: ['linkedin', 'twitter', 'github'],
    selectedDirectories: ['crunchbase', 'g2', 'clutch'],
    suggestedPrompt: 'Target seed & Series-A B2B SaaS companies with verified founders and active websites.'
  },
  {
    id: 'dtc_ecommerce',
    name: 'High-Growth DTC & E-Commerce',
    icon: '🛍️',
    badge: 'Retail & Brands',
    description: 'Shopify Plus, DTC lifestyle brands, fashion, cosmetics & electronics CEOs.',
    niche: 'E-Commerce & DTC Consumer Brands',
    targetRole: 'Chief Executive Officer',
    location: 'United States & UK',
    companySize: '15-100 employees',
    selectedSocials: ['instagram', 'tiktok', 'linkedin', 'twitter'],
    selectedDirectories: ['google_search', 'trustpilot'],
    suggestedPrompt: 'Find active Shopify & consumer ecommerce brand owners with verified direct contacts.'
  },
  {
    id: 'marketing_agencies',
    name: 'Digital & Growth Agencies',
    icon: '📈',
    badge: 'Marketing Services',
    description: 'Performance marketing, SEO, paid ads, creative & web dev agency owners.',
    niche: 'Digital Marketing & Growth Agencies',
    targetRole: 'Agency Managing Director',
    location: 'San Francisco, New York & London',
    companySize: '10-50 employees',
    selectedSocials: ['linkedin', 'twitter', 'instagram'],
    selectedDirectories: ['clutch', 'google_maps', 'yellowpages'],
    suggestedPrompt: 'Target top-rated creative and performance marketing boutique agency principals.'
  },
  {
    id: 'commercial_realestate',
    name: 'Commercial Real Estate Brokers',
    icon: '🏢',
    badge: 'Real Estate & Land',
    description: 'Commercial brokers, property managers, multi-family investors & developers.',
    niche: 'Commercial Real Estate & Investment',
    targetRole: 'Principal Broker / Partner',
    location: 'Miami, Dallas & Austin, Texas',
    companySize: '5-30 employees',
    selectedSocials: ['linkedin', 'facebook', 'instagram'],
    selectedDirectories: ['google_maps', 'yellowpages', 'bbb'],
    suggestedPrompt: 'Extract active commercial property brokers and syndication investment partners.'
  },
  {
    id: 'healthcare_clinics',
    name: 'Medical Spas & Healthcare Clinics',
    icon: '🩺',
    badge: 'Healthcare & Wellness',
    description: 'Dental clinics, dermatology, private practices & MedTech healthcare operators.',
    niche: 'Private Healthcare Clinics & MedSpas',
    targetRole: 'Clinic Medical Director / Owner',
    location: 'Major US Metro Areas',
    companySize: '5-25 employees',
    selectedSocials: ['facebook', 'instagram', 'linkedin'],
    selectedDirectories: ['google_maps', 'yelp', 'yellowpages', 'bbb'],
    suggestedPrompt: 'Extract verified clinic owners and directors with direct business phone numbers.'
  },
  {
    id: 'fintech_wealth',
    name: 'FinTech & Asset Management',
    icon: '💳',
    badge: 'Finance & Banking',
    description: 'Fintech startups, registered investment advisors & wealth management partners.',
    niche: 'FinTech & Wealth Management',
    targetRole: 'Partner / Chief Investment Officer',
    location: 'New York, Charlotte & London',
    companySize: '20-100 employees',
    selectedSocials: ['linkedin', 'twitter', 'crunchbase'],
    selectedDirectories: ['zoominfo', 'crunchbase', 'clutch'],
    suggestedPrompt: 'Identify key decision makers in wealth management and early-stage FinTech.'
  },
  {
    id: 'cybersecurity_it',
    name: 'Cybersecurity & IT Infrastructure',
    icon: '🔒',
    badge: 'Enterprise Security',
    description: 'CISOs, IT Directors, cloud security providers & MSP infrastructure owners.',
    niche: 'Cybersecurity & Managed IT Services',
    targetRole: 'CISO / VP of Information Security',
    location: 'United States & Western Europe',
    companySize: '50-500 employees',
    selectedSocials: ['linkedin', 'github', 'twitter'],
    selectedDirectories: ['zoominfo', 'apollo', 'g2'],
    suggestedPrompt: 'Find enterprise security leaders and Managed Service Provider executives.'
  },
  {
    id: 'local_contractors',
    name: 'Local Commercial Contractors',
    icon: '📍',
    badge: 'Google Maps Verified',
    description: 'HVAC, commercial electrical, roofing, plumbing & general contracting owners.',
    niche: 'Commercial Contractors & Trade Services',
    targetRole: 'Business Owner & General Manager',
    location: 'Chicago, Atlanta & Houston, USA',
    companySize: '5-40 employees',
    selectedSocials: ['facebook', 'linkedin'],
    selectedDirectories: ['google_maps', 'yelp', 'bbb', 'yellowpages'],
    suggestedPrompt: 'Find verified commercial trade contractors with live phone numbers from Google Maps.'
  }
];

export const MAPS_CATEGORIES = [
  { id: 'dental', label: 'Dental & Orthodontic Clinics', icon: '🦷' },
  { id: 'law_firms', label: 'Law Firms & Legal Partners', icon: '⚖️' },
  { id: 'real_estate', label: 'Real Estate Agencies & Brokers', icon: '🏡' },
  { id: 'hvac_contractors', label: 'HVAC, Roofing & Contractors', icon: '🔧' },
  { id: 'accounting_cpa', label: 'CPA & Accounting Firms', icon: '📊' },
  { id: 'marketing_agencies', label: 'Marketing & Web Agencies', icon: '🚀' },
  { id: 'gyms_fitness', label: 'Gyms, Fitness & CrossFit', icon: '🏋️' },
  { id: 'auto_repair', label: 'Auto Care & Motorcycle Garages', icon: '🚗' },
  { id: 'med_spas', label: 'Medical Spas & Aesthetics', icon: '✨' },
  { id: 'solar_energy', label: 'Solar Panel & Clean Tech Contractors', icon: '☀️' },
  { id: 'coffee_roasters', label: 'Specialty Coffee Roasters & Cafes', icon: '☕' },
  { id: 'yacht_marine', label: 'Yacht Charter & Marine Services', icon: '🛥️' },
  { id: 'pet_vet', label: 'Veterinary Clinics & Pet Care', icon: '🐾' },
  { id: 'groceries_organic', label: 'Ethnic & Organic Grocery Stores', icon: '🛒' },
  { id: 'restaurants_catering', label: 'Restaurants & Catering', icon: '🍽️' }
];

export const QUICK_CITIES = [
  'Austin, TX',
  'New York, NY',
  'Miami, FL',
  'London, UK',
  'San Francisco, CA',
  'Dhaka, Bangladesh',
  'Dubai, UAE',
  'Toronto, Canada',
  'Dallas, TX',
  'Chicago, IL',
  'Los Angeles, CA',
  'Sydney, Australia'
];
