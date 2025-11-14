const User = require('../models/User');
const { sequelize } = require('../config/database');
require('dotenv').config();

// Dữ liệu mẫu
const sampleUsers = [
    {
        fullName: 'Admin User',
        email: 'admin@example.com',
        passwordHash: 'admin123',
        phone: '0123456789',
        emailVerified: 1,
        isActive: 1
    },
    {
        fullName: 'Staff User',
        email: 'staff@example.com',
        passwordHash: 'staff123',
        phone: '0987654321',
        emailVerified: 1,
        isActive: 1
    },
    {
        fullName: 'Customer User',
        email: 'customer@example.com',
        passwordHash: 'customer123',
        phone: '0555666777',
        emailVerified: 1,
        isActive: 1
    }
];

const seedDatabase = async () => {
    try {
        // Kết nối database
        await sequelize.authenticate();
        console.log('Connected to MySQL successfully');

        // Xóa users hiện có
        await User.destroy({ where: {} });
        console.log('Cleared existing users');

        // Tạo users mẫu
        for (const userData of sampleUsers) {
            const user = await User.create(userData);
            console.log(`Created user: ${user.email} (${user.role})`);
        }

        console.log('Database seeded successfully!');
        console.log('\nSample accounts:');
        console.log('Admin: admin@example.com / admin123');
        console.log('Staff: staff@example.com / staff123');
        console.log('Customer: customer@example.com / customer123');

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await sequelize.close();
    }
};

seedDatabase();