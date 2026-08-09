import { WasteItem, WasteReport } from "./types";

type SeedItem = Omit<WasteItem, "id">;
type Profile = "pet" | "flexible" | "can" | "cup" | "paper" | "personalCare" | "household" | "other";

type SeedArea = {
  slug: string;
  name: string;
  count: number;
  latitude: number;
  longitude: number;
  profile: Profile;
};

const areas: SeedArea[] = [
  { slug: "gambir", name: "Monas & Gambir, Central Jakarta", count: 32, latitude: -6.1754, longitude: 106.8272, profile: "pet" },
  { slug: "tanah-abang", name: "Tanah Abang, Central Jakarta", count: 28, latitude: -6.1862, longitude: 106.8108, profile: "flexible" },
  { slug: "kota-tua", name: "Kota Tua & Taman Sari, West Jakarta", count: 24, latitude: -6.1352, longitude: 106.8133, profile: "cup" },
  { slug: "blok-m", name: "Blok M, South Jakarta", count: 22, latitude: -6.2446, longitude: 106.8006, profile: "can" },
  { slug: "kemang", name: "Kemang & Mampang, South Jakarta", count: 20, latitude: -6.2607, longitude: 106.8132, profile: "flexible" },
  { slug: "tebet", name: "Tebet, South Jakarta", count: 18, latitude: -6.2297, longitude: 106.8529, profile: "personalCare" },
  { slug: "kelapa-gading", name: "Kelapa Gading, North Jakarta", count: 16, latitude: -6.1575, longitude: 106.9081, profile: "household" },
  { slug: "ancol", name: "Ancol & Pademangan, North Jakarta", count: 14, latitude: -6.1228, longitude: 106.843, profile: "pet" },
  { slug: "jatinegara", name: "Jatinegara, East Jakarta", count: 14, latitude: -6.2148, longitude: 106.8708, profile: "other" },
  { slug: "cengkareng", name: "Cengkareng, West Jakarta", count: 12, latitude: -6.1426, longitude: 106.7289, profile: "paper" },
  { slug: "senayan", name: "Senayan, Central Jakarta", count: 12, latitude: -6.2252, longitude: 106.8032, profile: "pet" },
  { slug: "setiabudi", name: "Setiabudi, South Jakarta", count: 12, latitude: -6.2141, longitude: 106.8296, profile: "cup" },
  { slug: "kuningan", name: "Kuningan, South Jakarta", count: 12, latitude: -6.2258, longitude: 106.8307, profile: "can" },
  { slug: "menteng", name: "Menteng, Central Jakarta", count: 12, latitude: -6.195, longitude: 106.8323, profile: "pet" },
  { slug: "sawah-besar", name: "Sawah Besar, Central Jakarta", count: 12, latitude: -6.1528, longitude: 106.8326, profile: "flexible" },
  { slug: "grogol", name: "Grogol Petamburan, West Jakarta", count: 12, latitude: -6.1673, longitude: 106.7909, profile: "household" },
  { slug: "palmerah", name: "Palmerah, West Jakarta", count: 12, latitude: -6.2043, longitude: 106.7957, profile: "pet" },
  { slug: "slipi", name: "Slipi, West Jakarta", count: 12, latitude: -6.1903, longitude: 106.7985, profile: "can" },
  { slug: "kembangan", name: "Kembangan, West Jakarta", count: 12, latitude: -6.1895, longitude: 106.7404, profile: "household" },
  { slug: "kalideres", name: "Kalideres, West Jakarta", count: 12, latitude: -6.1464, longitude: 106.7084, profile: "other" },
  { slug: "pluit", name: "Pluit, North Jakarta", count: 12, latitude: -6.1213, longitude: 106.7897, profile: "can" },
  { slug: "sunter", name: "Sunter, North Jakarta", count: 12, latitude: -6.1507, longitude: 106.8664, profile: "cup" },
  { slug: "tanjung-priok", name: "Tanjung Priok, North Jakarta", count: 12, latitude: -6.1175, longitude: 106.8831, profile: "flexible" },
  { slug: "cilincing", name: "Cilincing, North Jakarta", count: 12, latitude: -6.1162, longitude: 106.9465, profile: "other" },
  { slug: "rawamangun", name: "Rawamangun, East Jakarta", count: 12, latitude: -6.1976, longitude: 106.8866, profile: "personalCare" },
  { slug: "matraman", name: "Matraman, East Jakarta", count: 12, latitude: -6.1994, longitude: 106.8571, profile: "flexible" },
  { slug: "duren-sawit", name: "Duren Sawit, East Jakarta", count: 12, latitude: -6.2329, longitude: 106.9163, profile: "personalCare" },
  { slug: "cakung", name: "Cakung, East Jakarta", count: 12, latitude: -6.1798, longitude: 106.9389, profile: "household" },
  { slug: "pasar-minggu", name: "Pasar Minggu, South Jakarta", count: 12, latitude: -6.2849, longitude: 106.8427, profile: "pet" },
  { slug: "cilandak", name: "Cilandak, South Jakarta", count: 12, latitude: -6.2871, longitude: 106.8018, profile: "can" },
  { slug: "jagakarsa", name: "Jagakarsa, South Jakarta", count: 12, latitude: -6.3329, longitude: 106.8263, profile: "flexible" },
  { slug: "pancoran", name: "Pancoran, South Jakarta", count: 12, latitude: -6.2443, longitude: 106.8426, profile: "cup" },
  { slug: "pesanggrahan", name: "Pesanggrahan, South Jakarta", count: 12, latitude: -6.2518, longitude: 106.7594, profile: "personalCare" },
  { slug: "kebayoran-lama", name: "Kebayoran Lama, South Jakarta", count: 12, latitude: -6.2371, longitude: 106.7723, profile: "household" },
  { slug: "ciracas", name: "Ciracas, East Jakarta", count: 12, latitude: -6.3271, longitude: 106.8702, profile: "other" }
];

