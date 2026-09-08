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
        rejectUnauthorized: false
      }
    }
  });
} else {
  console.log('🏠 Configuring Connection for Local MySQL Database...');
  sequelize = new Sequelize(
    process.env.DB_LOCAL_NAME || 'rice_grain_store',
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
  googleId: { type: DataTypes.STRING, unique: true, allowNull: true },
  fullName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, unique: true, allowNull: true },
  phoneNumber: { type: DataTypes.STRING, allowNull: true },
  password: { type: DataTypes.STRING, allowNull: true },
  role: { type: DataTypes.STRING, defaultValue: 'user' },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  rewardPoints: { type: DataTypes.FLOAT, defaultValue: 0, allowNull: false },
  resetToken: { type: DataTypes.STRING, allowNull: true },
  resetTokenExpires: { type: DataTypes.DATE, allowNull: true }
});

export const RiceProduct = sequelize.define('RiceProduct', {
  brandName: { type: DataTypes.STRING, allowNull: false },
  variety: { type: DataTypes.STRING, allowNull: false },
  weightKg: { type: DataTypes.FLOAT, defaultValue: 1, allowNull: false },
  basePrice: { type: DataTypes.FLOAT, defaultValue: 0, allowNull: false },
  buyingPrice: { type: DataTypes.FLOAT, defaultValue: 0 },
  flashSalePrice: { type: DataTypes.FLOAT, allowNull: true },
  stockQuantity: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
  imageUrl: { type: DataTypes.TEXT, allowNull: true },
  isAvailable: { type: DataTypes.BOOLEAN, defaultValue: true }
});

export const Cart = sequelize.define('Cart', {
  quantity: { type: DataTypes.INTEGER, defaultValue: 1, allowNull: false }
});

export const Order = sequelize.define('Order', {
  items: { type: DataTypes.JSON, allowNull: false },
  subTotal: { type: DataTypes.FLOAT, defaultValue: 0, allowNull: false },
  transportFee: { type: DataTypes.FLOAT, defaultValue: 0, allowNull: false },
  grandTotal: { type: DataTypes.FLOAT, defaultValue: 0, allowNull: false },
  totalWeightKg: { type: DataTypes.FLOAT, defaultValue: 0 },
  pointsEarned: { type: DataTypes.FLOAT, defaultValue: 0 },
  paymentDetails: { type: DataTypes.JSON, allowNull: false },
  county: { type: DataTypes.STRING, defaultValue: 'Not Specified' },
  town: { type: DataTypes.STRING, defaultValue: '' },
  location: { type: DataTypes.STRING, defaultValue: '' },
  sublocation: { type: DataTypes.STRING, defaultValue: '' },
  shippingAddress: { type: DataTypes.JSON, allowNull: true },
  status: { type: DataTypes.STRING, defaultValue: 'pending' }
});

export const Payment = sequelize.define('Payment', {
  externalReference: { type: DataTypes.STRING, unique: true, allowNull: false },
  provider: { type: DataTypes.STRING, defaultValue: 'm-pesa' },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  phoneNumber: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'PENDING' },
  mpesaReceiptNumber: { type: DataTypes.STRING, allowNull: true },
  failureReason: { type: DataTypes.TEXT, allowNull: true },
  rawResponse: { type: DataTypes.JSON, allowNull: true }
});

export const UserAddress = sequelize.define('UserAddress', {
  county: { type: DataTypes.STRING, allowNull: false },
  town: { type: DataTypes.STRING, allowNull: false },
  location: { type: DataTypes.STRING, allowNull: true },
  sublocation: { type: DataTypes.STRING, allowNull: true },
  streetAddress: { type: DataTypes.STRING, allowNull: true },
  isDefault: { type: DataTypes.BOOLEAN, defaultValue: false }
});

export const Review = sequelize.define('Review', {
  rating: { type: DataTypes.INTEGER, defaultValue: 5, allowNull: false },
  comment: { type: DataTypes.TEXT, allowNull: true }
});

export const AdminLog = sequelize.define('AdminLog', {
  action: { type: DataTypes.STRING, allowNull: false },
  targetType: { type: DataTypes.STRING, allowNull: true },
  targetId: { type: DataTypes.STRING, allowNull: true },
  changes: { type: DataTypes.JSON, allowNull: true },
  ipAddress: { type: DataTypes.STRING, allowNull: true }
});

export const AdminNotification = sequelize.define('AdminNotification', {
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING, defaultValue: 'alert' },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false }
});

export const SystemConfig = sequelize.define('SystemConfig', {
  key: { type: DataTypes.STRING, unique: true, allowNull: false },
  value: { type: DataTypes.JSON, allowNull: false }
});

export const Transaction = sequelize.define('Transaction', {
  type: { type: DataTypes.STRING, allowNull: false },
  amount: { type: DataTypes.FLOAT, allowNull: false },
  reference: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, defaultValue: 'completed' }
});

// Configure Relationships
User.hasMany(Order, { foreignKey: 'userId', onDelete: 'CASCADE' });
Order.belongsTo(User, { foreignKey: 'userId' });

Order.hasMany(Payment, { foreignKey: 'orderId', onDelete: 'CASCADE' });
Payment.belongsTo(Order, { foreignKey: 'orderId' });

User.hasMany(Cart, { foreignKey: 'userId', onDelete: 'CASCADE' });
Cart.belongsTo(User, { foreignKey: 'userId' });

RiceProduct.hasMany(Cart, { foreignKey: 'productId', onDelete: 'CASCADE' });
Cart.belongsTo(RiceProduct, { foreignKey: 'productId' });

User.hasMany(UserAddress, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserAddress.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Review, { foreignKey: 'userId', onDelete: 'CASCADE' });
Review.belongsTo(User, { foreignKey: 'userId' });

RiceProduct.hasMany(Review, { foreignKey: 'productId', onDelete: 'CASCADE' });
Review.belongsTo(RiceProduct, { foreignKey: 'productId' });

User.hasMany(AdminLog, { foreignKey: 'adminId', onDelete: 'CASCADE' });
AdminLog.belongsTo(User, { as: 'Admin', foreignKey: 'adminId' });

User.hasMany(Transaction, { foreignKey: 'userId', onDelete: 'CASCADE' });
Transaction.belongsTo(User, { foreignKey: 'userId' });

Order.hasMany(Transaction, { foreignKey: 'orderId', onDelete: 'SET NULL' });
Transaction.belongsTo(Order, { foreignKey: 'orderId' });
