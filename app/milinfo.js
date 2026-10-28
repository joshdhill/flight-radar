/* Plane Sight — military briefings.
   Who flies it (service), what it is, and what that callsign usually means.
   The service comes from the aircraft registry (adsbdb's registered owner) when it has the airframe,
   otherwise from the callsign, the tail-number format and the aircraft type. */
(function (root) {
  'use strict';

  /* ---------- services ---------- */
  var SERVICES = {
    army: { name: 'U.S. Army', short: 'Army' },
    af: { name: 'U.S. Air Force', short: 'Air Force' },
    navy: { name: 'U.S. Navy', short: 'Navy' },
    usmc: { name: 'U.S. Marine Corps', short: 'Marines' },
    uscg: { name: 'U.S. Coast Guard', short: 'Coast Guard' },
    ussf: { name: 'U.S. Space Force', short: 'Space Force' },
    arng: { name: 'Army National Guard', short: 'Army Guard' },
    ang: { name: 'Air National Guard', short: 'Air Guard' },
    us: { name: 'U.S. Military', short: 'U.S. military' },
    foreign: { name: 'Military', short: 'Military' }
  };
  function svc(key, name) { var s = SERVICES[key] || SERVICES.us; return { key: key, name: name || s.name, short: name ? shortForeign(name) : s.short }; }
  function shortForeign(n) { return n.replace(/^(The )/, '').replace(/^Royal /, 'Royal ').slice(0, 28); }

  function fromOwner(owner) {
    var o = (owner || '').toLowerCase();
    if (!o) return null;
    if (/army national guard/.test(o)) return svc('arng');
    if (/air national guard/.test(o)) return svc('ang');
    if (/coast guard/.test(o) && /united states|u\.s\.|us /.test(o + ' ')) return svc('uscg');
    if (/marine corps/.test(o)) return svc('usmc');
    if (/space force/.test(o)) return svc('ussf');
    if (/united states|^us |u\.s\./.test(o + ' ')) {
      if (/air force/.test(o)) return svc('af');
      if (/navy/.test(o)) return svc('navy');
      if (/army/.test(o)) return svc('army');
    }
    if (/air force|navy|army|marine|military|defen[cs]e|luftwaffe|armée|aeronautica/.test(o)) return svc('foreign', owner.trim());
    return null;
  }

  var HELO_ARMY = /^(H60|S70|H64|H47|EC45|H145|H72|UH72|EC35|H6)/;
  var USMC_TYPES = /^(V22|UH1Y|AH1Z|H1$|H53|H53S|S92|H3$|S61|K30J)/;
  var USCG_TYPES = /^(AS65|H65|C27J|CN35|C144)/;
  function fromCallsign(cs, type) {
    if (/^PAT\d/.test(cs)) return svc('army');
    if (/^(SAM|SPAR|RCH|REACH|KING|JOLLY|PEDRO|TEAL|EVAC|MUSL|MUSEL)\d*$/.test(cs.replace(/\d+$/, '')) || /^AF[12]$/.test(cs)) return svc('af');
    if (/^(CNV|NAVY)\d/.test(cs)) return svc('navy');
    if (/^(NIGHTHAWK|NHAWK|MARINE)/.test(cs)) return svc('usmc');
    if (/^ARMY\d/.test(cs)) return svc('army');
    if (/^USAF\d/.test(cs)) return svc('af');
    if (/^C\d{4}$/.test(cs) && (USCG_TYPES.test(type) || /^(H60|C130|C30J|GLF5|C27J)/.test(type))) return svc('uscg');
    return null;
  }
  // Tail-number formats: Army and Air Force use fiscal-year serials ("13-20636"), the Navy and
  // Marines six-digit Bureau Numbers ("168459"), the Coast Guard four digits ("6605").
  function fromTail(reg, type) {
    var r = reg || '';
    if (/^\d{4}$/.test(r) && (USCG_TYPES.test(type) || /^(H60|C130|C30J|GLF5|C27J)/.test(type))) return svc('uscg');
    if (/^1[5-7]\d{4}$/.test(r)) return USMC_TYPES.test(type) ? svc('usmc') : svc('navy');
    if (/^\d{2}-\d{4,5}$/.test(r)) {
      if (HELO_ARMY.test(type) || /^(BE20|B350|BE9L|C560|C56X|C680|C26|SW4|DHC6|DH8)/.test(type)) return svc('army');
      return svc('af');
    }
    return null;
  }
  function service(ac, info) {
    var t = ac.type || '', usHex = /^a[ef]/i.test(ac.id || '');
    var s = fromOwner(info && info.owner) || fromCallsign(ac.call || '', t) || (usHex ? fromTail(ac.reg, t) : null);
    if (s) return s;
    var ti = TYPE_INFO[t];
    if (usHex && ti && ti.svc) return svc(ti.svc);
    return usHex ? svc('us') : svc('foreign');
  }

  /* ---------- aircraft ---------- */
  // art: which illustration to draw. svc: the usual operator when nothing else says.
  var TYPE_INFO = {
    H60: { name: 'UH-60 Black Hawk', role: 'Utility helicopter', art: 'heli-utility', svc: 'army',
      blurb: 'The military’s workhorse helicopter. Black Hawks move troops and cargo, fly medical evacuations and rescues, and around Washington they shuttle senior officials.' },
    H64: { name: 'AH-64 Apache', role: 'Attack helicopter', art: 'heli-attack', svc: 'army',
      blurb: 'The Army’s main attack helicopter. Two crew sit one behind the other; it carries Hellfire missiles, rockets and a 30 mm chain gun under the nose.' },
    H47: { name: 'CH-47 Chinook', role: 'Heavy-lift helicopter', art: 'heli-tandem', svc: 'army',
      blurb: 'Twin-rotor heavy lifter that carries troops, artillery and vehicles, often slung underneath. Flying since the 1960s and still the Army’s answer for big loads.' },
    EC45: { name: 'UH-72 Lakota', role: 'Light utility helicopter', art: 'heli-light', svc: 'army',
      blurb: 'The Army’s light helicopter, used for flight training, medical evacuation and support missions at home, much of it flown by the National Guard.' },
    H145: { name: 'UH-72 Lakota', role: 'Light utility helicopter', art: 'heli-light', svc: 'army',
      blurb: 'The Army’s light helicopter, used for flight training, medical evacuation and support missions at home, much of it flown by the National Guard.' },
    B212: { name: 'UH-1N Twin Huey', role: 'Utility helicopter', art: 'heli-huey', svc: 'af',
      blurb: 'A twin-engine version of the Vietnam-era Huey. Over Washington, these are usually the Air Force’s 1st Helicopter Squadron from Joint Base Andrews, which moves senior officials and stands ready to evacuate them in an emergency.' },
    UH1N: { name: 'UH-1N Twin Huey', role: 'Utility helicopter', art: 'heli-huey', svc: 'af',
      blurb: 'A twin-engine version of the Vietnam-era Huey. Over Washington, these are usually the Air Force’s 1st Helicopter Squadron from Joint Base Andrews, which moves senior officials and stands ready to evacuate them in an emergency.' },
    A139: { name: 'MH-139A Grey Wolf', role: 'Utility helicopter', art: 'heli-utility', svc: 'af',
      blurb: 'The Air Force’s new helicopter, replacing the old UH-1N Hueys for missile-field security and moving people around the capital.' },
    UH1Y: { name: 'UH-1Y Venom', role: 'Utility helicopter', art: 'heli-huey', svc: 'usmc',
      blurb: 'The Marine Corps’ modern four-blade Huey, used to move Marines, escort attack helicopters and evacuate casualties.' },
    AH1Z: { name: 'AH-1Z Viper', role: 'Attack helicopter', art: 'heli-attack', svc: 'usmc',
      blurb: 'The Marine Corps’ attack helicopter, the latest in the Cobra line that started in Vietnam.' },
    H53: { name: 'CH-53 Stallion', role: 'Heavy-lift helicopter', art: 'heli-utility', svc: 'usmc',
      blurb: 'The Marines’ heaviest helicopter. It can lift a light armored vehicle or another helicopter.' },
    H53S: { name: 'CH-53 Stallion', role: 'Heavy-lift helicopter', art: 'heli-utility', svc: 'usmc',
      blurb: 'The Marines’ heaviest helicopter. It can lift a light armored vehicle or another helicopter.' },
    S92: { name: 'VH-92A Patriot', role: 'Presidential helicopter', art: 'heli-utility', svc: 'usmc', livery: 'whitetop',
      blurb: 'The newest presidential helicopter, flown by the Marines of HMX-1 out of Quantico. With the President aboard, it flies as Marine One.' },
    H3: { name: 'VH-3D Sea King', role: 'Presidential helicopter', art: 'heli-utility', svc: 'usmc', livery: 'whitetop',
      blurb: 'A long-serving presidential helicopter flown by HMX-1, the Marine Corps squadron that flies Marine One.' },
    AS65: { name: 'MH-65 Dolphin', role: 'Rescue and intercept helicopter', art: 'heli-light', svc: 'uscg',
      blurb: 'The Coast Guard’s short-range rescue helicopter. Around Washington, Dolphins also stand alert to intercept small planes that stray into the restricted airspace over the capital.' },
    V22: { name: 'V-22 Osprey', role: 'Tiltrotor', art: 'tiltrotor', svc: 'usmc',
      blurb: 'Takes off like a helicopter, then tilts its rotors forward to cruise like a plane at about twice a helicopter’s speed. Marines fly the MV-22, the Air Force the CV-22 and the Navy the CMV-22.' },
    C17: { name: 'C-17 Globemaster III', role: 'Strategic airlifter', art: 'airlifter', svc: 'af',
      blurb: 'The Air Force’s big jet cargo plane. It carries tanks, helicopters and pallets of supplies across oceans, yet can land on short, rough runways.' },
    C5M: { name: 'C-5M Super Galaxy', role: 'Strategic airlifter', art: 'airlifter', svc: 'af', big: true,
      blurb: 'One of the largest aircraft in the world. The nose swings up so cargo can roll in the front and out the back. Many are based at Dover, Delaware.' },
    C5: { name: 'C-5 Galaxy', role: 'Strategic airlifter', art: 'airlifter', svc: 'af', big: true,
      blurb: 'One of the largest aircraft in the world. The nose swings up so cargo can roll in the front and out the back.' },
    C130: { name: 'C-130 Hercules', role: 'Tactical airlifter', art: 'turboprop', svc: 'af',
      blurb: 'The four-engine turboprop that has done nearly every job since the 1950s: paratroops, cargo drops, firefighting, rescues, hurricane hunting and refueling.' },
    C30J: { name: 'C-130J Super Hercules', role: 'Tactical airlifter', art: 'turboprop', svc: 'af',
      blurb: 'The modern Hercules, with six-blade propellers and a glass cockpit. It flies cargo, paratroops and special missions for every branch.' },
    K35R: { name: 'KC-135 Stratotanker', role: 'Aerial refueling tanker', art: 'tanker', svc: 'af', boom: true,
      blurb: 'A flying gas station. A boom operator lying in the tail steers a refueling boom into the aircraft behind. Some of these airframes date to the late 1950s.' },
    KC46: { name: 'KC-46 Pegasus', role: 'Aerial refueling tanker', art: 'tanker', svc: 'af', boom: true, twin: true,
      blurb: 'The Air Force’s newest tanker, built on the Boeing 767. It refuels by boom or hose and can also carry cargo and patients.' },
    B752: { name: 'C-32', role: 'VIP transport', art: 'jet', svc: 'af', livery: 'sam', twin: true,
      blurb: 'A military Boeing 757. The 89th Airlift Wing at Joint Base Andrews flies it for the Vice President, cabinet members and members of Congress. With the Vice President aboard, it flies as Air Force Two.' },
    B737: { name: 'C-40 Clipper', role: 'Transport', art: 'jet', svc: 'navy', twin: true,
      blurb: 'A military Boeing 737. The Navy uses it to move people and cargo; the Air Force flies it for senior leaders.' },
    B738: { name: 'C-40 Clipper', role: 'Transport', art: 'jet', svc: 'navy', twin: true,
      blurb: 'A military Boeing 737. The Navy uses it to move people and cargo; the Air Force flies it for senior leaders.' },
    C40: { name: 'C-40 Clipper', role: 'Transport', art: 'jet', svc: 'navy', twin: true,
      blurb: 'A military Boeing 737. The Navy uses it to move people and cargo; the Air Force flies it for senior leaders.' },
    B742: { name: 'Military Boeing 747', role: 'VIP or command aircraft', art: 'jet', svc: 'af', livery: 'sam',
      blurb: 'The Air Force flies only a handful of 747s: the two VC-25s that serve as Air Force One, and the E-4B, a hardened airborne command post.' },
    E4: { name: 'E-4B Nightwatch', role: 'Airborne command post', art: 'jet', svc: 'af',
      blurb: 'A hardened Boeing 747, often called the “Doomsday plane”. It can run the military from the air in a national emergency, and often carries the Secretary of Defense on trips.' },
    E3TF: { name: 'E-3 Sentry (AWACS)', role: 'Airborne early warning', art: 'tanker', svc: 'af', dome: true,
      blurb: 'The rotating radar dome on its back watches hundreds of miles of sky, so the crew can track aircraft and direct fighters.' },
    E3CF: { name: 'E-3 Sentry (AWACS)', role: 'Airborne early warning', art: 'tanker', svc: 'af', dome: true,
      blurb: 'The rotating radar dome on its back watches hundreds of miles of sky, so the crew can track aircraft and direct fighters.' },
    E6: { name: 'E-6B Mercury', role: 'Airborne command and relay', art: 'tanker', svc: 'navy',
      blurb: 'A Navy Boeing 707 that keeps communications open with ballistic-missile submarines and other nuclear forces, trailing a very long antenna wire in flight.' },
    R135: { name: 'RC-135', role: 'Reconnaissance', art: 'tanker', svc: 'af',
      blurb: 'A Boeing 707-based spy plane that listens to radar and radio signals from far away. The bulbous nose and cheeks hold its antennas.' },
    P8: { name: 'P-8A Poseidon', role: 'Maritime patrol', art: 'jet', svc: 'navy', twin: true,
      blurb: 'A Navy Boeing 737 that hunts submarines and watches shipping, dropping sonobuoys from its belly.' },
    E2: { name: 'E-2 Hawkeye', role: 'Airborne early warning', art: 'turboprop', svc: 'navy', dome: true,
      blurb: 'The Navy’s carrier-based radar plane, with a big rotating dish on its back.' },
    GLF4: { name: 'C-20 Gulfstream', role: 'Executive transport', art: 'bizjet', svc: 'af', livery: 'sam',
      blurb: 'A military Gulfstream that flies generals, admirals and senior officials.' },
    GLF5: { name: 'C-37 Gulfstream', role: 'Executive transport', art: 'bizjet', svc: 'af', livery: 'sam',
      blurb: 'A military Gulfstream that flies generals, admirals and senior officials. The Coast Guard flies one for its top leaders too.' },
    GLF6: { name: 'C-37 Gulfstream', role: 'Executive transport', art: 'bizjet', svc: 'af', livery: 'sam',
      blurb: 'A military Gulfstream that flies generals, admirals and senior officials.' },
    GL5T: { name: 'Military Global jet', role: 'Special mission', art: 'bizjet', svc: 'af',
      blurb: 'A Bombardier business jet in military service, used as a high-altitude communications relay or for special missions.' },
    LJ35: { name: 'C-21A Learjet', role: 'Operational support airlift', art: 'bizjet', svc: 'af',
      blurb: 'A military Learjet for moving small groups of people and urgent cargo.' },
    C560: { name: 'UC-35 Citation', role: 'Executive transport', art: 'bizjet', svc: 'army',
      blurb: 'A military Cessna Citation that flies senior officers and small teams between bases.' },
    C56X: { name: 'UC-35 Citation', role: 'Executive transport', art: 'bizjet', svc: 'army',
      blurb: 'A military Cessna Citation that flies senior officers and small teams between bases.' },
    BE20: { name: 'C-12 Huron', role: 'Utility transport', art: 'twinprop', svc: 'army',
      blurb: 'A military King Air twin turboprop for moving small groups and light cargo. Some versions carry sensors for surveillance.' },
    B350: { name: 'C-12 Huron', role: 'Utility transport', art: 'twinprop', svc: 'army',
      blurb: 'A military King Air twin turboprop for moving small groups and light cargo. Some versions carry sensors for surveillance.' },
    BE9L: { name: 'C-12 Huron', role: 'Utility transport', art: 'twinprop', svc: 'army',
      blurb: 'A military King Air twin turboprop for moving small groups and light cargo.' },
    C26: { name: 'C-26 Metroliner', role: 'Utility and surveillance', art: 'twinprop', svc: 'army',
      blurb: 'A small twin turboprop the Guard uses for transport and, with a camera turret, for counter-drug surveillance.' },
    PC12: { name: 'U-28A Draco', role: 'Special operations surveillance', art: 'twinprop', svc: 'af', single: true,
      blurb: 'A militarized Pilatus PC-12 that Air Force Special Operations uses for surveillance and reconnaissance.' },
    C27J: { name: 'HC-27J Spartan', role: 'Medium-range surveillance', art: 'turboprop', svc: 'uscg', twin: true,
      blurb: 'A twin turboprop the Coast Guard uses for search and rescue, drug interdiction and maritime patrol.' },
    CN35: { name: 'HC-144 Ocean Sentry', role: 'Maritime patrol', art: 'turboprop', svc: 'uscg', twin: true,
      blurb: 'A Coast Guard patrol plane for search and rescue and watching the coastline.' },
    F16: { name: 'F-16 Fighting Falcon', role: 'Multirole fighter', art: 'fighter', svc: 'af',
      blurb: 'The single-engine fighter that is the backbone of the Air National Guard. D.C. Guard F-16s at Joint Base Andrews stand alert to guard the capital’s airspace.' },
    F15: { name: 'F-15 Eagle', role: 'Air superiority fighter', art: 'fighter', svc: 'af', twinTail: true,
      blurb: 'A twin-engine fighter built to win air battles. The F-15E Strike Eagle and new F-15EX carry heavy bomb loads too.' },
    F15E: { name: 'F-15E Strike Eagle', role: 'Strike fighter', art: 'fighter', svc: 'af', twinTail: true,
      blurb: 'A two-seat, twin-engine fighter that can fight in the air and hit ground targets day or night.' },
    F18S: { name: 'F/A-18 Super Hornet', role: 'Carrier strike fighter', art: 'fighter', svc: 'navy', twinTail: true,
      blurb: 'The Navy’s main carrier fighter, built to launch by catapult and land on a moving deck with an arresting hook.' },
    F18H: { name: 'F/A-18 Super Hornet', role: 'Carrier strike fighter', art: 'fighter', svc: 'navy', twinTail: true,
      blurb: 'The Navy’s main carrier fighter, built to launch by catapult and land on a moving deck with an arresting hook.' },
    F35: { name: 'F-35 Lightning II', role: 'Stealth multirole fighter', art: 'fighter', svc: 'af', twinTail: true,
      blurb: 'A stealth fighter that shares its sensor picture with everything around it. The Air Force, Navy and Marines each fly their own version.' },
    F22: { name: 'F-22 Raptor', role: 'Stealth air superiority fighter', art: 'fighter', svc: 'af', twinTail: true,
      blurb: 'The Air Force’s stealth air-dominance fighter. It can cruise faster than sound without afterburner.' },
    A10: { name: 'A-10 Thunderbolt II', role: 'Close air support', art: 'fighter', svc: 'af',
      blurb: 'The “Warthog”: a tough, slow, low-flying attack jet built around a huge 30 mm cannon.' },
    T38: { name: 'T-38 Talon', role: 'Supersonic trainer', art: 'fighter', svc: 'af',
      blurb: 'The supersonic jet trainer generations of Air Force pilots learned in. NASA astronauts fly it too.' },
    T6: { name: 'T-6 Texan II', role: 'Primary trainer', art: 'twinprop', svc: 'af', single: true,
      blurb: 'The turboprop trainer where Air Force and Navy pilots start out.' },
    TEX2: { name: 'T-6 Texan II', role: 'Primary trainer', art: 'twinprop', svc: 'af', single: true,
      blurb: 'The turboprop trainer where Air Force and Navy pilots start out.' },
    T45: { name: 'T-45 Goshawk', role: 'Carrier jet trainer', art: 'fighter', svc: 'navy',
      blurb: 'The Navy’s jet trainer, where student pilots learn carrier landings.' },
    B52: { name: 'B-52 Stratofortress', role: 'Strategic bomber', art: 'tanker', svc: 'af',
      blurb: 'The eight-engine bomber that first flew in 1952 and is planned to keep flying into the 2050s.' },
    B1: { name: 'B-1B Lancer', role: 'Strategic bomber', art: 'fighter', svc: 'af',
      blurb: 'A supersonic bomber with swing wings that carries the largest weapons load in the Air Force.' },
    U2: { name: 'U-2 Dragon Lady', role: 'High-altitude reconnaissance', art: 'drone', svc: 'af', piloted: true,
      blurb: 'A Cold War spy plane still flying at around 70,000 ft, so high its pilots wear pressure suits.' },
    Q4: { name: 'RQ-4 Global Hawk', role: 'Unmanned surveillance', art: 'drone', svc: 'af',
      blurb: 'A pilotless surveillance plane that flies for more than a day at over 50,000 ft. The Navy’s version is the MQ-4C Triton.' },
    Q9: { name: 'MQ-9 Reaper', role: 'Unmanned surveillance and strike', art: 'drone', svc: 'af', prop: true,
      blurb: 'A remotely piloted aircraft flown from a ground station, used for surveillance and strikes.' },
    MQ9: { name: 'MQ-9 Reaper', role: 'Unmanned surveillance and strike', art: 'drone', svc: 'af', prop: true,
      blurb: 'A remotely piloted aircraft flown from a ground station, used for surveillance and strikes.' }
  };
  TYPE_INFO.S70 = TYPE_INFO.H60; TYPE_INFO.H72 = TYPE_INFO.UH72 = TYPE_INFO.EC45; TYPE_INFO.C130H = TYPE_INFO.C130;
  TYPE_INFO.F15X = TYPE_INFO.F15; TYPE_INFO.F18 = TYPE_INFO.F18S; TYPE_INFO.B748 = TYPE_INFO.B742; TYPE_INFO.S61 = TYPE_INFO.H3;

  // Same type, different job, depending on who flies it.
  function variant(t, s, info) {
    var base = TYPE_INFO[t];
    if (!base) return null;
    var v = Object.assign({}, base);
    if ((t === 'H60' || t === 'S70') && s === 'navy') { v.name = 'MH-60 Seahawk'; v.blurb = 'The Navy’s version of the Black Hawk. It hunts submarines, resupplies ships at sea and flies rescues.'; }
    if ((t === 'H60' || t === 'S70') && s === 'uscg') { v.name = 'MH-60T Jayhawk'; v.role = 'Search and rescue helicopter'; v.blurb = 'The Coast Guard’s long-range rescue helicopter, built to pull people out of the water far offshore.'; }
    if ((t === 'H60' || t === 'S70') && s === 'af') { v.name = 'HH-60 Pave Hawk'; v.role = 'Combat rescue helicopter'; v.blurb = 'The Air Force’s rescue Black Hawk, built to recover downed aircrew, with a refueling probe for long missions.'; }
    if ((t === 'H60' || t === 'S70') && s === 'usmc') { v.name = 'VH-60N White Hawk'; v.role = 'Presidential support helicopter'; v.livery = 'whitetop'; v.blurb = 'A VIP Black Hawk flown by HMX-1, the Marine Corps presidential squadron. With the President aboard it flies as Marine One.'; }
    if ((t === 'C130' || t === 'C30J') && s === 'uscg') { v.name = 'HC-130 Hercules'; v.role = 'Long-range search and rescue'; v.blurb = 'The Coast Guard’s long-range patrol plane for rescues and watching the sea far offshore.'; }
    if ((t === 'C130' || t === 'C30J') && s === 'usmc') { v.name = 'KC-130J Super Hercules'; v.role = 'Tanker and transport'; v.blurb = 'The Marines’ Hercules, which refuels helicopters and jets through hoses under its wings and hauls cargo.'; }
    if ((t === 'C130' || t === 'C30J') && s === 'navy') { v.name = 'C-130T Hercules'; v.blurb = 'A Navy Reserve Hercules that moves cargo and people between bases and ships’ home ports.'; }
    if (t === 'B737' || t === 'B738' || t === 'C40') { if (s === 'af') v.livery = 'sam'; }
    if (t === 'Q4' && s === 'navy') { v.name = 'MQ-4C Triton'; v.role = 'Unmanned maritime patrol'; v.blurb = 'The Navy’s version of the Global Hawk, which watches the ocean from very high altitude for a day or more at a time.'; }
    if (t === 'V22' && s === 'af') v.name = 'CV-22 Osprey';
    if (t === 'V22' && s === 'usmc') v.name = 'MV-22 Osprey';
    if (t === 'V22' && s === 'navy') v.name = 'CMV-22 Osprey';
    if (t === 'GLF5' && s === 'uscg') v.livery = 'uscgjet';
    if (t === 'BE20' && s === 'af') v.name = 'C-12 Huron';
    return v;
  }
  // The registry names the exact variant ("UH-60M Blackhawk", "C-32B"): use it, with house spelling.
  function cleanRegistryName(n) {
    return String(n || '').replace(/Blackhawk/i, 'Black Hawk').replace(/\s+/g, ' ').trim();
  }
  function looksMilitaryName(n) { return /^[A-Z]{1,3}-\d{1,3}[A-Z]?\b/.test(n || ''); }
  function nicknameOf(name) { var m = /^[A-Z]{1,4}-\d{1,3}[A-Z]{0,2}\s+(.+)$/.exec(name || ''); return m ? m[1] : ''; }

  function aircraft(ac, s, info) {
    var t = ac.type || '', v = variant(t, s.key, info);
    var reg = cleanRegistryName(info && info.type);
    var C = root.Core, plain = (C && C.TYPES && C.TYPES[t]) || t || 'Unknown type';
    var out = v ? v : { name: plain, role: 'Military aircraft', art: artFor(ac.cls), blurb: '' };
    out = Object.assign({}, out);
    if (reg && looksMilitaryName(reg)) {
      // keep the house nickname if the registry only has the designation ("C-32B" -> "C-32B")
      var nick = nicknameOf(out.name);
      out.name = /\s/.test(reg) || !nick ? reg : reg + ' ' + nick;
    } else if (!v && reg) out.name = reg;
    if (t === 'B742' || t === 'B748') {
      if (/E-4/.test(reg)) out = Object.assign({}, TYPE_INFO.E4, { name: reg });
      else if (/VC-25/.test(reg)) { out.name = reg; out.role = 'Presidential transport'; out.blurb = 'One of the two presidential 747s. With the President aboard, it flies as Air Force One.'; }
    }
    if (/^C-32B/.test(out.name)) { out.livery = ''; out.blurb = 'A lower-profile military Boeing 757, mostly white, used for rapid-response government flights.'; }
    out.art = out.art || artFor(ac.cls);
    return out;
  }
  function artFor(cls) {
    return { heli: 'heli-utility', tiltrotor: 'tiltrotor', fighter: 'fighter', miltransport: 'airlifter', wide: 'jet', narrow: 'jet', regional: 'jet', bizjet: 'bizjet', prop: 'twinprop', drone: 'drone' }[cls] || 'jet';
  }

  /* ---------- the flight ---------- */
  var MISSIONS = [
    [/^AF1$/, 'Air Force One', 'The President is aboard. Any Air Force aircraft carrying the President uses this callsign.'],
    [/^AF2$/, 'Air Force Two', 'The Vice President is aboard.'],
    [/^SAM\d/, 'Special Air Mission', 'Flown by the 89th Airlift Wing out of Joint Base Andrews, which carries the Vice President, cabinet members, members of Congress and other senior officials.'],
    [/^SPAR\d/, 'Senior leader flight', 'SPAR is the callsign the Air Force uses for VIP jets carrying generals, admirals and other senior officials.'],
    [/^RCH\d|^REACH/, 'Reach', 'Air Mobility Command’s callsign for cargo, airlift and tanker missions, from routine supply runs to deployments.'],
    [/^PAT\d/, 'Priority Air Transport', 'The Army’s VIP shuttle. Black Hawks of the 12th Aviation Battalion at Davison Army Airfield, Fort Belvoir, fly senior defense officials around the capital and would evacuate leaders in an emergency. Army C-12s and UC-35s fly as PAT too.'],
    [/^(MUSL|MUSEL)/, '1st Helicopter Squadron', 'Air Force helicopters from Joint Base Andrews that move senior officials around the capital and stand ready to evacuate them in an emergency.'],
    [/^(NIGHTHAWK|NHAWK)/, 'HMX-1 “Nighthawk”', 'The Marine Corps presidential helicopter squadron from Quantico. With the President aboard, the helicopter becomes Marine One.'],
    [/^CNV\d/, 'Convoy', 'A Navy logistics flight moving people and cargo between bases.'],
    [/^KING\d/, 'King', 'An Air Force HC-130 combat rescue flight.'],
    [/^(JOLLY|PEDRO)\d/, 'Combat rescue', 'Callsigns of Air Force rescue helicopters, whose job is to recover downed aircrew.'],
    [/^TEAL\d/, 'Hurricane Hunters', 'The Air Force Reserve’s 53rd Weather Reconnaissance Squadron, which flies WC-130Js straight into storms.'],
    [/^EVAC\d/, 'Aeromedical evacuation', 'A military flight carrying patients, often wounded or sick service members.'],
    [/^(ARMY|NAVY|USAF)\d/, 'Military flight', 'A general military callsign, often used for transit and training flights.']
  ];
  function mission(ac, s) {
    var cs = ac.call || '';
    for (var i = 0; i < MISSIONS.length; i++) if (MISSIONS[i][0].test(cs)) return { title: MISSIONS[i][1], text: MISSIONS[i][2] };
    if (/^C\d{4}$/.test(cs) && s.key === 'uscg') return { title: 'Coast Guard ' + cs.slice(1), text: 'Coast Guard aircraft fly under their tail number, so this is airframe ' + cs.slice(1) + '.' };
    var digits = (ac.reg || '').replace(/\D/g, '');
    if (cs && digits.length >= 4 && cs.replace(/\D/g, '').length >= 4 && digits.slice(-4) === cs.replace(/\D/g, '').slice(-4))
      return { title: 'Flying under its tail number', text: 'The callsign is built from this airframe’s serial number, which is common on training, test and positioning flights.' };
    return null;
  }

  function briefing(ac, info) {
    var s = service(ac, info), a = aircraft(ac, s, info), m = mission(ac, s);
    var livery = a.livery || '';
    if (/^SAM\d|^AF[12]$/.test(ac.call || '')) livery = 'sam';
    return { service: s, aircraft: a, mission: m, art: a.art, livery: livery || s.key };
  }
  // Short label for the map: "UH-60 · Army"
  function label(ac, info) {
    var s = service(ac, info), a = aircraft(ac, s, info);
    var short = (a.name.match(/^[A-Z]{1,4}-\d{1,3}[A-Z]{0,2}/) || [a.name.split(' ').slice(0, 2).join(' ')])[0];
    return short + ' · ' + s.short;
  }

  root.MilInfo = { service: service, aircraft: aircraft, mission: mission, briefing: briefing, label: label, TYPE_INFO: TYPE_INFO, SERVICES: SERVICES };
})(typeof window !== 'undefined' ? window : globalThis);