const beverageBrands = ["AQUA", "Le Minerale", "Coca-Cola", "Teh Pucuk", "Unknown"];
const snackBrands = ["Chitato", "Indomie", "Roma", "Unknown", "Unknown"];

function confidence(index: number, offset = 0) {
  return Math.min(0.96, 0.72 + ((index * 7 + offset * 5) % 23) / 100);
}

function profileItems(profile: Profile, index: number): SeedItem[] {
  const beverageBrand = beverageBrands[index % beverageBrands.length];
  const secondBeverageBrand = beverageBrands[(index + 2) % beverageBrands.length];
  const snackBrand = snackBrands[index % snackBrands.length];
  const wrapper: SeedItem = { brand: snackBrand, category: "Snack", packagingType: "Wrapper", likelyMaterial: "Flexible Plastic", confidence: confidence(index, 1) };
  const bottle = (brand: string, offset: number): SeedItem => ({ brand, category: "Beverage", packagingType: "Bottle", likelyMaterial: "PET Plastic", confidence: confidence(index, offset) });
  const aluminiumCan = (brand: string, offset: number): SeedItem => ({ brand, category: "Beverage", packagingType: "Can", likelyMaterial: "Aluminium", confidence: confidence(index, offset) });

  if (profile === "pet") {
    return [bottle(beverageBrand, 0), bottle(secondBeverageBrand, 2), ...(index % 2 === 0 ? [wrapper] : [])];
  }
  if (profile === "flexible") {
    const sachet: SeedItem = { brand: snackBrand, category: "Instant Food", packagingType: "Sachet", likelyMaterial: "Multilayer Plastic", confidence: confidence(index, 2) };
    return [wrapper, sachet, ...(index % 3 === 0 ? [{ ...wrapper, brand: "Unknown" }] : [])];
  }
  if (profile === "can") {
    return [aluminiumCan(beverageBrand, 0), aluminiumCan(secondBeverageBrand, 2), ...(index % 3 === 0 ? [bottle("Unknown", 3)] : [])];
  }
  if (profile === "cup") {
    const cup: SeedItem = { brand: beverageBrand, category: "Beverage", packagingType: "Cup", likelyMaterial: "PP Plastic", confidence: confidence(index, 1) };
    return [cup, { ...cup, brand: "Unknown" }, ...(index % 4 === 0 ? [bottle(secondBeverageBrand, 3)] : [])];
  }
  if (profile === "paper") {
    const carton: SeedItem = { brand: beverageBrand, category: "Beverage", packagingType: "Carton", likelyMaterial: "Paper/Cardboard", confidence: confidence(index, 1) };
    const bag: SeedItem = { brand: "Unknown", category: "Food", packagingType: "Bag", likelyMaterial: "Paper/Cardboard", confidence: confidence(index, 2) };
    return [carton, bag, ...(index % 3 === 0 ? [wrapper] : [])];
  }
  if (profile === "personalCare") {
    const shampooBottle: SeedItem = { brand: index % 2 ? "Pantene" : "Lifebuoy", category: "Personal Care", packagingType: "Bottle", likelyMaterial: "HDPE Plastic", confidence: confidence(index, 1) };
    const shampooSachet: SeedItem = { brand: index % 2 ? "Sunsilk" : "Clear", category: "Personal Care", packagingType: "Sachet", likelyMaterial: "Multilayer Plastic", confidence: confidence(index, 2) };
    return [shampooBottle, shampooSachet, ...(index % 3 === 0 ? [{ ...shampooSachet, brand: "Unknown" }] : [])];
  }
  if (profile === "household") {
    const detergentSachet: SeedItem = { brand: index % 2 ? "Rinso" : "Molto", category: "Household", packagingType: "Sachet", likelyMaterial: "Multilayer Plastic", confidence: confidence(index, 1) };
    const cleanerBottle: SeedItem = { brand: index % 2 ? "Sunlight" : "Wipol", category: "Household", packagingType: "Bottle", likelyMaterial: "HDPE Plastic", confidence: confidence(index, 2) };
    const householdBag: SeedItem = { brand: "Unknown", category: "Household", packagingType: "Bag", likelyMaterial: "Flexible Plastic", confidence: confidence(index, 3) };
    return [detergentSachet, cleanerBottle, ...(index % 2 === 0 ? [householdBag] : [])];
  }
  if (profile === "other") {
    const unknownBag: SeedItem = { brand: "Unknown", category: "Other", packagingType: "Bag", likelyMaterial: "Flexible Plastic", confidence: confidence(index, 1) };
    const fragment: SeedItem = { brand: "Unknown", category: "Other", packagingType: "Other", likelyMaterial: "Unknown", confidence: confidence(index, 2) };
    return [unknownBag, fragment, ...(index % 2 === 0 ? [wrapper] : [])];
  }
  return [
    bottle(beverageBrand, 0),
    wrapper,
    index % 2 === 0
      ? aluminiumCan(secondBeverageBrand, 2)
      : { brand: "Unknown", category: "Beverage", packagingType: "Cup", likelyMaterial: "PP Plastic", confidence: confidence(index, 3) }
  ];
}

