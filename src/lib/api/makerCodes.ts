// lib/api/makerCodes.ts — maker (fabricante) → numeric code, per the customer's
// official table (fabricante.pdf). codigoMarca is resolved from the brand NAME
// via this table (overwriting any code the vendor payload carried). No match →
// null. Matching is accent/punctuation-insensitive.

import "server-only";

// Brand name (as in the table) → id.
const RAW: Record<string, number> = {
  "ACURA": 52, "ADAMO": 53, "AGRALE": 40, "AIMA": 178, "ALFA ROMEO": 22,
  "ALPINA CARRETINHAS": 175, "AMAZONAS": 37, "AMERICAR": 54, "APRILIA": 139,
  "ASIA MOTORS": 23, "ASTON MARTIN": 55, "AUDI": 12, "AUSTIN": 56, "BAJA": 57,
  "BAJAJ": 211, "BEACH": 58, "BEE GREEN BIKES": 173, "BENELLI": 146, "BENTLEY": 59,
  "BIANCO": 60, "BIKELETE": 158, "BIMOTA": 147, "BMW": 17, "BOLIN ELETRIC MOTOR": 212,
  "BOLT": 181, "BOMBARDIER": 164, "BRAMONT": 153, "BRM": 61, "BRP": 160, "BUELL": 138,
  "BUGATTI": 62, "BUGGY": 177, "BUGWAY": 63, "BUICK": 64, "BUSCAR": 46, "BYD": 194,
  "CADILLAC": 65, "CAIO": 45, "CAN-AM": 183, "CARRETAS ANGOLA": 190,
  "CARRETAS ANTONINI": 197, "CARRETAS FACCHINI": 201, "CARRETAS GOYDO": 198,
  "CARRETAS RODOTEC": 199, "CARRETAS RODOTECNICA": 200, "CBT": 66, "CHAMONIX": 67,
  "CHANA": 68, "CHANGAN (CAOA)": 214, "CHERY (CAOA)": 144, "CHEVROLET": 2,
  "CHRYSLER": 18, "CITROEN": 16, "COLLUNA": 156, "COMIL": 47, "CORD": 69, "COYOTE": 70,
  "CROSS LANDER": 71, "DAEWOO": 50, "DAF CAMINHÕES": 202, "DAFRA": 49, "DAIHATSU": 24,
  "DE SOTO": 72, "DKW-VEMAG": 73, "DODGE": 29, "DUCATI": 145, "DUNNAS": 74, "EFFA": 75,
  "EMIS": 76, "ENGESA": 77, "ENVEMO": 78, "FARUS": 79, "FERCAR": 210, "FERRARI": 80,
  "FIAT": 5, "FIBRAFORT": 159, "FNM": 81, "FORD": 4, "FREE": 157, "FYBER": 82, "FYM": 51,
  "GAC": 209, "GAS GAS": 148, "GEELY": 188, "GEO": 83, "GLOOV": 174, "GMC": 84,
  "GRANCAR": 85, "GREEN": 169, "GURGEL": 86, "GWM": 195, "GXV": 215, "HAFEI": 87,
  "HAOJUE": 208, "HARLEY DAVIDSON": 137, "HB": 88, "HOFSTETTER": 89, "HONDA": 6,
  "HUMMER": 90, "HUSABERG": 149, "HUSQVARNA": 150, "HYUNDAI": 14, "IMPORTADO": 8,
  "INDIAN": 168, "INFINITI": 91, "INTERNACIONAL": 92, "ISUZU": 93, "IVECO": 43,
  "JAC MOTORS": 141, "JAGUAR": 94, "JEEP": 35, "JINBEI": 95, "JONWAY JONNY": 161,
  "JPX": 96, "JTA": 206, "JTZ": 172, "KAPPAK": 184, "KASINSKI": 143, "KAWASAKI": 140,
  "KIA MOTORS": 9, "KOENIGSEGG": 97, "KORG": 185, "KTM": 151, "KYMCO": 171,
  "L AUTOMOBILE": 98, "LADA": 99, "LAMBORGHINI": 100, "LANCIA": 101, "LAND ROVER": 38,
  "LEXUS": 102, "LIFAN": 142, "LINCOLN": 103, "LOBINI": 104, "LOTUS": 105,
  "MAHINDRA": 106, "MAN": 204, "MARCOPOLO": 41, "MARINA´S": 107, "MASERATI": 108,
  "MATRA": 109, "MAZDA": 32, "MCLAREN": 176, "MERCEDES BENZ": 15, "MERCURY": 110,
  "MG": 111, "MINI": 112, "MITSUBISHI": 25, "MIURA": 113, "MOBYOU": 182, "MORMAII": 165,
  "MORRIS": 114, "MOTOCICLETA": 20, "MP LAFER": 115, "MUUV": 166, "MV AGUSTA": 152,
  "MVK": 36, "NEOBUS": 44, "NISSAN": 19, "OLDSMOBILE": 116, "OMODA/JAECOO": 213,
  "OPEL": 117, "OUTROS": 21, "PEUGEOT": 7, "PIAGGIO": 192, "PINELLI": 179,
  "PLYMOUTH": 118, "POLARIS": 155, "PONTIAC": 119, "PORSCHE": 120, "PUMA": 121,
  "RAM": 186, "RECLAL": 205, "RENAULT": 10, "RENO": 122, "ROLLS-ROYCE": 123,
  "ROMI": 124, "ROVER": 125, "ROYAL ENFIELD": 167, "SAAB": 126, "SANTA MATILDE": 127,
  "SATURN": 128, "SCANIA": 33, "SEA DOO": 154, "SEAT": 31, "SERES": 207, "SHELBY": 129,
  "SHINERAY": 163, "SHORT": 130, "SIMCA": 131, "SMART": 132, "SOUSA MOTOS": 187,
  "SOVER": 180, "SSANGYONG": 133, "STAR CAMPY": 193, "SUBARU": 39, "SUNDOWN": 34,
  "SUZUKI": 28, "TESLA": 191, "TOYOTA": 11, "TRAXX": 162, "TRIUMPH": 48, "TROLLER": 26,
  "TRUCKVAN": 203, "UNIMOG": 134, "VOLARE": 42, "VOLKSWAGEN": 3, "VOLVO": 27,
  "WAKE": 170, "WALK": 135, "WAYY MOBILLY": 189, "WILLYS": 136, "YADEA": 196,
  "YAMAHA": 30,
};

