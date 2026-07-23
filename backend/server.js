import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { Sequelize, DataTypes, Op } from 'sequelize';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// ==========================================
// 0. SYSTEM INITIALIZATION & PATHS
// ==========================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_RICE_GRAIN_STORE_KEY_2026';

console.log('🚀 Initializing Premium Rice & Grain E-Commerce Backend...');
console.log('DEBUG: Booting unified agricultural & hardware architecture...');

// ==========================================
// 1. OFFLINE & ONLINE UPLOAD DIRECTORY CONFIGURATION (MULTER)
// ==========================================
const uploadDir = path.join(__dirname, 'public', 'uploads');
const imagesDir = path.join(__dirname, 'public', 'images');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('DEBUG: Created missing upload directory at', uploadDir);
}

if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
  console.log('DEBUG: Created missing images directory at', imagesDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage });

// ==========================================
// 2. DATABASE SCHEMAS & MODELS
// ==========================================
import { 
  User, 
  RiceProduct, 
  Order, 
  Review, 
  AdminLog, 
  SystemConfig, 
  sequelize 
} from './lib/db.js';

// ==========================================
// 3. LIVE FLASH HARVEST SALE ENGINE UTILS
// ==========================================
let flashSaleState = {
  active: false,
  endTime: null,
  countdownIntervalId: null
};

function initializeFlashSaleEngine(io) {
  SystemConfig.findOne({ where: { key: 'black_friday' } }).then((config) => {
    if (config && config.value && config.value.active) {
      const remainingTime = new Date(config.value.endTime).getTime() - Date.now();
      if (remainingTime > 0) {
        flashSaleState.active = true;
        flashSaleState.endTime = config.value.endTime;
        startFlashSaleCountdown(io);
        console.log(`🔥 Flash Harvest Sale Engine Restored! Active until: ${flashSaleState.endTime}`);
      } else {
        config.value = { ...config.value, active: false };
        config.changed('value', true);
        config.save();
      }
    }
  }).catch(err => console.error('❌ Failed to boot Flash Sale Engine state:', err));
}

function startFlashSaleCountdown(io) {
  if (flashSaleState.countdownIntervalId) clearInterval(flashSaleState.countdownIntervalId);
  
  flashSaleState.countdownIntervalId = setInterval(() => {
    const totalRemaining = new Date(flashSaleState.endTime).getTime() - Date.now();
    if (totalRemaining <= 0) {
      clearInterval(flashSaleState.countdownIntervalId);
      flashSaleState.active = false;
      flashSaleState.endTime = null;
      io.emit('blackFridayEnded', { active: false });
      
      SystemConfig.findOne({ where: { key: 'black_friday' } }).then(config => {
        if (config) {
          config.value = { ...config.value, active: false };
          config.changed('value', true);
          config.save();
        }
      });
      console.log('🏁 Flash Harvest Sale structural window has closed.');
    } else {
      io.emit('blackFridayTick', {
        active: true,
        endTime: flashSaleState.endTime,
        msRemaining: totalRemaining
      });
    }
  }, 1000);
}

// ==========================================
// 4. MIDDLEWARES
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.log('DEBUG: Auth failed - Missing token');
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
    if (err) {
      console.log('DEBUG: Auth failed - Invalid token');
      return res.status(403).json({ error: 'Token invalid or expired' });
    }
    req.user = decodedUser;
    next();
  });
};

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication details missing' });
    }
    const userInstance = await User.findByPk(req.user.id);
    if (!userInstance || userInstance.role !== 'admin') {
      console.log(`DEBUG: Admin clearance rejected for user ID: ${req.user.id}`);
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }
    if (!userInstance.isActive) return res.status(403).json({ error: 'Admin account disabled' });
    req.adminUser = userInstance;
    next();
  } catch (error) {
    console.error('DEBUG: Role evaluation crash:', error);
    res.status(500).json({ error: 'Internal role evaluation crash' });
  }
};