function makeAreaReports(area: SeedArea, areaIndex: number): WasteReport[] {
  return Array.from({ length: area.count }, (_, index) => {
    // Scatter markers across each neighbourhood (about +/- 1 km) while retaining its named area group.
    const latitudeOffset = (((index * 7 + areaIndex) % 31) - 15) * 0.00065;
    const longitudeOffset = (((index * 11 + areaIndex * 2) % 31) - 15) * 0.00065;
    const id = `demo-${area.slug}-${String(index + 1).padStart(3, "0")}`;
    const items = profileItems(area.profile, index + areaIndex * 17);
    return {
      id,
      createdAt: new Date(Date.now() - (index + areaIndex * 9 + 1) * 60 * 60 * 1000).toISOString(),
      latitude: area.latitude + latitudeOffset,
      longitude: area.longitude + longitudeOffset,
      locationName: area.name,
      source: "demo",
      // Ten deliberately pending records make the reviewer workflow visible
      // without allowing them to influence intelligence before approval.
      reviewStatus: areaIndex < 10 && index === 0 ? undefined : "approved",
      items: items.map((item, itemIndex) => ({ ...item, id: `${id}-item-${itemIndex + 1}` }))
    };
  });
}

export const seedReports: WasteReport[] = areas.flatMap(makeAreaReports);
