-- Version: 1.0056
-- Emergency Contacts Seed Data
-- International emergency numbers for all supported countries

-- Bulgaria (BG)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('BG', 'police', 'National Police Hotline', '+359-2-982-1111', '166', 'Sofia'),
('BG', 'ambulance', 'National Emergency Medical Service', '+359-2-915-3131', '150', 'Sofia'),
('BG', 'fire', 'Fire Department', '+359-2-980-0000', '160', 'Sofia'),
('BG', 'emergency', 'Unified Emergency Number', '+359-112', '112', 'National');

-- Russia (RU)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('RU', 'police', 'Police Moscow', '+7-495-237-7777', '102', 'Moscow'),
('RU', 'ambulance', 'Ambulance Moscow', '+7-495-237-5555', '103', 'Moscow'),
('RU', 'fire', 'Fire Department Moscow', '+7-495-101-0101', '101', 'Moscow'),
('RU', 'emergency', 'Unified Emergency Number', '+7-112', '112', 'National'),
('RU', 'police', 'Police St. Petersburg', '+7-812-573-2424', '102', 'St. Petersburg'),
('RU', 'ambulance', 'Ambulance St. Petersburg', '+7-812-103', '103', 'St. Petersburg');

-- Lithuania (LT)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('LT', 'police', 'Police Vilnius', '+370-5-271-0000', '112', 'Vilnius'),
('LT', 'ambulance', 'Ambulance Service', '+370-5-216-0000', '112', 'Vilnius'),
('LT', 'fire', 'Fire and Rescue', '+370-5-266-7661', '112', 'Vilnius'),
('LT', 'emergency', 'Unified Emergency Number', '+370-112', '112', 'National');

-- Latvia (LV)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('LV', 'police', 'State Police', '+371-6706-4444', '110', 'Riga'),
('LV', 'ambulance', 'Emergency Medical Service', '+371-6703-1003', '113', 'Riga'),
('LV', 'fire', 'Fire and Rescue Service', '+371-6708-1001', '112', 'Riga'),
('LV', 'emergency', 'Unified Emergency Number', '+371-112', '112', 'National');

-- Estonia (EE)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('EE', 'police', 'Police Tallinn', '+372-612-3000', '110', 'Tallinn'),
('EE', 'ambulance', 'Ambulance Service', '+372-697-0112', '112', 'Tallinn'),
('EE', 'fire', 'Rescue Service', '+372-626-6000', '112', 'Tallinn'),
('EE', 'emergency', 'Unified Emergency Number', '+372-112', '112', 'National');

-- Kyrgyzstan (KG)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('KG', 'police', 'Police Bishkek', '+996-312-102', '102', 'Bishkek'),
('KG', 'ambulance', 'Ambulance Bishkek', '+996-312-103', '103', 'Bishkek'),
('KG', 'fire', 'Fire Department Bishkek', '+996-312-101', '101', 'Bishkek'),
('KG', 'emergency', 'Unified Emergency Number', '+996-112', '112', 'National');

-- United States (US)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('US', 'emergency', 'Emergency Services', '+1-911', '911', 'National'),
('US', 'police', 'Police Non-Emergency', '+1-311', '311', 'National'),
('US', 'poison', 'Poison Control', '+1-800-222-1222', '800-222-1222', 'National');

-- United Kingdom (UK/GB)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('GB', 'emergency', 'Emergency Services', '+44-999', '999', 'National'),
('GB', 'emergency', 'Alternative Emergency', '+44-112', '112', 'National'),
('GB', 'police', 'Police Non-Emergency', '+44-101', '101', 'National');

-- Germany (DE)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('DE', 'police', 'Police', '+49-110', '110', 'National'),
('DE', 'ambulance', 'Ambulance/Fire', '+49-112', '112', 'National'),
('DE', 'emergency', 'Emergency Services', '+49-112', '112', 'National');

-- France (FR)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('FR', 'police', 'Police', '+33-17', '17', 'National'),
('FR', 'ambulance', 'SAMU Ambulance', '+33-15', '15', 'National'),
('FR', 'fire', 'Fire Department', '+33-18', '18', 'National'),
('FR', 'emergency', 'Unified Emergency', '+33-112', '112', 'National');

-- Spain (ES)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('ES', 'emergency', 'Emergency Services', '+34-112', '112', 'National'),
('ES', 'police', 'National Police', '+34-091', '091', 'National'),
('ES', 'ambulance', 'Ambulance', '+34-061', '061', 'National');

-- Italy (IT)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('IT', 'police', 'Carabinieri', '+39-112', '112', 'National'),
('IT', 'ambulance', 'Ambulance', '+39-118', '118', 'National'),
('IT', 'fire', 'Fire Department', '+39-115', '115', 'National'),
('IT', 'emergency', 'Unified Emergency', '+39-112', '112', 'National');

-- Poland (PL)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('PL', 'police', 'Police', '+48-997', '997', 'National'),
('PL', 'ambulance', 'Ambulance', '+48-999', '999', 'National'),
('PL', 'fire', 'Fire Department', '+48-998', '998', 'National'),
('PL', 'emergency', 'Unified Emergency', '+48-112', '112', 'National');

-- Greece (GR)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('GR', 'police', 'Police', '+30-100', '100', 'National'),
('GR', 'ambulance', 'Ambulance', '+30-166', '166', 'National'),
('GR', 'fire', 'Fire Department', '+30-199', '199', 'National'),
('GR', 'emergency', 'Unified Emergency', '+30-112', '112', 'National');

-- Turkey (TR)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('TR', 'police', 'Police', '+90-155', '155', 'National'),
('TR', 'ambulance', 'Ambulance', '+90-112', '112', 'National'),
('TR', 'fire', 'Fire Department', '+90-110', '110', 'National'),
('TR', 'emergency', 'Unified Emergency', '+90-112', '112', 'National');

-- Ukraine (UA)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('UA', 'police', 'Police', '+380-102', '102', 'National'),
('UA', 'ambulance', 'Ambulance', '+380-103', '103', 'National'),
('UA', 'fire', 'Fire Department', '+380-101', '101', 'National'),
('UA', 'emergency', 'Unified Emergency', '+380-112', '112', 'National');

-- Czech Republic (CZ)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('CZ', 'police', 'Police', '+420-158', '158', 'National'),
('CZ', 'ambulance', 'Ambulance', '+420-155', '155', 'National'),
('CZ', 'fire', 'Fire Department', '+420-150', '150', 'National'),
('CZ', 'emergency', 'Unified Emergency', '+420-112', '112', 'National');

-- Romania (RO)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('RO', 'police', 'Police', '+40-112', '112', 'National'),
('RO', 'ambulance', 'Ambulance', '+40-112', '112', 'National'),
('RO', 'fire', 'Fire Department', '+40-112', '112', 'National'),
('RO', 'emergency', 'Unified Emergency', '+40-112', '112', 'National');

-- Serbia (RS)
INSERT INTO emergency_contacts (country_code, service_type, service_name, phone_international, phone_local, city) VALUES
('RS', 'police', 'Police', '+381-192', '192', 'National'),
('RS', 'ambulance', 'Ambulance', '+381-194', '194', 'National'),
('RS', 'fire', 'Fire Department', '+381-193', '193', 'National'),
('RS', 'emergency', 'Unified Emergency', '+381-112', '112', 'National');
