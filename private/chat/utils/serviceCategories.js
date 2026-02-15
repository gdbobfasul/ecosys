// Version: 1.0056
// Service Categories Constants
// Used for "current_need" and "offerings" fields

const SERVICE_CATEGORIES = {
  // Categories in alphabetical order (English)
  
  CRAFTSMAN: {
    label: 'Craftsman',
    subcategories: [
      'Auto Mechanic',
      'Carpenter',
      'Electrician',
      'HVAC Technician',
      'Locksmith',
      'Painter',
      'Plasterer',
      'Plumber',
      'Tire Inflation',
      'Welder'
    ]
  },
  
  EMERGENCY_NEED: {
    label: 'Emergency Need',
    subcategories: [
      'Help',
      'Sick'
    ]
  },
  
  EMERGENCY_OFFERING: {
    label: 'Emergency Offering',
    subcategories: [
      'Ambulance',
      'Doctor',
      'Hospital',
      'Police'
    ]
  },
  
  FOOD_DRINK: {
    label: 'Food/Drink Jobs',
    subcategories: [
      'Bartender',
      'Chef',
      'Food Delivery',
      'Waiter'
    ]
  },
  
  MOOD: {
    label: 'Mood',
    subcategories: [
      'Drinks',
      'Food',
      'Friends',
      'Just Chat',
      'Love',
      'One-time Fun',
      'Political Discussions',
      'Scientific Discussions',
      'Serious Dating'
    ]
  },
  
  SERVICES: {
    label: 'Services',
    subcategories: [
      'Babysitter',
      'Driver',
      'Fitness Trainer',
      'Housekeeper',
      'Teacher'
    ]
  },
  
  SPORTS: {
    label: 'Sports',
    subcategories: [
      'Boxing',
      'Cycling',
      'Muay Thai',
      'Nature/Park',
      'Running',
      'Swimming',
      'Tourist Excursion',
      'Wrestling'
    ]
  },
  
  TRANSLATOR: {
    label: 'Translator',
    subcategories: [
      'Arabic',
      'Chinese',
      'English',
      'French',
      'German',
      'Hebrew',
      'Italian',
      'Kazakh',
      'Kyrgyz',
      'Mexican',
      'Mongolian',
      'Nigerian',
      'Portuguese',
      'Russian',
      'Spanish',
      'Swahili',
      'Turkish',
      'Ukrainian'
    ]
  },
  
  VENUES: {
    label: 'Venues',
    subcategories: [
      'Bar',
      'Coffee/Sweets',
      'Disco',
      'Fast Food',
      'Hi Class Food',
      'Karaoke'
    ]
  },
  
  PLACES: {
    label: 'Places/Stores',
    subcategories: [
      'Pharmacy',
      'Optician/Eyewear',
      'Computer Repair',
      'Computer Store',
      'Shopping Center/Market',
      'Building Materials Store',
      'Construction Exchange',
      'Beauty/Hair Salon',
      'Massage',
      'Sauna',
      'Swimming Pool',
      'Gym',
      'Clothing Store',
      'Gift Shop',
      'Flower Shop',
      'GSM Repair',
      'Appliance Repair',
      'Appliance Store'
    ]
  },
  
  INCIDENTS: {
    label: 'Incidents',
    subcategories: [
      'Accident',
      'Person Needing Help'
    ]
  }
};

// Services that require admin verification (only for offerings)
const VERIFIED_ONLY_SERVICES = [
  'Doctor',
  'Hospital',
  'Ambulance',
  'Police'
];

// Services that can ONLY be used as OFFERINGS (not as needs)
const OFFERING_ONLY_SERVICES = [
  'Doctor',
  'Hospital',
  'Ambulance',
  'Police'
];

// Services that can ONLY be used as NEEDS (not as offerings)
const NEED_ONLY_SERVICES = [
  'Sick',
  'Help',
  'Accident',
  'Person Needing Help'
];

// Emergency need to offering mapping
const EMERGENCY_NEED_MAPPING = {
  'Sick': ['Doctor', 'Hospital', 'Ambulance'],
  'Help': ['Police']
};

// All available services (flat list)
const ALL_SERVICES = Object.values(SERVICE_CATEGORIES)
  .flatMap(category => category.subcategories);

// Services available for regular users in "offerings" (excludes need-only services)
const PUBLIC_OFFERING_SERVICES = ALL_SERVICES.filter(
  service => !NEED_ONLY_SERVICES.includes(service) && !VERIFIED_ONLY_SERVICES.includes(service)
);

// Services available for "current_need" (excludes offering-only services)
const NEED_SERVICES = ALL_SERVICES.filter(
  service => !OFFERING_ONLY_SERVICES.includes(service)
);

// Check if a service requires verification
function requiresVerification(service) {
  return VERIFIED_ONLY_SERVICES.includes(service);
}

// Check if user can offer a service
function canOffer(service, isVerified) {
  // Check if it's a need-only service
  if (NEED_ONLY_SERVICES.includes(service)) {
    return false; // Cannot offer "Sick" or "Help"
  }
  
  // Check if it requires verification
  if (requiresVerification(service)) {
    return isVerified; // Only verified users can offer emergency services
  }
  
  return true; // Anyone can offer public services
}

// Check if user can set as need
function canSetAsNeed(service) {
  // Cannot set offering-only services as need
  return !OFFERING_ONLY_SERVICES.includes(service);
}

// Get matching offerings for a need
function getMatchingOfferings(need) {
  // Special mapping for emergency needs
  if (EMERGENCY_NEED_MAPPING[need]) {
    return EMERGENCY_NEED_MAPPING[need];
  }
  
  // For all other services, direct match
  return [need];
}

// Validate offerings (max 3)
function validateOfferings(offerings, isVerified = false) {
  if (!offerings) return { valid: true };
  
  const list = offerings.split(',').map(s => s.trim()).filter(Boolean);
  
  if (list.length > 3) {
    return { valid: false, error: 'Maximum 3 offerings allowed' };
  }
  
  for (const service of list) {
    if (!ALL_SERVICES.includes(service)) {
      return { valid: false, error: `Invalid service: ${service}` };
    }
    
    if (NEED_ONLY_SERVICES.includes(service)) {
      return { valid: false, error: `"${service}" can only be set as need, not offering` };
    }
    
    if (requiresVerification(service) && !isVerified) {
      return { valid: false, error: `"${service}" requires admin verification` };
    }
  }
  
  return { valid: true };
}

// Validate need
function validateNeed(need) {
  if (!need) return { valid: true };
  
  if (!ALL_SERVICES.includes(need)) {
    return { valid: false, error: `Invalid service: ${need}` };
  }
  
  if (OFFERING_ONLY_SERVICES.includes(need)) {
    return { valid: false, error: `"${need}" can only be offered, not needed` };
  }
  
  return { valid: true };
}

module.exports = {
  SERVICE_CATEGORIES,
  VERIFIED_ONLY_SERVICES,
  OFFERING_ONLY_SERVICES,
  NEED_ONLY_SERVICES,
  EMERGENCY_NEED_MAPPING,
  ALL_SERVICES,
  PUBLIC_OFFERING_SERVICES,
  NEED_SERVICES,
  requiresVerification,
  canOffer,
  canSetAsNeed,
  getMatchingOfferings,
  validateOfferings,
  validateNeed
};
