/* Plane Sight — notes on civilian aircraft and who flies them.
   Maker and model, what kind of plane it is and where it's usually flown, the airline behind a
   callsign, and how to read the public owner record. */
(function (root) {
  'use strict';

  /* ---------- aircraft families ---------- */
  // art: which drawing to use; opts: drawing options (twin engines, four engines, single prop)
  var FAM = {
    a320: { role: 'Single-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'Airbus’s best-selling family of single-aisle jets, seating about 120 to 240 depending on the length. It and the Boeing 737 fly most short and medium-length airline routes in the world.',
      where: 'Everywhere: United, American, Delta, JetBlue, Spirit and Frontier all fly them on domestic routes.' },
    a220: { role: 'Small single-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'Designed by Bombardier as the CSeries and taken over by Airbus. Quiet and efficient, with roomy two-by-three seating.',
      where: 'Domestic routes with Delta, JetBlue and Breeze, and with Air Canada and others abroad.' },
    a330: { role: 'Twin-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'Airbus’s long-serving widebody, seating about 250 to 300. The newest version is the A330neo.',
      where: 'Transatlantic and other long routes, with Delta and many foreign airlines; also flown as a freighter and as a military tanker.' },
    a350: { role: 'Long-haul twin-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'Airbus’s newest long-haul jet, built largely from carbon-fiber composites, seating about 300 to 350.',
      where: 'Long international flights; several foreign airlines fly them into Dulles.' },
    a380: { role: 'Double-deck airliner', art: 'tanker', opts: {},
      blurb: 'The largest passenger airliner ever built: a full double-decker with four engines, seating 500 or more. Production ended in 2021.',
      where: 'A handful of very busy long-haul routes; Emirates flies most of the A380s still in service.' },
    b737: { role: 'Single-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'The best-selling jet airliner family ever, in service since 1968 and rebuilt several times. Current versions seat about 140 to 220.',
      where: 'All over the U.S.: Southwest flies nothing else, and United, American, Delta and Alaska fly big fleets.' },
    b737max: { role: 'Single-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'The newest 737 generation, with bigger, more efficient engines and split-tip winglets.',
      where: 'Domestic routes with Southwest, United, American and Alaska, and with many airlines abroad.' },
    b717: { role: 'Small single-aisle airliner', art: 'bizjet', opts: {},
      blurb: 'A 110-seat jet with its engines on the tail, the last of the line that began with the DC-9.',
      where: 'Delta’s shorter routes and Hawaiian’s inter-island hops.' },
    b757: { role: 'Single-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'A long, narrow, unusually powerful jet that can use short runways or fly the Atlantic. Production ended in 2004.',
      where: 'United and Delta, cargo airlines like FedEx and UPS, and the Air Force’s C-32 VIP jets.' },
    b767: { role: 'Twin-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'A mid-size widebody from the 1980s. Passenger versions are being retired, but freighters and the KC-46 tanker are still built.',
      where: 'Delta and United on transatlantic routes; FedEx, UPS and Amazon Air cargo.' },
    b777: { role: 'Long-haul twin-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'The largest twin-engine jet in service, and a workhorse of long-haul flying, seating about 300 to 400.',
      where: 'Long international routes with United, American, Emirates, Air France and many more; FedEx flies the freighter.' },
    b787: { role: 'Long-haul twin-aisle airliner', art: 'jet', opts: { twin: true },
      blurb: 'Boeing’s Dreamliner, built mostly from carbon fiber, with bigger windows and more humid cabin air than older jets.',
      where: 'Long international flights; United flies many from Dulles.' },
    b747: { role: 'Four-engine jumbo jet', art: 'tanker', opts: {},
      blurb: 'The original jumbo jet, with its famous upper-deck hump. Production ended in 2023; most still flying carry cargo.',
      where: 'Cargo airlines such as Atlas, UPS and Cargolux; a few airlines like Lufthansa still carry passengers in them.' },
    md11: { role: 'Three-engine widebody', art: 'jet', opts: { twin: true },
      blurb: 'A three-engine widebody built until 2001, with one engine in the tail. In recent years it flew almost only as a freighter.',
      where: 'Cargo airlines such as UPS, FedEx and Western Global have flown them.' },
    crj: { role: 'Regional jet', art: 'bizjet', opts: {},
      blurb: 'Canadian-built regional jets with engines on the tail, seating 50 to 90. Bombardier built them; Mitsubishi now supports the fleet.',
      where: 'Short hops from hubs like Dulles and Reagan National, flown by regional airlines as American Eagle, Delta Connection and United Express.' },
    erj: { role: 'Regional jet', art: 'bizjet', opts: {},
      blurb: 'Brazilian 37- to 50-seat regional jets with engines on the tail and one-by-two seating.',
      where: 'United Express and other regional flights, on short routes.' },
    ejet: { role: 'Regional jet', art: 'jet', opts: { twin: true },
      blurb: 'Brazilian regional jets seating 70 to 130 with engines under the wings. The E175 is the most common regional jet in the U.S.',
      where: 'American Eagle, Delta Connection and United Express flights from hubs like Dulles and Reagan National.' },
    dash8: { role: 'Regional turboprop', art: 'turboprop', opts: { twin: true },
      blurb: 'A fast twin turboprop from De Havilland Canada seating about 75, quieter and cheaper than a jet on short routes.',
      where: 'Short regional routes, especially in Canada.' },
    atr: { role: 'Regional turboprop', art: 'turboprop', opts: { twin: true },
      blurb: 'A French-Italian twin turboprop seating about 70; also a popular small freighter.',
      where: 'Short regional routes worldwide; in the U.S. mostly as FedEx feeder freighters.' },
    citlight: { role: 'Light business jet', art: 'bizjet', opts: {},
      blurb: 'Cessna’s smaller Citation jets (now built by Textron Aviation), often flown by a single pilot.',
      where: 'Private and corporate trips, from small airports and big ones alike.' },
    citmid: { role: 'Business jet', art: 'bizjet', opts: {},
      blurb: 'A mid-size or larger Citation from Cessna (now Textron Aviation), a staple of charter and fractional fleets.',
      where: 'Corporate and charter trips; NetJets and other operators fly many.' },
    phenom: { role: 'Light business jet', art: 'bizjet', opts: {},
      blurb: 'Embraer’s light jets. The Phenom 300 has been the best-selling light business jet for years.',
      where: 'Private, corporate and charter trips; Flexjet and NetJets fly them.' },
    praetor: { role: 'Business jet', art: 'bizjet', opts: {},
      blurb: 'Embraer’s mid-size and super-mid-size business jets (Legacy and Praetor).',
      where: 'Corporate and fractional flying.' },
    challenger: { role: 'Business jet', art: 'bizjet', opts: {},
      blurb: 'Bombardier’s Challenger jets. The 300 and 350 are among the best-selling super-mid-size jets ever.',
      where: 'Corporate, charter and fractional flying (NetJets and Flexjet fly many).' },
    gulfstream: { role: 'Large business jet', art: 'bizjet', opts: {},
      blurb: 'Large, long-range business jets built in Savannah, Georgia, a favorite of big companies, wealthy owners and governments.',
      where: 'Corporate and private trips, often nonstop to Europe or across the country.' },
    global: { role: 'Ultra-long-range business jet', art: 'bizjet', opts: {},
      blurb: 'Bombardier’s biggest business jets; the largest can fly from the East Coast to Asia nonstop.',
      where: 'Corporate and private long-range trips.' },
    learjet: { role: 'Business jet', art: 'bizjet', opts: {},
      blurb: 'The name that started the business-jet era. Production has ended, but many still fly.',
      where: 'Charter, corporate and air-ambulance flights.' },
    falcon: { role: 'Business jet', art: 'bizjet', opts: {},
      blurb: 'French business jets from Dassault, the maker of the Rafale fighter. The 7X, 8X and 900 have three engines.',
      where: 'Corporate and private trips, often international.' },
    lightjet: { role: 'Light jet', art: 'bizjet', opts: {},
      blurb: 'A small, modern personal or business jet.',
      where: 'Owner-flown and charter trips between smaller airports.' },
    c172: { role: 'Four-seat training plane', art: 'twinprop', opts: { single: true },
      blurb: 'The most-produced aircraft in history and the classic plane people learn to fly in.',
      where: 'Flight schools and weekend pilots everywhere, including Montgomery County Airpark and Frederick.' },
    cessna: { role: 'Light single-engine plane', art: 'twinprop', opts: { single: true },
      blurb: 'A Cessna light plane, one of the most common types in general aviation.',
      where: 'Training, personal trips and sightseeing from small local airports.' },
    caravan: { role: 'Utility turboprop', art: 'twinprop', opts: { single: true },
      blurb: 'A rugged single-engine turboprop that carries up to about a dozen people or a ton of cargo.',
      where: 'FedEx feeder cargo runs, skydiving, and small commuter airlines.' },
    piper: { role: 'Light single-engine plane', art: 'twinprop', opts: { single: true },
      blurb: 'A Piper light plane (Cherokee, Archer, Warrior and relatives), a classic trainer and family plane.',
      where: 'Flight schools and private pilots at small local airports.' },
    cirrus: { role: 'Four-seat personal plane', art: 'twinprop', opts: { single: true },
      blurb: 'Cirrus SR20 and SR22: for years the best-selling single-engine piston planes, with a parachute for the whole airplane.',
      where: 'Private owners and flight schools making trips between regional airports.' },
    bonanza: { role: 'Single-engine personal plane', art: 'twinprop', opts: { single: true },
      blurb: 'The Beechcraft Bonanza, in production since 1947, the longest run of any airplane.',
      where: 'Private owners on regional trips.' },
    piston: { role: 'Light plane', art: 'twinprop', opts: { single: true },
      blurb: 'A small general-aviation airplane.',
      where: 'Training, personal trips and sightseeing from small local airports.' },
    kingair: { role: 'Twin turboprop', art: 'twinprop', opts: {},
      blurb: 'Beechcraft’s King Air, in production since the 1960s: the classic twin turboprop for business, charter and medical flights.',
      where: 'Corporate trips, air ambulance and government work (the military flies it as the C-12).' },
    pc12: { role: 'Single-engine turboprop', art: 'twinprop', opts: { single: true },
      blurb: 'A Swiss single-engine turboprop with a big cabin and a cargo door.',
      where: 'Fractional owners like PlaneSense, air ambulances and private owners.' },
    tbm: { role: 'Fast single-engine turboprop', art: 'twinprop', opts: { single: true },
      blurb: 'A French-built six-seat turboprop that cruises at over 300 knots, often flown by its owner.',
      where: 'Private trips between regional airports.' },
    baron: { role: 'Twin-engine piston plane', art: 'twinprop', opts: {},
      blurb: 'A light twin-engine plane, popular for training and personal trips.',
      where: 'Private flying and multi-engine training.' },
    ems: { role: 'Light twin-engine helicopter', art: 'heli-light', opts: {},
      blurb: 'An Airbus (formerly Eurocopter) twin-engine helicopter, the go-to choice for air ambulances and police.',
      where: 'Medical flights to trauma centers and police work.' },
    aw139: { role: 'Medium twin-engine helicopter', art: 'heli-utility', opts: {},
      blurb: 'A Leonardo (AgustaWestland) helicopter used for medevac, police, rescue and offshore work.',
      where: 'Maryland State Police medevac and rescue flights, corporate and offshore work.' },
    aw109: { role: 'Light twin-engine helicopter', art: 'heli-light', opts: {},
      blurb: 'A fast, sleek Italian helicopter from Leonardo (AgustaWestland).',
      where: 'Medical, police and corporate flights.' },
    bell: { role: 'Light helicopter', art: 'heli-light', opts: {},
      blurb: 'A Bell helicopter, from the classic JetRanger to the 407 and 429.',
      where: 'News, police, medical, tours and training.' },
    astar: { role: 'Light helicopter', art: 'heli-light', opts: {},
      blurb: 'The Airbus AS350/H125 AStar, a workhorse single-engine helicopter.',
      where: 'TV news, police, tours and utility work.' },
    robinson: { role: 'Light helicopter', art: 'heli-light', opts: {},
      blurb: 'Robinson’s small two- to five-seat helicopters, the most common training helicopters in the world.',
      where: 'Flight training, private flying and tours.' },
    sikorsky: { role: 'Medium twin-engine helicopter', art: 'heli-utility', opts: {},
      blurb: 'A Sikorsky civilian helicopter, used for executive transport and offshore flights.',
      where: 'Corporate and VIP transport.' }
  };

  // ICAO type code -> [maker, model, family]
  var TYPES = {
    A318: ['Airbus', 'A318', 'a320'], A319: ['Airbus', 'A319', 'a320'], A320: ['Airbus', 'A320', 'a320'], A321: ['Airbus', 'A321', 'a320'],
    A19N: ['Airbus', 'A319neo', 'a320'], A20N: ['Airbus', 'A320neo', 'a320'], A21N: ['Airbus', 'A321neo', 'a320'],
    BCS1: ['Airbus', 'A220-100', 'a220'], BCS3: ['Airbus', 'A220-300', 'a220'],
    A332: ['Airbus', 'A330-200', 'a330'], A333: ['Airbus', 'A330-300', 'a330'], A338: ['Airbus', 'A330-800neo', 'a330'], A339: ['Airbus', 'A330-900neo', 'a330'],
    A359: ['Airbus', 'A350-900', 'a350'], A35K: ['Airbus', 'A350-1000', 'a350'], A388: ['Airbus', 'A380', 'a380'],
    B712: ['Boeing', '717', 'b717'], B736: ['Boeing', '737-600', 'b737'], B737: ['Boeing', '737-700', 'b737'], B738: ['Boeing', '737-800', 'b737'], B739: ['Boeing', '737-900', 'b737'],
    B37M: ['Boeing', '737 MAX 7', 'b737max'], B38M: ['Boeing', '737 MAX 8', 'b737max'], B39M: ['Boeing', '737 MAX 9', 'b737max'], B3XM: ['Boeing', '737 MAX 10', 'b737max'],
    B752: ['Boeing', '757-200', 'b757'], B753: ['Boeing', '757-300', 'b757'],
    B762: ['Boeing', '767-200', 'b767'], B763: ['Boeing', '767-300', 'b767'], B764: ['Boeing', '767-400', 'b767'],
    B772: ['Boeing', '777-200', 'b777'], B77L: ['Boeing', '777-200LR', 'b777'], B77W: ['Boeing', '777-300ER', 'b777'], B773: ['Boeing', '777-300', 'b777'], B778: ['Boeing', '777-8', 'b777'], B779: ['Boeing', '777-9', 'b777'],
    B788: ['Boeing', '787-8 Dreamliner', 'b787'], B789: ['Boeing', '787-9 Dreamliner', 'b787'], B78X: ['Boeing', '787-10 Dreamliner', 'b787'],
    B744: ['Boeing', '747-400', 'b747'], B748: ['Boeing', '747-8', 'b747'], B74F: ['Boeing', '747 freighter', 'b747'],
    MD11: ['McDonnell Douglas', 'MD-11', 'md11'],
    CRJ2: ['Bombardier', 'CRJ200', 'crj'], CRJ7: ['Bombardier', 'CRJ700', 'crj'], CRJ9: ['Bombardier', 'CRJ900', 'crj'], CRJX: ['Bombardier', 'CRJ1000', 'crj'],
    E135: ['Embraer', 'ERJ-135', 'erj'], E145: ['Embraer', 'ERJ-145', 'erj'], E45X: ['Embraer', 'ERJ-145XR', 'erj'],
    E170: ['Embraer', 'E170', 'ejet'], E75L: ['Embraer', 'E175', 'ejet'], E75S: ['Embraer', 'E175', 'ejet'], E190: ['Embraer', 'E190', 'ejet'], E195: ['Embraer', 'E195', 'ejet'],
    E290: ['Embraer', 'E190-E2', 'ejet'], E295: ['Embraer', 'E195-E2', 'ejet'],
    DH8D: ['De Havilland Canada', 'Dash 8-400', 'dash8'], DH8C: ['De Havilland Canada', 'Dash 8-300', 'dash8'], AT72: ['ATR', '72', 'atr'], AT76: ['ATR', '72-600', 'atr'], AT75: ['ATR', '72-500', 'atr'],
    C510: ['Cessna', 'Citation Mustang', 'citlight'], C525: ['Cessna', 'Citation CJ1', 'citlight'], C25A: ['Cessna', 'Citation CJ2', 'citlight'], C25B: ['Cessna', 'Citation CJ3', 'citlight'], C25C: ['Cessna', 'Citation CJ4', 'citlight'], C25M: ['Cessna', 'Citation M2', 'citlight'],
    C550: ['Cessna', 'Citation II', 'citlight'], C560: ['Cessna', 'Citation V', 'citmid'], C56X: ['Cessna', 'Citation Excel', 'citmid'], C680: ['Cessna', 'Citation Sovereign', 'citmid'], C68A: ['Cessna', 'Citation Latitude', 'citmid'],
    C700: ['Cessna', 'Citation Longitude', 'citmid'], C750: ['Cessna', 'Citation X', 'citmid'],
    E50P: ['Embraer', 'Phenom 100', 'phenom'], E55P: ['Embraer', 'Phenom 300', 'phenom'], E545: ['Embraer', 'Praetor 500', 'praetor'], E550: ['Embraer', 'Praetor 600', 'praetor'], E135L: ['Embraer', 'Legacy 600', 'praetor'],
    CL30: ['Bombardier', 'Challenger 300', 'challenger'], CL35: ['Bombardier', 'Challenger 350', 'challenger'], CL60: ['Bombardier', 'Challenger 600-series', 'challenger'],
    GLF4: ['Gulfstream', 'G-IV', 'gulfstream'], GLF5: ['Gulfstream', 'G-V / G550', 'gulfstream'], GLF6: ['Gulfstream', 'G650', 'gulfstream'], G280: ['Gulfstream', 'G280', 'gulfstream'],
    GA5C: ['Gulfstream', 'G500', 'gulfstream'], GA6C: ['Gulfstream', 'G600', 'gulfstream'], GA7C: ['Gulfstream', 'G700', 'gulfstream'], GA8C: ['Gulfstream', 'G800', 'gulfstream'],
    GL5T: ['Bombardier', 'Global 5000/5500', 'global'], GLEX: ['Bombardier', 'Global Express/6000', 'global'], GL7T: ['Bombardier', 'Global 7500', 'global'],
    LJ35: ['Learjet', '35', 'learjet'], LJ45: ['Learjet', '45', 'learjet'], LJ60: ['Learjet', '60', 'learjet'], LJ75: ['Learjet', '75', 'learjet'],
    F2TH: ['Dassault', 'Falcon 2000', 'falcon'], F900: ['Dassault', 'Falcon 900', 'falcon'], FA7X: ['Dassault', 'Falcon 7X', 'falcon'], FA8X: ['Dassault', 'Falcon 8X', 'falcon'], FA50: ['Dassault', 'Falcon 50', 'falcon'],
    PC24: ['Pilatus', 'PC-24', 'lightjet'], HDJT: ['Honda Aircraft', 'HondaJet', 'lightjet'], SF50: ['Cirrus', 'Vision Jet', 'lightjet'], PRM1: ['Beechcraft', 'Premier I', 'lightjet'], BE40: ['Beechcraft', 'Beechjet 400', 'lightjet'],
    C150: ['Cessna', '150', 'cessna'], C152: ['Cessna', '152', 'cessna'], C172: ['Cessna', '172 Skyhawk', 'c172'], C182: ['Cessna', '182 Skylane', 'cessna'], C206: ['Cessna', '206 Stationair', 'cessna'], T206: ['Cessna', '206 Stationair', 'cessna'],
    C210: ['Cessna', '210 Centurion', 'cessna'], C208: ['Cessna', '208 Caravan', 'caravan'],
    P28A: ['Piper', 'PA-28 Cherokee/Archer', 'piper'], PA28: ['Piper', 'PA-28 Cherokee', 'piper'], P28R: ['Piper', 'Arrow', 'piper'], P32R: ['Piper', 'Saratoga', 'piper'], PA32: ['Piper', 'Cherokee Six', 'piper'],
    PA46: ['Piper', 'Malibu / M-series', 'piper'], PA34: ['Piper', 'Seneca', 'baron'], PA44: ['Piper', 'Seminole', 'baron'],
    SR20: ['Cirrus', 'SR20', 'cirrus'], SR22: ['Cirrus', 'SR22', 'cirrus'], S22T: ['Cirrus', 'SR22T', 'cirrus'],
    DA40: ['Diamond', 'DA40', 'piston'], DA42: ['Diamond', 'DA42', 'baron'], DA62: ['Diamond', 'DA62', 'baron'], M20P: ['Mooney', 'M20', 'piston'], M20T: ['Mooney', 'M20 Turbo', 'piston'],
    BE33: ['Beechcraft', 'Debonair', 'bonanza'], BE35: ['Beechcraft', 'Bonanza (V-tail)', 'bonanza'], BE36: ['Beechcraft', 'Bonanza', 'bonanza'], BE55: ['Beechcraft', 'Baron', 'baron'], BE58: ['Beechcraft', 'Baron', 'baron'],
    BE9L: ['Beechcraft', 'King Air 90', 'kingair'], BE20: ['Beechcraft', 'King Air 200', 'kingair'], B350: ['Beechcraft', 'King Air 350', 'kingair'], PC12: ['Pilatus', 'PC-12', 'pc12'],
    TBM7: ['Daher', 'TBM 700', 'tbm'], TBM8: ['Daher', 'TBM 850', 'tbm'], TBM9: ['Daher', 'TBM 900-series', 'tbm'],
    EC35: ['Airbus Helicopters', 'H135', 'ems'], EC45: ['Airbus Helicopters', 'H145', 'ems'], H145: ['Airbus Helicopters', 'H145', 'ems'], EC30: ['Airbus Helicopters', 'H130', 'astar'],
    AS50: ['Airbus Helicopters', 'AS350 AStar', 'astar'], AS55: ['Airbus Helicopters', 'AS355 TwinStar', 'astar'], AS65: ['Airbus Helicopters', 'AS365 Dauphin', 'ems'],
    A109: ['Leonardo', 'AW109', 'aw109'], A119: ['Leonardo', 'AW119', 'aw109'], A139: ['Leonardo', 'AW139', 'aw139'], A169: ['Leonardo', 'AW169', 'aw109'], A189: ['Leonardo', 'AW189', 'aw139'],
    B06: ['Bell', '206 JetRanger', 'bell'], B407: ['Bell', '407', 'bell'], B429: ['Bell', '429', 'bell'], B412: ['Bell', '412', 'bell'], B212: ['Bell', '212', 'bell'], B505: ['Bell', '505', 'bell'],
    R22: ['Robinson', 'R22', 'robinson'], R44: ['Robinson', 'R44', 'robinson'], R66: ['Robinson', 'R66', 'robinson'],
    S76: ['Sikorsky', 'S-76', 'sikorsky'], S92: ['Sikorsky', 'S-92', 'sikorsky']
  };
  // shape families by class when the type isn't in the list
  var GENERIC = {
    wide: { role: 'Twin-aisle airliner', art: 'jet', opts: { twin: true }, blurb: 'A widebody jet built for long flights.', where: 'Long-haul and international routes.' },
    narrow: { role: 'Single-aisle airliner', art: 'jet', opts: { twin: true }, blurb: 'A single-aisle jet airliner.', where: 'Domestic and short international routes.' },
    regional: { role: 'Regional airliner', art: 'jet', opts: { twin: true }, blurb: 'A smaller airliner for short routes.', where: 'Regional routes from hubs like Dulles and Reagan National.' },
    bizjet: { role: 'Business jet', art: 'bizjet', opts: {}, blurb: 'A private or business jet.', where: 'Corporate, charter and private trips.' },
    prop: { role: 'Light plane', art: 'twinprop', opts: { single: true }, blurb: 'A small propeller plane.', where: 'Training, personal trips and small local airports.' },
    heli: { role: 'Helicopter', art: 'heli-light', opts: {}, blurb: 'A civilian helicopter.', where: 'Medical, police, news, tours and training flights.' },
    tiltrotor: { role: 'Tiltrotor', art: 'tiltrotor', opts: {}, blurb: 'Takes off like a helicopter and cruises like a plane.', where: '' },
    drone: { role: 'Uncrewed aircraft', art: 'drone', opts: {}, blurb: 'A remotely piloted aircraft.', where: '' },
    fighter: { role: 'Jet', art: 'fighter', opts: {}, blurb: 'A high-performance jet.', where: '' },
    miltransport: { role: 'Transport', art: 'airlifter', opts: {}, blurb: 'A large transport aircraft.', where: '' }
  };

  function aircraft(ac, info) {
    var t = TYPES[ac.type], f = t ? FAM[t[2]] : (GENERIC[ac.cls] || GENERIC.narrow);
    var maker = t ? t[0] : (info && info.maker) || '';
    var model = t ? t[1] : (info && info.type) || (root.Core && root.Core.TYPES[ac.type]) || ac.type || 'Unknown type';
    var name = maker && model.indexOf(maker) !== 0 ? maker + ' ' + model : model;
    return { maker: maker, model: model, name: name, role: f.role, blurb: f.blurb, where: f.where, art: f.art, opts: f.opts || {} };
  }

  /* ---------- airlines, by the three-letter code that starts the callsign ---------- */
  var EAGLE = 'Flies for American Eagle', DLC = 'Flies for Delta Connection', UAX = 'Flies for United Express';
  var AIRLINES = {
    AAL: ['American Airlines'], UAL: ['United Airlines'], DAL: ['Delta Air Lines'], SWA: ['Southwest Airlines'], JBU: ['JetBlue'], ASA: ['Alaska Airlines'],
    NKS: ['Spirit Airlines'], FFT: ['Frontier Airlines'], AAY: ['Allegiant Air'], SCX: ['Sun Country Airlines'], MXY: ['Breeze Airways'], HAL: ['Hawaiian Airlines'],
    RPA: ['Republic Airways', 'Flies for American Eagle, Delta Connection and United Express'], SKW: ['SkyWest Airlines', 'Flies for United Express, Delta Connection, American Eagle and Alaska'],
    ENY: ['Envoy Air', EAGLE], PDT: ['Piedmont Airlines', EAGLE], JIA: ['PSA Airlines', EAGLE], EDV: ['Endeavor Air', DLC], ASH: ['Mesa Airlines', UAX],
    GJS: ['GoJet Airlines', UAX], UCA: ['CommutAir', UAX], QXE: ['Horizon Air', 'Flies for Alaska Airlines'], AWI: ['Air Wisconsin'],
    UPS: ['UPS Airlines', 'Cargo'], FDX: ['FedEx Express', 'Cargo'], GTI: ['Atlas Air', 'Cargo (also flies for Amazon Air)'], ABX: ['ABX Air', 'Cargo (also flies for Amazon Air)'],
    ATN: ['Air Transport International', 'Cargo (also flies for Amazon Air)'], CKS: ['Kalitta Air', 'Cargo'], AJT: ['Amerijet', 'Cargo'],
    ACA: ['Air Canada'], JZA: ['Jazz', 'Flies for Air Canada Express'], POE: ['Porter Airlines'], WJA: ['WestJet'],
    BAW: ['British Airways'], VIR: ['Virgin Atlantic'], DLH: ['Lufthansa'], AFR: ['Air France'], KLM: ['KLM'], UAE: ['Emirates'], QTR: ['Qatar Airways'],
    ETD: ['Etihad Airways'], THY: ['Turkish Airlines'], SAS: ['SAS Scandinavian'], IBE: ['Iberia'], AUA: ['Austrian Airlines'], SWR: ['Swiss'], TAP: ['TAP Air Portugal'],
    ETH: ['Ethiopian Airlines'], ANA: ['All Nippon Airways'], JAL: ['Japan Airlines'], KAL: ['Korean Air'], AMX: ['Aeromexico'], AVA: ['Avianca'],
    CMP: ['Copa Airlines'], ICE: ['Icelandair'], EIN: ['Aer Lingus'], SVA: ['Saudia'], RAM: ['Royal Air Maroc'], AIC: ['Air India'], ELY: ['El Al'],
    CCA: ['Air China'], VOI: ['Volaris'], BWA: ['Caribbean Airlines'],
    EJA: ['NetJets', 'Fractional jet ownership'], LXJ: ['Flexjet', 'Fractional jet ownership'], JTL: ['Jet Linx', 'Private jet charter and management'], WUP: ['Wheels Up', 'Private jet charter']
  };
  // Who's flying: the airline from the callsign, or a private flight under its registration.
  function operator(ac, info, airlineName) {
    var cs = ac.call || '', reg = (ac.reg || '').replace(/-/g, '');
    var code = /^([A-Z]{3})\d/.exec(cs), a = code && AIRLINES[code[1]];
    if (airlineName) return { name: airlineName, note: a && a[1] || '' };
    if (a) return { name: a[0], note: a[1] || '' };
    if (cs && reg && cs.replace(/-/g, '') === reg) return { name: '', note: 'Flying under its registration, which is typical of private and training flights' };
    return null;
  }
  // How to read the registered owner (the operator is who flies it; the owner is on the registry).
  function ownerNote(owner, ac, opName) {
    if (!owner) return '';
    var o = owner.toLowerCase(), firstWord = (opName || '').toLowerCase().split(' ')[0];
    if (firstWord && firstWord.length > 2 && o.indexOf(firstWord) >= 0) return 'The airline owns this plane itself.';
    if (/trust|trustee/.test(o)) return 'A trust company holding the registration for the real owner, which is common for privately owned and leased aircraft.';
    if (/bank|leasing|capital|aviation finance|aercap|smbc|avolon|air lease|aircastle/.test(o)) return 'A bank or leasing company. Airlines lease many of their planes.';
    var small = ac && /^(bizjet|prop|heli)$/.test(ac.cls);
    if (small && /\b(llc|inc|corp|corporation|company|co\.?|lp|ltd)\b/.test(o)) return 'Private planes are often registered to a company set up just to own the plane.';
    return '';
  }

  root.CivInfo = { aircraft: aircraft, operator: operator, ownerNote: ownerNote, AIRLINES: AIRLINES, TYPES: TYPES };
})(typeof window !== 'undefined' ? window : globalThis);
