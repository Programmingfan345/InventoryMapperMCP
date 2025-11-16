const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8081;

app.use(cors());
app.use(express.json());

// ----------------------------
// Mock data
// ----------------------------

const PRODUCTS = [
  {
    sku: "SKU-0001",
    upc: "0004900001234",
    name: "Modelo 12pk",
    category: "Beer"
  },
  {
    sku: "SKU-0002",
    upc: "0001112223334",
    name: "Coke 12oz Can",
    category: "Drinks"
  },
  {
    sku: "SKU-0003",
    upc: "0009998887776",
    name: "Doritos Nacho 8oz",
    category: "Snacks"
  }
];

const LOCATIONS = [
  // FRONT
  {
    code: "FRONT:Drinks/AisleA/Bay1/Shelf2",
    kind: "FRONT",
    zone: "Drinks",
    aisle: "AisleA",
    bay: "Bay1",
    shelf: "Shelf2",
    bin: null
  },
  {
    code: "FRONT:Snacks/AisleC/Bay3/Shelf1",
    kind: "FRONT",
    zone: "Snacks",
    aisle: "AisleC",
    bay: "Bay3",
    shelf: "Shelf1",
    bin: null
  },
  {
    code: "FRONT:Liquor/AisleE/Whiskey/Shelf1",
    kind: "FRONT",
    zone: "Liquor",
    aisle: "AisleE",
    bay: "Whiskey",
    shelf: "Shelf1",
    bin: null
  },

  // BACK
  {
    code: "BACK:Beer/Bay4/Shelf2/BinB",
    kind: "BACK",
    zone: "Beer",
    aisle: null,
    bay: "Bay4",
    shelf: "Shelf2",
    bin: "BinB"
  },
  {
    code: "BACK:Drinks/Bay1/Shelf1/BinA",
    kind: "BACK",
    zone: "Drinks",
    aisle: null,
    bay: "Bay1",
    shelf: "Shelf1",
    bin: "BinA"
  },
  {
    code: "BACK:Snacks/Bay3/Shelf2/BinC",
    kind: "BACK",
    zone: "Snacks",
    aisle: null,
    bay: "Bay3",
    shelf: "Shelf2",
    bin: "BinC"
  }
];

// Each mapping connects a product to a front + back location
const MAPPINGS = [
  {
    product_sku: "SKU-0001", // Modelo
    front_location_code: "FRONT:Liquor/AisleE/Whiskey/Shelf1",
    back_location_code: "BACK:Beer/Bay4/Shelf2/BinB"
  },
  {
    product_sku: "SKU-0002", // Coke
    front_location_code: "FRONT:Drinks/AisleA/Bay1/Shelf2",
    back_location_code: "BACK:Drinks/Bay1/Shelf1/BinA"
  },
  {
    product_sku: "SKU-0003", // Doritos
    front_location_code: "FRONT:Snacks/AisleC/Bay3/Shelf1",
    back_location_code: "BACK:Snacks/Bay3/Shelf2/BinC"
  }
];

// ----------------------------
// Helper functions
// ----------------------------

function findProductBy(field, value) {
  const lower = String(value).toLowerCase();
  return PRODUCTS.find(p => {
    if (field === "name") return p.name.toLowerCase().includes(lower);
    if (field === "sku") return p.sku === value;
    if (field === "upc") return p.upc === value;
    return false;
  });
}

function findLocationsForProduct(sku) {
  const front = [];
  const back = [];
  for (const m of MAPPINGS) {
    if (m.product_sku === sku) {
      const f = LOCATIONS.find(l => l.code === m.front_location_code);
      const b = LOCATIONS.find(l => l.code === m.back_location_code);
      if (f) front.push(f);
      if (b) back.push(b);
    }
  }
  return { front, back };
}

function findLocationByCode(code) {
  return LOCATIONS.find(l => l.code === code);
}

function getMappingForProduct(sku) {
  return MAPPINGS.find(m => m.product_sku === sku);
}

// ----------------------------
// Health check
// ----------------------------

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ----------------------------
// Tool: find_product
// ----------------------------