// Common payload spellings that differ from the table.
const ALIASES: Record<string, string> = {
  "VW": "VOLKSWAGEN", "VW VOLKSWAGEN": "VOLKSWAGEN",
  "MERCEDES": "MERCEDES BENZ", "MERCEDES BENZ DO BRASIL": "MERCEDES BENZ", "MB": "MERCEDES BENZ",
  "GM": "CHEVROLET", "GM CHEVROLET": "CHEVROLET",
  "CHERY": "CHERY (CAOA)", "CHANGAN": "CHANGAN (CAOA)",
  "KIA": "KIA MOTORS", "JAC": "JAC MOTORS", "ASIA": "ASIA MOTORS",
  "HARLEY-DAVIDSON": "HARLEY DAVIDSON", "ALFA-ROMEO": "ALFA ROMEO", "LAND-ROVER": "LAND ROVER",
};

// Accent/punctuation-insensitive normalize: NFD, drop non-ASCII (accents), upper,
// collapse non-alphanumerics to single spaces.
function norm(s: string): string {
  return s.normalize("NFD").replace(/[^\x00-\x7F]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

const LOOKUP = new Map<string, number>();
for (const [name, id] of Object.entries(RAW)) LOOKUP.set(norm(name), id);

/** Resolve the maker code from a brand name. null if not in the table. */
export function makerCode(brand: string | null): number | null {
  if (!brand) return null;
  const n = norm(brand);
  if (LOOKUP.has(n)) return LOOKUP.get(n)!;
  const alias = ALIASES[n];
  if (alias) { const an = norm(alias); if (LOOKUP.has(an)) return LOOKUP.get(an)!; }
  return null;
}