// ==========================================
// 5. SERVER INITIALIZATION & DATABASE BOOTSTRAP
// ==========================================
async function startServer() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    
    const currentMode = process.env.DB_MODE === 'cloud' ? '☁️ AIVEN CLOUD' : '🏠 LOCAL';
    console.log(`🍃 Database Connected Successfully! Mode: [ ${currentMode} ]`);

    const expressApp = express();
    const server = createServer(expressApp);

    const corsOptions = {
      origin: (origin, callback) => {
        if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin.endsWith('.onrender.com')) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true
    };
    
    expressApp.use(cors(corsOptions));
    expressApp.use(express.json({ limit: '50mb' }));
    expressApp.use(express.urlencoded({ limit: '50mb', extended: true }));

    expressApp.use(express.static(path.join(__dirname, 'public')));
    expressApp.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
    expressApp.use('/images', express.static(path.join(__dirname, 'public', 'images')));

    await SystemConfig.findOrCreate({ where: { key: 'transport_fee' }, defaults: { value: 250 } });
    await SystemConfig.findOrCreate({ where: { key: 'black_friday' }, defaults: { value: { active: false, endTime: null } } });
    
    // Seed M-Pesa Payment Details (Till & Paybill numbers)
    await SystemConfig.findOrCreate({
      where: { key: 'mpesa_config' },
      defaults: {
        value: {
          paybillNumber: '522522',
          paybillAccount: 'MWEARICE',
          tillNumber: '889900',
          stkEnabled: true
        }
      }
    });

    // Seed ALL 47 KENYAN COUNTIES with default transport shipping rates
    const all47Counties = {
      "Mombasa": 500, "Kwale": 550, "Kilifi": 550, "Tana River": 600, "Lamu": 650, 
      "Taita-Taveta": 550, "Garissa": 600, "Wajir": 700, "Mandera": 800, "Marsabit": 700, 
      "Isiolo": 500, "Meru": 350, "Tharaka-Nithi": 350, "Embu": 300, "Kitui": 400, 
      "Machakos": 300, "Makueni": 350, "Nyandarua": 300, "Nyeri": 300, "Kirinyaga": 200, 
      "Murang'a": 250, "Kiambu": 250, "Turkana": 800, "West Pokot": 600, "Samburu": 600, 
      "Trans-Nzoia": 500, "Uasin Gishu": 450, "Elgeyo-Marakwet": 500, "Nandi": 450, "Baringo": 500, 
      "Laikipia": 400, "Nakuru": 350, "Narok": 450, "Kajiado": 300, "Kericho": 450, 
      "Bomet": 450, "Kakamega": 500, "Vihiga": 500, "Bungoma": 500, "Busia": 550, 
      "Siaya": 500, "Kisumu": 450, "Homa Bay": 500, "Migori": 550, "Kisii": 450, 
      "Nyamira": 450, "Nairobi": 200
    };
    await SystemConfig.findOrCreate({ where: { key: 'county_overrides' }, defaults: { value: all47Counties } });

    // Seed Kenyan Cascading Logistics Hierarchy (Counties -> Towns -> Locations -> Sub-locations)
    const kenyaLogisticsHierarchy = {
      "Kirinyaga": {
        "Mwea": {
          "Wamumu": ["Wamumu Primary Area", "Paddy Field Block A", "Rice Mill Zone"],
          "Mutithi": ["Mutithi Center", "Kandongu Market", "Kiura Junction"]
        },
        "Kerugoya": {
          "Central": ["Hospital Road", "Town Plaza", "Stadium Area"],
          "Kaguyu": ["Kaguyu Market", "Upper Hill"]
        }
      },
      "Nairobi": {
        "Nairobi Central": {
          "CBD": ["Kenyatta Avenue", "Moi Avenue", "Haile Selassie Ave"],
          "Ngara": ["Ngara Market", "Chambers Road"]
        },
        "Westlands": {
          "Parklands": ["1st Parklands", "Limuru Road", "City Park"],
          "Kitisuru": ["Getathuru", "Nyari Estate"]
        },
        "Kasarani": {
          "Roysambu": ["TRM Drive", "Zimmerman", "Lumumba Drive"],
          "Ruaraka": ["Baba Dogo", "Utalii Area"]
        }
      },
      "Kiambu": {
        "Thika": {
          "Township": ["Commercial Street", "Section 9", "Gatuanyaga"],
          "Juja": ["JKUAT Gate A", "Highpoint", "Kalimoni"]
        },
        "Kiambu Town": {
          "Town Center": ["Indian Bazaar", "Kambui"],
          "Ndumberi": ["Ndumberi Market", "Kirigiti"]
        }
      },
      "Mombasa": {
        "Nyali": {
          "Mswambweni": ["Links Road", "Beach Way Drive"],
          "Kongowea": ["Kongowea Market Area", "Karama Road"]
        },
        "Mvita": {
          "CBD": ["Nkrumah Road", "Digo Road", "Treasury Square"]
        }
      },
      "Nakuru": {
        "Nakuru Town East": {
          "Freehold": ["Freehold Market", "Kenyatta Lane"],
          "Section 58": ["Hyrax Hill Area", "Phase 2"]
        }
      }
    };
    await SystemConfig.findOrCreate({ where: { key: 'logistics_hierarchy' }, defaults: { value: kenyaLogisticsHierarchy } });

    // Landing Page Hero Video / Backdrop Config with explicit Rotation Durations (Video: 5s, Pic: 3-4s)
    await SystemConfig.findOrCreate({
      where: { key: 'hero_settings' },
      defaults: {
        value: {
          type: 'video',
          url: 'https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI',
          title: 'Direct From Mwea Paddy Fields',
          subtitle: '100% Pure Aromatic Pishori Rice harvested and delivered straight to your doorstep.',
          videoDuration: 5,
          imageDuration: 4
        }
      }
    });

    // Homepage Carousel Media Feed with timing metadata
    await SystemConfig.findOrCreate({
      where: { key: 'homepage_carousel' },
      defaults: {
        value: [
          { 
            id: "1", 
            type: 'video', 
            url: 'https://www.youtube.com/embed/gjZAThNHGwI?start=6&autoplay=1&mute=1&loop=1&playlist=gjZAThNHGwI', 
            title: 'Mwea Paddy Harvest Live', 
            subtitle: 'Direct from rich Kenyan soil into your kitchen.',
            duration: 5
          },
          { 
            id: "2", 
            type: 'image', 
            url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1200&q=80', 
            title: 'Pure Mwea Pishori Grade 1', 
            subtitle: 'Unmatched aroma and long-grain perfection.',
            duration: 4
          },
          { 
            id: "3", 
            type: 'image', 
            url: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=1200&q=80', 
            title: 'Wholesale & Bulk Sack Delivery', 
            subtitle: 'Available in 5kg, 10kg, 25kg, and 50kg sacks with discounted transport.',
            duration: 3
          },
          { 
            id: "4", 
            type: 'image', 
            url: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=1200&q=80', 
            title: 'Premium Imported Basmati', 
            subtitle: 'Aged to perfection for fluffy, non-sticky ceremonial cooking.',
            duration: 4
          }
        ]
      }
    });

    // Ensure 4 Featured Grain Products exist in Catalog
    const existingFeaturedCount = await RiceProduct.count();
    if (existingFeaturedCount === 0) {
      await RiceProduct.bulkCreate([
        {
          brandName: 'Pure Mwea Pishori Grade 1',
          variety: 'Aromatic Pishori',
          weightKg: 5,
          basePrice: 1250,
          flashSalePrice: 1100,
          stockQuantity: 150,
          imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
          isAvailable: true
        },
        {
          brandName: 'Super Aromatic Basmati',
          variety: 'Long Grain Basmati',
          weightKg: 10,
          basePrice: 2400,
          flashSalePrice: 2150,
          stockQuantity: 80,
          imageUrl: 'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?auto=format&fit=crop&w=800&q=80',
          isAvailable: true
        },
        {
          brandName: 'Biryani Special Feast Grain',
          variety: 'Kaisari Long Grain',
          weightKg: 25,
          basePrice: 5200,
          flashSalePrice: 4800,
          stockQuantity: 40,
          imageUrl: 'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=800&q=80',
          isAvailable: true
        },
        {
          brandName: 'Whole Grain Brown Pishori',
          variety: 'Brown Nutritious Rice',
          weightKg: 5,
          basePrice: 1400,
          flashSalePrice: 1250,
          stockQuantity: 60,
          imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80',
          isAvailable: true
        }
      ]);
      console.log('🌾 Seeded default 4 Featured Grain selection products into catalog.');
    }

    // Google Sync Endpoint
    expressApp.post('/api/sync/google', async (req, res) => {
      const { googleId, fullName, email } = req.body || {};
      
      if (!googleId) {
        console.error("DEBUG: google-sync received an empty payload");
        return res.status(400).json({ error: "Missing identity credentials" });
      }

      try {
        let user = await User.findOne({ where: { googleId } });
        if (!user) {
          user = await User.create({ 
            googleId, 
            fullName: fullName || 'Google User', 
            email, 
            role: 'user',
            isActive: true
          });
          console.log(`✨ Created fresh database profile for Google user: ${fullName}`);
        } else {
          console.log(`🔐 Verified existing database profile for Google user: ${fullName}`);
        }
        res.status(200).json({ message: "User synced", user });
      } catch (error) {
        console.error("Database Sync Error:", error);
        res.status(500).json({ error: "DB Sync Failed" });
      }
    });

    const io = new SocketIOServer(server, { 
      cors: corsOptions
    });

    initializeFlashSaleEngine(io);

    io.on('connection', (socket) => {
      if (flashSaleState.active) socket.emit('blackFridayTick', { active: true, endTime: flashSaleState.endTime });
      
      socket.on('joinAdminChannel', (token) => {
        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
          if (!err && decoded && decoded.role === 'admin') {
            socket.join('admin-dashboard-room');
            console.log(`DEBUG: Admin joined real-time channel. Node ID: ${decoded.id}`);
          }
        });
      });
    });

    // ==========================================
    // 6. PUBLIC REST API CONTROLLERS
    // ==========================================

    expressApp.post('/api/user/signup', async (req, res) => {
      try {
        const { phoneNumber, password, fullName } = req.body || {};
        
        if (!phoneNumber || !password || !fullName) {
          return res.status(400).json({ error: 'All parameters required (phoneNumber, password, fullName)' });
        }
        
        const existingUser = await User.findOne({ where: { phoneNumber } });
        if (existingUser) {
          return res.status(409).json({ error: 'Mobile registration payload matches active record' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = await User.create({ phoneNumber, password: hashedPassword, fullName });
        
        const token = jwt.sign({ id: newUser.id, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { id: newUser.id, fullName: newUser.fullName, role: newUser.role } });
      } catch (err) { 
        console.error("Signup Error:", err);
        res.status(500).json({ error: err.message || 'Internal server signup failure' }); 
      }
    });

    expressApp.post('/api/user/login', async (req, res) => {
      try {
        const { phoneNumber, password } = req.body || {};
        
        if (!phoneNumber || !password) {
          return res.status(400).json({ error: 'Phone number and password are required' });
        }

        const user = await User.findOne({ where: { phoneNumber } });
        if (!user || !user.isActive) {
          return res.status(401).json({ error: 'Invalid phone number or password' });
        }

        if (!user.password) {
          return res.status(401).json({ error: 'Account uses Google Sign-In. Please sign in with Google.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid phone number or password' });
        }

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user.id, fullName: user.fullName, role: user.role, phoneNumber: user.phoneNumber } });
      } catch (err) { 
        console.error("Login Error:", err);
        res.status(500).json({ error: err.message || 'Internal server authentication failure' }); 
      }
    });

    expressApp.get('/api/products/catalog', async (req, res) => {
      try {
        const { variety, minWeight, maxWeight, maxPrice, search } = req.query;
        let whereCondition = { isAvailable: true };

        if (variety) whereCondition.variety = variety;
        if (minWeight || maxWeight) {
          whereCondition.weightKg = {};
          if (minWeight) whereCondition.weightKg[Op.gte] = Number(minWeight);
          if (maxWeight) whereCondition.weightKg[Op.lte] = Number(maxWeight);
        }
        if (search) {
          whereCondition[Op.or] = [
            { brandName: { [Op.like]: `%${search}%` } },
            { variety: { [Op.like]: `%${search}%` } }
          ];
        }

        const products = await RiceProduct.findAll({ where: whereCondition });
        
        const optimizedCatalog = products.map(product => {
          const productObj = product.toJSON();
          let currentEffectivePrice = productObj.basePrice || productObj.price || 0;
          if (flashSaleState && flashSaleState.active && productObj.flashSalePrice !== null && productObj.flashSalePrice !== undefined) {
            currentEffectivePrice = productObj.flashSalePrice;
          }
          return {
            ...productObj,
            price: currentEffectivePrice,
            imageUrl: productObj.imageUrl || productObj.image || productObj.url || null,
            isBlackFridayApplied: (flashSaleState && flashSaleState.active && productObj.flashSalePrice !== null && productObj.flashSalePrice !== undefined)
          };
        }).filter(item => !maxPrice || item.price <= Number(maxPrice));

        res.json(optimizedCatalog);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // --- FEATURED GRAIN SELECTION (Returns exactly 4 curated products) ---
    expressApp.get('/api/products/featured', async (req, res) => {
      try {
        const featuredProducts = await RiceProduct.findAll({
          where: { isAvailable: true },
          limit: 4,
          order: [['id', 'ASC']]
        });

        const formatted = featuredProducts.map(p => {
          const pObj = p.toJSON();
          let currentPrice = pObj.basePrice || pObj.price || 0;
          if (flashSaleState && flashSaleState.active && pObj.flashSalePrice) {
            currentPrice = pObj.flashSalePrice;
          }
          return {
            ...pObj,
            price: currentPrice,
            imageUrl: pObj.imageUrl || pObj.image || null
          };
        });

        res.json(formatted);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/config/carousel', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'homepage_carousel' } });
        res.json(config ? config.value : []);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/config/hero', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'hero_settings' } });
        res.json(config ? config.value : {});
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/config/counties', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'county_overrides' } });
        res.json(config ? config.value : {});
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- CASCADING LOGISTICS & LOCATIONS ENDPOINT ---
    expressApp.get('/api/config/locations', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'logistics_hierarchy' } });
        res.json(config ? config.value : {});
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- M-PESA PAYMENT DETAILS CONFIG ENDPOINT ---
    expressApp.get('/api/config/payment-methods', async (req, res) => {
      try {
        const config = await SystemConfig.findOne({ where: { key: 'mpesa_config' } });
        res.json(config ? config.value : {
          paybillNumber: '522522',
          paybillAccount: 'MWEARICE',
          tillNumber: '889900',
          stkEnabled: true
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // --- ORDERS & PAYMENTS ---
    expressApp.get('/api/orders/my-orders', authenticateToken, async (req, res) => {
      try {
        const orders = await Order.findAll({
          where: { userId: req.user.id },
          order: [['createdAt', 'DESC']]
        });
        res.json(orders);
      } catch (err) { 
        res.status(500).json({ error: err.message }); 
      }
    });

    expressApp.post('/api/orders/create', authenticateToken, async (req, res) => {
      try {
        const { 
          cartItems, 
          paymentMethod, // Supported: 'mpesa_stk', 'mpesa_till', 'mpesa_paybill', 'cash_on_delivery'
          mpesaPhoneNumber,
          county, 
          town, 
          location, 
          sublocation, 
          streetAddress,
          shippingAddress, 
          shippingFee, 
          grandTotal 
        } = req.body || {};
        
        if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
          return res.status(400).json({ error: 'Cart items payload cannot be empty' });
        }

        let calculatedSubtotal = 0;
        const builtOrderLineItems = [];

        for (const item of cartItems) {
          const targetId = item.productId || item.laptopId || item.id;
          const product = await RiceProduct.findByPk(targetId);
          
          if (!product || product.stockQuantity < item.quantity) {
            return res.status(422).json({ error: `Inventory failure for product ID: ${targetId}. Insufficient stock.` });
          }

          let purchasePrice = product.basePrice || product.price || 0;
          if (flashSaleState.active && product.flashSalePrice !== null && product.flashSalePrice !== undefined) {
            purchasePrice = product.flashSalePrice;
          }

          calculatedSubtotal += (purchasePrice * item.quantity);
          product.stockQuantity -= item.quantity; 
          await product.save();

          builtOrderLineItems.push({ 
            productId: product.id, 
            name: `${product.brandName} ${product.variety || ''} (${product.weightKg || 0}kg)`,
            quantity: item.quantity, 
            priceAtPurchase: purchasePrice,
            imageUrl: product.imageUrl || product.image || null
          });
          
          io.emit('stockUpdated', { productId: product.id, newStockQuantity: product.stockQuantity });
          
          if (product.stockQuantity <= 10) {
            io.to('admin-dashboard-room').emit('lowStockAlert', {
              productId: product.id,
              name: product.brandName,
              remainingStock: product.stockQuantity
            });
          }
        }

        let activeTransportCharge = shippingFee !== undefined ? Number(shippingFee) : 250;
        if (county) {
          const countyConfig = await SystemConfig.findOne({ where: { key: 'county_overrides' } });
          if (countyConfig && countyConfig.value && countyConfig.value[county] !== undefined) {
            activeTransportCharge = Number(countyConfig.value[county]);
          }
        }

        const fullDeliveryAddress = {
          county: county || 'Not Specified',
          town: town || 'Not Specified',
          location: location || 'Not Specified',
          sublocation: sublocation || 'Not Specified',
          streetAddress: streetAddress || 'Not Specified',
          details: shippingAddress || `${streetAddress || ''}, ${sublocation || ''}, ${location || ''}, ${town || ''}, ${county || ''}`
        };

        // STK Push Log Trigger for M-Pesa STK push
        if (paymentMethod === 'mpesa_stk') {
          console.log(`📱 M-Pesa STK Push Triggered for ${mpesaPhoneNumber || 'registered mobile number'}. Amount: KES ${grandTotal || (calculatedSubtotal + activeTransportCharge)}`);
        }

        const generatedOrder = await Order.create({
          userId: req.user.id,
          items: builtOrderLineItems,
          transportFee: activeTransportCharge,
          subTotal: calculatedSubtotal,
          grandTotal: grandTotal || (calculatedSubtotal + activeTransportCharge),
          paymentDetails: { 
            method: paymentMethod || 'mpesa_stk', 
            isPaid: false,
            mpesaNumber: mpesaPhoneNumber || null
          },
          county: county || 'Not Specified', 
          town: town || '',
          location: location || '',
          sublocation: sublocation || '',
          shippingAddress: fullDeliveryAddress,
          status: 'pending' 
        });

        io.to('admin-dashboard-room').emit('newOrderAlert', generatedOrder);
        res.status(201).json(generatedOrder);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ==========================================
    // 7. SECURE ADMINISTRATIVE ENGINE
    // ==========================================
    
    expressApp.post('/api/admin/upload', authenticateToken, requireAdmin, upload.single('image'), (req, res) => {
      try {
        if (!req.file) return res.status(400).json({ error: 'No file buffered to stream' });
        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ url: fileUrl, imageUrl: fileUrl });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    const addProductHandler = async (req, res) => {
      try {
        console.log("DEBUG: Raw Product Payload:", req.body); 
        const payload = {
          ...req.body,
          brandName: req.body.brandName || req.body.brand || 'Premium Rice',
          variety: req.body.variety || 'Aromatic Pishori',
          weightKg: Number(req.body.weightKg || req.body.weight || 0),
          basePrice: Number(req.body.basePrice || req.body.price || 0),
          flashSalePrice: req.body.flashSalePrice !== undefined && req.body.flashSalePrice !== null && req.body.flashSalePrice !== '' ? Number(req.body.flashSalePrice) : null,
          stockQuantity: Number(req.body.stockQuantity || req.body.stock || 0),
          imageUrl: req.body.imageUrl || req.body.image || req.body.url || null,
          isAvailable: req.body.isAvailable !== undefined ? Boolean(req.body.isAvailable) : true
        };

        const createdRecord = await RiceProduct.create(payload);
        
        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'CREATE_PRODUCT',
          targetType: 'product',
          targetId: createdRecord.id,
          changes: { brand: createdRecord.brandName, variety: createdRecord.variety },
          ipAddress: req.ip
        });
        
        res.status(201).json(createdRecord);
      } catch (err) {
        if (err.name === 'SequelizeValidationError') {
          console.error("DEBUG: VALIDATION ERROR:", err.errors.map(e => e.message));
          return res.status(400).json({ error: 'Validation Failed', details: err.errors.map(e => e.message) });
        }
        console.error("DEBUG: SERVER ERROR:", err);
        res.status(500).json({ error: err.message }); 
      }
    };

    expressApp.post('/api/admin/products', authenticateToken, requireAdmin, addProductHandler);
    expressApp.post('/api/admin/products/add', authenticateToken, requireAdmin, addProductHandler);
    expressApp.post('/api/admin/laptops/add', authenticateToken, requireAdmin, addProductHandler);

    const editProductHandler = async (req, res) => {
      try {
        const updatePayload = {
          ...req.body
        };
        if (req.body.price !== undefined && req.body.basePrice === undefined) {
          updatePayload.basePrice = Number(req.body.price);
        }
        if (req.body.image !== undefined && req.body.imageUrl === undefined) {
          updatePayload.imageUrl = req.body.image;
        }

        await RiceProduct.update(updatePayload, { where: { id: req.params.id } });
        const updatedProduct = await RiceProduct.findByPk(req.params.id);
        
        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'EDIT_PRODUCT_SPEC_OR_PRICE',
          targetType: 'product',
          targetId: updatedProduct ? updatedProduct.id : req.params.id,
          changes: req.body,
          ipAddress: req.ip
        });
        res.json(updatedProduct);
      } catch (err) { res.status(500).json({ error: err.message }); }
    };

    expressApp.put('/api/admin/products/:id', authenticateToken, requireAdmin, editProductHandler);
    expressApp.put('/api/admin/products/:id/edit', authenticateToken, requireAdmin, editProductHandler);
    expressApp.put('/api/admin/laptops/:id/edit', authenticateToken, requireAdmin, editProductHandler);

    const deleteProductHandler = async (req, res) => {
      try {
        await RiceProduct.destroy({ where: { id: req.params.id } });
        
        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'DELETE_PRODUCT',
          targetType: 'product',
          targetId: req.params.id,
          ipAddress: req.ip
        });

        res.json({ message: 'Catalog item wiped permanently.' });
      } catch (err) { res.status(500).json({ error: err.message }); }
    };

    expressApp.delete('/api/admin/products/:id', authenticateToken, requireAdmin, deleteProductHandler);
    expressApp.delete('/api/admin/products/:id/destroy', authenticateToken, requireAdmin, deleteProductHandler);
    expressApp.delete('/api/admin/laptops/:id/destroy', authenticateToken, requireAdmin, deleteProductHandler);

    expressApp.get('/api/admin/orders', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { search } = req.query;
        const include = [{
          model: User,
          attributes: ['id', 'fullName', 'phoneNumber', 'role', 'isActive']
        }];

        let whereCondition = {};
        if (search && search.trim() !== '') {
          const searchStr = `%${search.trim()}%`;
          whereCondition = {
            [Op.or]: [
              { id: { [Op.like]: searchStr } },
              { county: { [Op.like]: searchStr } },
              { '$User.fullName$': { [Op.like]: searchStr } },
              { '$User.phoneNumber$': { [Op.like]: searchStr } }
            ]
          };
        }

        const orders = await Order.findAll({
          where: whereCondition,
          include: include,
          order: [['createdAt', 'DESC']]
        });

        res.json(orders);
      } catch (err) {
        console.error("DEBUG: Order Fetch Error:", err);
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.get('/api/admin/orders/export/csv', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const orders = await Order.findAll({
          include: [{ model: User, attributes: ['fullName', 'phoneNumber'] }],
          order: [['createdAt', 'DESC']]
        });

        let csv = 'Order ID,Customer Name,Phone Number,County,Town,Location,Sublocation,Grand Total (KES),Delivery Status,Order Date\n';
        
        orders.forEach(o => {
          const customerName = o.User ? o.User.fullName.replace(/,/g, ' ') : 'N/A';
          const phone = o.User ? o.User.phoneNumber : 'N/A';
          const county = (o.county || '').replace(/,/g, ' ');
          const town = (o.town || '').replace(/,/g, ' ');
          const loc = (o.location || '').replace(/,/g, ' ');
          const subloc = (o.sublocation || '').replace(/,/g, ' ');
          const dateStr = new Date(o.createdAt).toISOString().split('T')[0];
          
          csv += `${o.id},"${customerName}",${phone},${county},${town},${loc},${subloc},${o.grandTotal},${o.status},${dateStr}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=delivery-history-${Date.now()}.csv`);
        res.status(200).send(csv);
      } catch (err) {
        console.error("DEBUG: CSV Export Error:", err);
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.put('/api/admin/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const order = await Order.findByPk(req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        
        const oldStatus = order.status;
        order.status = req.body.status;
        await order.save();

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'UPDATE_ORDER_STATUS',
          targetType: 'order',
          targetId: order.id,
          changes: { oldStatus, newStatus: req.body.status },
          ipAddress: req.ip
        });

        io.emit('orderStatusUpdated', order);
        res.json(order);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const systemRegisteredUsers = await User.findAll({ attributes: { exclude: ['password'] } });
        res.json(systemRegisteredUsers);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.put('/api/admin/users/:id/modify', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { fullName, role, isActive } = req.body || {};
        const targetUserRecord = await User.findByPk(req.params.id);
        if (!targetUserRecord) return res.status(404).json({ error: 'Invalid document' });

        if (fullName !== undefined) targetUserRecord.fullName = fullName;
        if (role !== undefined) targetUserRecord.role = role;
        if (isActive !== undefined) targetUserRecord.isActive = isActive;

        await targetUserRecord.save();
        
        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'MODIFY_USER_CLEARANCE',
          targetType: 'user',
          targetId: targetUserRecord.id,
          changes: req.body,
          ipAddress: req.ip
        });

        res.json({ message: 'User updated', record: targetUserRecord });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const targetUserRecord = await User.findByPk(req.params.id);
        if (!targetUserRecord) return res.status(404).json({ error: 'User not found' });
        if (targetUserRecord.id === req.user.id) return res.status(403).json({ error: 'Cannot delete current active session admin' });

        await targetUserRecord.destroy();

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'DELETE_USER',
          targetType: 'user',
          targetId: req.params.id,
          ipAddress: req.ip
        });

        res.json({ message: 'User permanently deleted' });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ADMIN: Update Homepage Media Carousel Feed & Rotation Timings (Videos: 5s, Images: 3-4s)
    expressApp.post('/api/admin/config/carousel', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { slides } = req.body || {};
        if (!Array.isArray(slides)) {
          return res.status(400).json({ error: 'Slides validation failed: input must be an array' });
        }

        // Apply default timing parameters if absent (5s for videos, 4s for images)
        const processedSlides = slides.map(slide => ({
          ...slide,
          duration: slide.duration || (slide.type === 'video' ? 5 : 4)
        }));

        let config = await SystemConfig.findOne({ where: { key: 'homepage_carousel' } });
        if (!config) {
          config = await SystemConfig.create({ key: 'homepage_carousel', value: processedSlides });
        } else {
          config.value = processedSlides;
          config.changed('value', true);
          await config.save();
        }

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'UPDATE_CAROUSEL_CONFIG',
          targetType: 'config',
          changes: { slides: processedSlides },
          ipAddress: req.ip
        });

        io.emit('carouselUpdated', config.value);
        res.json({ message: 'Homepage carousel configuration synchronized successfully', slides: config.value });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ADMIN: Update Hero Video / Picture Backdrop Settings
    expressApp.post('/api/admin/config/hero', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { type, url, title, subtitle, videoDuration, imageDuration } = req.body || {};
        let config = await SystemConfig.findOne({ where: { key: 'hero_settings' } });
        
        const newSettings = { 
          type: type || 'video', 
          url, 
          title, 
          subtitle,
          videoDuration: videoDuration || 5,
          imageDuration: imageDuration || 4
        };

        if (!config) {
          config = await SystemConfig.create({ key: 'hero_settings', value: newSettings });
        } else {
          config.value = newSettings;
          config.changed('value', true);
          await config.save();
        }

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'UPDATE_HERO_BACKDROP',
          targetType: 'config',
          changes: newSettings,
          ipAddress: req.ip
        });

        io.emit('heroUpdated', config.value);
        res.json({ message: 'Storefront hero backdrop synchronized successfully', hero: config.value });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // ADMIN: Update M-Pesa Payment Method Details (Paybill & Till)
    expressApp.post('/api/admin/config/payment-methods', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { paybillNumber, paybillAccount, tillNumber, stkEnabled } = req.body || {};
        let config = await SystemConfig.findOne({ where: { key: 'mpesa_config' } });
        
        const updatedMpesaConfig = {
          paybillNumber: paybillNumber || '522522',
          paybillAccount: paybillAccount || 'MWEARICE',
          tillNumber: tillNumber || '889900',
          stkEnabled: stkEnabled !== undefined ? Boolean(stkEnabled) : true
        };

        if (!config) {
          config = await SystemConfig.create({ key: 'mpesa_config', value: updatedMpesaConfig });
        } else {
          config.value = updatedMpesaConfig;
          config.changed('value', true);
          await config.save();
        }

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'UPDATE_MPESA_CONFIG',
          targetType: 'config',
          changes: updatedMpesaConfig,
          ipAddress: req.ip
        });

        res.json({ message: 'M-Pesa payment configuration synchronized successfully', config: config.value });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    expressApp.post('/api/admin/config/transport', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { amount } = req.body || {};
        const previousConfig = await SystemConfig.findOne({ where: { key: 'transport_fee' } });
        
        let updatedConfig;
        if (previousConfig) {
          previousConfig.value = Number(amount);
          updatedConfig = await previousConfig.save();
        } else {
          updatedConfig = await SystemConfig.create({ key: 'transport_fee', value: Number(amount) });
        }

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'UPDATE_TRANSPORT_FEE',
          targetType: 'config',
          changes: { newAmount: amount },
          ipAddress: req.ip
        });

        res.json({ message: 'Transport fee updated', config: updatedConfig });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.post('/api/admin/config/black-friday', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { active, durationHours } = req.body || {}; 
        const currentBfConfig = await SystemConfig.findOne({ where: { key: 'black_friday' } });

        if (active) {
          const computedExpirationStamp = new Date(Date.now() + ((durationHours || 24) * 60 * 60 * 1000));
          flashSaleState.active = true;
          flashSaleState.endTime = computedExpirationStamp.toISOString();
          
          if (currentBfConfig) {
            currentBfConfig.value = { active: true, endTime: flashSaleState.endTime };
            currentBfConfig.changed('value', true);
            await currentBfConfig.save();
          }

          startFlashSaleCountdown(io);
          io.emit('blackFridayStarted', { active: true, endTime: flashSaleState.endTime });
        } else {
          if (flashSaleState.countdownIntervalId) clearInterval(flashSaleState.countdownIntervalId);
          flashSaleState.active = false;
          flashSaleState.endTime = null;

          if (currentBfConfig) {
            currentBfConfig.value = { active: false, endTime: null };
            currentBfConfig.changed('value', true);
            await currentBfConfig.save();
          }
          io.emit('blackFridayEnded', { active: false });
        }

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'TOGGLE_FLASH_HARVEST_SALE',
          targetType: 'config',
          changes: { active, durationHours },
          ipAddress: req.ip
        });

        res.json({ message: 'Flash Harvest Sale configuration updated', engineState: flashSaleState });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.post('/api/admin/config/counties', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const { county, fee } = req.body || {};
        let config = await SystemConfig.findOne({ where: { key: 'county_overrides' } });
        
        let currentOverrides = config && config.value ? config.value : {};
        currentOverrides[county] = Number(fee);

        if (!config) {
          config = await SystemConfig.create({ key: 'county_overrides', value: currentOverrides });
        } else {
          config.value = currentOverrides;
          config.changed('value', true);
          await config.save();
        }

        await AdminLog.create({
          adminId: req.adminUser.id,
          action: 'UPDATE_COUNTY_OVERRIDE',
          targetType: 'config',
          changes: { county, fee },
          ipAddress: req.ip
        });

        res.json({ message: `Regional override updated for ${county}`, overrides: config.value });
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    expressApp.get('/api/admin/logs', authenticateToken, requireAdmin, async (req, res) => {
      try {
        const logs = await AdminLog.findAll({
          include: [{ model: User, as: 'Admin', attributes: ['fullName'] }],
          order: [['createdAt', 'DESC']],
          limit: 150 
        });
        res.json(logs);
      } catch (err) { res.status(500).json({ error: err.message }); }
    });

    // ==========================================
    // 8. DEFAULT FALLBACK ROUTE
    // ==========================================
    expressApp.get('/', (req, res) => {
      res.json({ status: 'Online', message: '🌾 Premium Rice & Grain API Architecture is running seamlessly.' });
    });

    server.listen(port, () => {
      console.log(`\n=============================================================`);
      console.log(`🌾 Premium Rice & Grain Standalone API Architecture Is Live`);
      console.log(`📡 Serving REST API & WebSockets on port ${port}`);
      console.log(`=============================================================\n`);
    });

  } catch (fatalInitCrashErr) {
    console.error('❌ Root System Initialization Core Failure encountered:', fatalInitCrashErr);
    process.exit(1);
  }
}

startServer();