app.post("/tools/find_product", (req, res) => {
  const { query, by } = req.body || {};
  if (!query || !by) {
    return res.status(400).json({ error: "Missing 'query' or 'by' in body" });
  }

  const product = findProductBy(by, query);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const { front, back } = findLocationsForProduct(product.sku);

  return res.json({
    product,
    front_locations: front,
    back_locations: back,
    category: product.category
  });
});

// ----------------------------
// Tool: scan_barcode
// ----------------------------

app.post("/tools/scan_barcode", (req, res) => {
  const { barcode } = req.body || {};
  if (!barcode) {
    return res.status(400).json({ error: "Missing 'barcode' in body" });
  }

  const product = findProductBy("upc", barcode);
  if (!product) {
    return res.status(404).json({ error: "Product with this barcode not found" });
  }

  const mapping = getMappingForProduct(product.sku);
  const suggestedBackLocation = mapping
    ? findLocationByCode(mapping.back_location_code)
    : null;

  let isValidCategory = false;
  let message = null;

  if (suggestedBackLocation) {
    if (
      suggestedBackLocation.zone &&
      suggestedBackLocation.zone.toLowerCase().includes(product.category.toLowerCase())
    ) {
      isValidCategory = true;
    } else {
      message = `Category mismatch: product=${product.category}, back zone=${suggestedBackLocation.zone}`;
    }
  } else {
    message = "No back location mapping found for this product";
  }

  return res.json({
    product,
    suggested_back_location: suggestedBackLocation,
    is_valid_category: isValidCategory,
    message
  });
});

// ----------------------------
// Tool: update_location
// ----------------------------

app.post("/tools/update_location", (req, res) => {
  const { sku, front_location_code, back_location_code } = req.body || {};

  if (!sku) {
    return res.status(400).json({ error: "Missing 'sku' in body" });
  }

  const product = findProductBy("sku", sku);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  let mapping = getMappingForProduct(product.sku);
  if (!mapping) {
    // create new mapping with some defaults if none exist
    mapping = {
      product_sku: product.sku,
      front_location_code: front_location_code || LOCATIONS.find(l => l.kind === "FRONT")?.code,
      back_location_code: back_location_code || LOCATIONS.find(l => l.kind === "BACK")?.code
    };
    MAPPINGS.push(mapping);
  }

  if (front_location_code) {
    const frontLoc = findLocationByCode(front_location_code);
    if (!frontLoc || frontLoc.kind !== "FRONT") {
      return res.status(400).json({ error: "Invalid front_location_code" });
    }
    mapping.front_location_code = front_location_code;
  }

  if (back_location_code) {
    const backLoc = findLocationByCode(back_location_code);
    if (!backLoc || backLoc.kind !== "BACK") {
      return res.status(400).json({ error: "Invalid back_location_code" });
    }
    mapping.back_location_code = back_location_code;
  }

  const finalFront = findLocationByCode(mapping.front_location_code);
  const finalBack = findLocationByCode(mapping.back_location_code);

  return res.json({
    ok: true,
    product_sku: product.sku,
    front_location: finalFront,
    back_location: finalBack,
    message: "Location(s) updated in mapping"
  });
});

// ----------------------------
// Tool: validate_category_map
// ----------------------------

app.post("/tools/validate_category_map", (req, res) => {
  const { sku, candidate_back_location_code } = req.body || {};
  if (!sku || !candidate_back_location_code) {
    return res
      .status(400)
      .json({ error: "Missing 'sku' or 'candidate_back_location_code' in body" });
  }

  const product = findProductBy("sku", sku);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const loc = findLocationByCode(candidate_back_location_code);
  if (!loc || loc.kind !== "BACK") {
    return res.status(400).json({ error: "Invalid back location code" });
  }

  let valid = false;
  let reason = null;

  if (loc.zone && loc.zone.toLowerCase().includes(product.category.toLowerCase())) {
    valid = true;
  } else {
    valid = false;
    reason = `Category mismatch: product=${product.category}, zone=${loc.zone}`;
  }

  return res.json({
    valid,
    product_category: product.category,
    location_zone: loc.zone,
    reason
  });
});

// ----------------------------

app.listen(PORT, () => {
  console.log(`Inventory Mapper MCP server running on port ${PORT}`);
});
