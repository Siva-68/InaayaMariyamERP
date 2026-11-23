/**
 * Catalogue Import Tool for HINAYA MARIYAM ERP
 *
 * Reads source PDFs from `docs/catalogues/`, parses items, normalizes fields,
 * flags duplicates and pricing conflicts, and writes reviewable preview files.
 *
 * Usage:
 *   npx ts-node scripts/import-catalogue.ts [--confirm]
 */

import fs from 'node:fs';
import path from 'node:path';
import pdf from 'pdf-parse';

export interface RawParsedItem {
  sourceFile: string;
  serialNumber?: string;
  name: string;
  category: string;
  sapCode?: string;
  barcode?: string;
  packType: string;
  netWeight?: string;
  piecesPerPack?: number;
  unitsPerCarton?: number;
  purchasePrice?: string;
  sellingPrice?: string;
  mrp?: string;
  gstRate: null; // strictly null until confirmed by accountant
  notes?: string;
  status: 'valid' | 'conflict' | 'ambiguous';
  flags: string[];
}

const CATALOGUES_DIR = path.resolve(__dirname, '../docs/catalogues');

const SOURCE_FILES = [
  'DEPARTMENT SRORE PRODUCT LIST.pdf',
  'NEW MRP UPDATED DEALER PRICE LIST -2026.pdf',
  'Premium SM Product List.pdf',
  'Retail Product List.pdf',
];

async function parsePdfCatalogue(filePath: string, filename: string): Promise<RawParsedItem[]> {
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] Catalogue file missing: ${filename}`);
    return [];
  }

  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const text = pdfData.text;

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const items: RawParsedItem[] = [];

  // Determine category bias from filename
  let defaultCategory = 'Packaged Snacks';
  if (filename.includes('Premium')) defaultCategory = 'Premium Sweets';
  if (filename.includes('DEPARTMENT')) defaultCategory = 'General Grocery';
  if (filename.includes('Retail')) defaultCategory = 'Retail Confectionery';

  for (const line of lines) {
    // Match lines starting with a number (Serial number pattern: "1. Kaju Burfi 250g ...")
    const match = line.match(/^(\d+)[.\s-]+([A-Za-z0-9\s/&()\-–+]+?)(\s+\d+.*)?$/);
    if (match) {
      const serialNumber = match[1];
      const rawName = match[2].trim();
      const rest = (match[3] || '').trim();

      if (rawName.length < 3) continue;

      // Extract price-like numbers (e.g., 120.00, 150)
      const prices = rest.match(/\b\d+(\.\d{2})?\b/g) || [];
      const flags: string[] = [];

      let purchasePrice: string | undefined = undefined;
      let sellingPrice: string | undefined = undefined;
      let mrp: string | undefined = undefined;

      if (prices.length >= 2) {
        purchasePrice = prices[0];
        sellingPrice = prices[1];
        if (prices.length >= 3) {
          mrp = prices[2];
        }
      } else if (prices.length === 1) {
        sellingPrice = prices[0];
        flags.push('Missing purchase price / dealer price');
      } else {
        flags.push('No explicit price extracted — requires manual review');
      }

      // Check for carton conversion hints (e.g., "50 pcs", "24 pkts")
      let unitsPerCarton = 1;
      const cartonMatch = line.match(/(\d+)\s*(pcs|pkts|packets|pieces|units)/i);
      if (cartonMatch) {
        unitsPerCarton = parseInt(cartonMatch[1], 10);
      }

      // Extract net weight (e.g., "250g", "500gm", "1kg")
      const weightMatch = rawName.match(/(\d+\s*(?:g|gm|kg|ml|l)\b)/i);
      const netWeight = weightMatch ? weightMatch[1] : undefined;

      items.push({
        sourceFile: filename,
        serialNumber,
        name: rawName,
        category: defaultCategory,
        packType: 'packet',
        netWeight,
        unitsPerCarton,
        purchasePrice,
        sellingPrice,
        mrp,
        gstRate: null, // As per invariants: never infer GST rates from catalog percentages
        status: flags.length > 0 ? 'ambiguous' : 'valid',
        flags,
      });
    }
  }

  return items;
}

export async function runCatalogueImport(options: { dryRun?: boolean } = {}) {
  console.log('=== HINAYA MARIYAM Catalogue Extraction Tool ===\n');

  const allItems: RawParsedItem[] = [];

  for (const filename of SOURCE_FILES) {
    const fullPath = path.join(CATALOGUES_DIR, filename);
    console.log(`Processing: ${filename}...`);
    const parsed = await parsePdfCatalogue(fullPath, filename);
    console.log(`  -> Found ${parsed.length} candidate rows`);
    allItems.push(...parsed);
  }

  // Deduplicate and check conflicts
  const nameMap = new Map<string, RawParsedItem[]>();
  for (const item of allItems) {
    const normalized = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const list = nameMap.get(normalized) || [];
    list.push(item);
    nameMap.set(normalized, list);
  }

  const consolidatedItems: RawParsedItem[] = [];
  let conflictCount = 0;

  for (const [, entries] of nameMap.entries()) {
    if (entries.length === 1) {
      consolidatedItems.push(entries[0]);
    } else {
      // Conflict: same item in multiple catalogues with potentially different prices
      conflictCount++;
      const primary = { ...entries[0] };
      const otherSources = entries.map((e) => `${e.sourceFile} (Price: ${e.sellingPrice || 'N/A'})`).join('; ');
      primary.status = 'conflict';
      primary.flags.push(`Appears in multiple catalogues with conflicting details: ${otherSources}`);
      consolidatedItems.push(primary);
    }
  }

  console.log(`\nConsolidated items: ${consolidatedItems.length}`);
  console.log(`Conflicts / Ambiguities flagged: ${conflictCount}`);

  // Write preview JSON
  const previewJsonPath = path.join(CATALOGUES_DIR, 'import-preview.json');
  fs.writeFileSync(previewJsonPath, JSON.stringify(consolidatedItems, null, 2), 'utf-8');
  console.log(`Wrote JSON preview to: ${previewJsonPath}`);

  // Write preview CSV
  const csvHeaders = 'Source,S.No,Name,Category,Weight,UnitsPerCarton,PurchasePrice,SellingPrice,MRP,GSTRate,Status,Flags\n';
  const csvRows = consolidatedItems
    .map(
      (i) =>
        `"${i.sourceFile}","${i.serialNumber || ''}","${i.name.replace(/"/g, '""')}","${i.category}","${
          i.netWeight || ''
        }",${i.unitsPerCarton || 1},"${i.purchasePrice || ''}","${i.sellingPrice || ''}","${i.mrp || ''}","null","${
          i.status
        }","${i.flags.join('; ').replace(/"/g, '""')}"`
    )
    .join('\n');

  const previewCsvPath = path.join(CATALOGUES_DIR, 'import-preview.csv');
  fs.writeFileSync(previewCsvPath, csvHeaders + csvRows, 'utf-8');
  console.log(`Wrote CSV preview to: ${previewCsvPath}`);

  console.log('\n[INFO] Preview generated. GST rates have been strictly kept as null.');
  console.log('[INFO] A business administrator/accountant must review import-preview.csv before activating products.');
}

if (require.main === module) {
  runCatalogueImport().catch(console.error);
}
