import { sequelize } from './lib/db.js';

async function syncDatabase() {
  try {
    console.log('🔌 Testing connection to the database...');
    await sequelize.authenticate();
    console.log('✅ Connection established successfully.');

    console.log('⏳ Creating/Updating tables in the database...');
    // 'alter: true' will automatically add new columns/tables without deleting existing data
    await sequelize.sync({ alter: true }); 
    
    console.log('\n======================================================');
    console.log('🎉 Database synchronization complete!');
    console.log('   All tables (User, RiceProduct, Order, AdminLog, etc.)');
    console.log('   have been successfully created in your database.');
    console.log('======================================================\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database synchronization failed:');
    console.error(error.message);
    process.exit(1);
  }
}

syncDatabase();