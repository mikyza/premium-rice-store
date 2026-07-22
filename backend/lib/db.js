import { Sequelize, DataTypes } from 'sequelize';
import dotenv from 'dotenv';
dotenv.config();

const isCloud = process.env.DB_MODE === 'cloud';
let sequelize;

if (isCloud && process.env.DB_CLOUD_URL) {
  console.log('🔌 Configuring Connection for Aiven Cloud Database...');
  sequelize = new Sequelize(process.env.DB_CLOUD_URL, {
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      ssl: {
        rejectUnauthorized: false // Required for secure Aiven SSL handshakes
      }
    }
  });
} else {
  console.log('🏠 Configuring Connection for Local MySQL Database...');
  sequelize = new Sequelize(
    process.env.DB_LOCAL_NAME || 'rice_store',
    process.env.DB_LOCAL_USER || 'root',
    process.env.DB_LOCAL_PASSWORD || '',
    {
      host: process.env.DB_LOCAL_HOST || 'localhost',
      port: process.env.DB_LOCAL_PORT || 3306,
      dialect: 'mysql',
      logging: false,
    }
  );
}

export { sequelize };

// ==========================================
// SCHEMAS & MODELS
// ==========================================
export const User = sequelize.define('User', {
  phoneNumber: { type: DataTypes.STRING, unique: true, allowNull: true },
  password: { type: DataTypes.STRING, allowNull: true },
  fullName: { type: DataTypes.STRING, allowNull: false },
  googleId: { type: DataTypes.STRING, unique: true, allowNull: true },
  role: { type: DataTypes.STRING, defaultValue: 'user' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true }
});

export const RiceProduct = sequelize.define('RiceProduct', {
  brandName: { type: DataTypes.STRING, allowNull: false },
  variety: { type: DataTypes.STRING, allowNull: false },
  weightKg: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  basePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  flashSalePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  stockQuantity: { type: DataTypes.INTEGER, defaultValue: 0 },
  isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true }
});

export const Order = sequelize.define('Order', {
  items: { type: DataTypes.JSON, allowNull: false },
  transportFee: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  subTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  grandTotal: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  paymentDetails: { type: DataTypes.JSON, allowNull: false },
  county: { type: DataTypes.STRING, defaultValue: 'Not Specified' },
  status: { type: DataTypes.STRING, defaultValue: 'pending' }
});

export const AdminLog = sequelize.define('AdminLog', {
  adminId: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.STRING, allowNull: false },
  targetType: { type: DataTypes.STRING },
  targetId: { type: DataTypes.STRING },
  changes: { type: DataTypes.JSON },
  ipAddress: { type: DataTypes.STRING }
});

export const SystemConfig = sequelize.define('SystemConfig', {
  key: { type: DataTypes.STRING, unique: true, allowNull: false },
  value: { type: DataTypes.JSON, allowNull: false }
});

export const Review = sequelize.define('Review', {
  stars: { type: DataTypes.INTEGER, allowNull: false },
  comment: { type: DataTypes.TEXT }
});

// Configure Relationships
Order.belongsTo(User, { foreignKey: 'userId' });
AdminLog.belongsTo(User, { as: 'Admin', foreignKey: 'adminId' });