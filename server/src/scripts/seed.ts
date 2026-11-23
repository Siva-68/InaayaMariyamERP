import mongoose from 'mongoose';
import argon2 from 'argon2';
import { User } from '../models/User';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/hinaya_mariyam_erp';

async function seed() {
  console.log('Connecting to MongoDB at:', MONGODB_URI);
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // 1. Seed or update demo user
  const demoEmail = 'sivaprakashs127@gmail.com';
  const demoPass = 'Siva_6805';
  const passwordHash = await argon2.hash(demoPass);

  let user = await User.findOne({ email: demoEmail });
  if (user) {
    user.passwordHash = passwordHash;
    user.role = 'admin';
    user.isActive = true;
    user.name = 'Siva Prakash (Owner)';
    await user.save();
    console.log(`[SEED] Updated existing admin user: ${demoEmail}`);
  } else {
    user = await User.create({
      name: 'Siva Prakash (Owner)',
      email: demoEmail,
      passwordHash,
      role: 'admin',
      isActive: true,
    });
    console.log(`[SEED] Created new admin user: ${demoEmail}`);
  }

  // 2. Seed initial catalogue products with confirmed test GST rate
  const initialProducts = [
    {
      name: 'Kaju Burfi 250g',
      category: 'Sweets & Burfi',
      sapCode: 'KB-250',
      packType: 'packet',
      netWeight: '250g',
      unitsPerCarton: 20,
      purchasePrice: mongoose.Types.Decimal128.fromString('180.00'),
      sellingPrice: mongoose.Types.Decimal128.fromString('240.00'),
      mrp: mongoose.Types.Decimal128.fromString('250.00'),
      gstRate: 5, // 5% GST for packaged sweets
      stock: 45,
      lowStockThreshold: 10,
      isActive: true,
    },
    {
      name: 'Milk Peda 250g',
      category: 'Sweets & Burfi',
      sapCode: 'MP-250',
      packType: 'packet',
      netWeight: '250g',
      unitsPerCarton: 24,
      purchasePrice: mongoose.Types.Decimal128.fromString('120.00'),
      sellingPrice: mongoose.Types.Decimal128.fromString('160.00'),
      mrp: mongoose.Types.Decimal128.fromString('170.00'),
      gstRate: 5,
      stock: 30,
      lowStockThreshold: 8,
      isActive: true,
    },
    {
      name: 'Special Mixture 200g',
      category: 'Snacks & Savouries',
      sapCode: 'MIX-200',
      packType: 'packet',
      netWeight: '200g',
      unitsPerCarton: 40,
      purchasePrice: mongoose.Types.Decimal128.fromString('45.00'),
      sellingPrice: mongoose.Types.Decimal128.fromString('65.00'),
      mrp: mongoose.Types.Decimal128.fromString('70.00'),
      gstRate: 5,
      stock: 80,
      lowStockThreshold: 15,
      isActive: true,
    },
    {
      name: 'Butter Murukku 200g',
      category: 'Snacks & Savouries',
      sapCode: 'MUR-200',
      packType: 'packet',
      netWeight: '200g',
      unitsPerCarton: 30,
      purchasePrice: mongoose.Types.Decimal128.fromString('40.00'),
      sellingPrice: mongoose.Types.Decimal128.fromString('60.00'),
      mrp: mongoose.Types.Decimal128.fromString('65.00'),
      gstRate: 5,
      stock: 50,
      lowStockThreshold: 12,
      isActive: true,
    },
    {
      name: 'Sesame Chikki / Ellu Urundai 150g',
      category: 'Balls & Chikki',
      sapCode: 'CHK-150',
      packType: 'packet',
      netWeight: '150g',
      unitsPerCarton: 50,
      purchasePrice: mongoose.Types.Decimal128.fromString('28.00'),
      sellingPrice: mongoose.Types.Decimal128.fromString('45.00'),
      mrp: mongoose.Types.Decimal128.fromString('50.00'),
      gstRate: 5,
      stock: 6, // Low stock on purpose to test alerts!
      lowStockThreshold: 10,
      isActive: true,
    },
    {
      name: 'Cashew Balls 200g',
      category: 'Balls & Chikki',
      sapCode: 'CB-200',
      packType: 'packet',
      netWeight: '200g',
      unitsPerCarton: 24,
      purchasePrice: mongoose.Types.Decimal128.fromString('110.00'),
      sellingPrice: mongoose.Types.Decimal128.fromString('150.00'),
      mrp: mongoose.Types.Decimal128.fromString('160.00'),
      gstRate: 5,
      stock: 25,
      lowStockThreshold: 8,
      isActive: true,
    },
  ];

  for (const prod of initialProducts) {
    const existing = await Product.findOne({ name: prod.name, category: prod.category });
    if (!existing) {
      await Product.create({ ...prod, createdBy: user._id });
      console.log(`[SEED] Created product: ${prod.name}`);
    } else {
      console.log(`[SEED] Product already exists: ${prod.name}`);
    }
  }

  console.log('\n✅ Seed completed successfully!');
  await mongoose.connection.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
