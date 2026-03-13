'use strict';

const connect = require('./connect');
const mongoose = require('mongoose');

if (require.main === module) {
  run().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

async function run() {
  await connect();
  const { User } = mongoose.models;
  const dashboardCollection = mongoose.connection.collection('studio__dashboards');
  const now = new Date();

  const users = [
    {
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'admin',
      plan: 'enterprise',
      status: 'active',
      isDeleted: false,
      lastLoginAt: new Date('2026-03-11T14:21:00.000Z'),
      createdAt: new Date('2025-10-03T09:15:00.000Z'),
      updatedAt: now
    },
    {
      name: 'Grace Hopper',
      email: 'grace@example.com',
      role: 'analyst',
      plan: 'pro',
      status: 'active',
      isDeleted: false,
      lastLoginAt: new Date('2026-03-10T17:42:00.000Z'),
      createdAt: new Date('2025-11-16T13:05:00.000Z'),
      updatedAt: now
    },
    {
      name: 'Linus Torvalds',
      email: 'linus@example.com',
      role: 'editor',
      plan: 'starter',
      status: 'invited',
      isDeleted: false,
      lastLoginAt: null,
      createdAt: new Date('2026-01-09T11:30:00.000Z'),
      updatedAt: now
    },
    {
      name: 'Margaret Hamilton',
      email: 'margaret@example.com',
      role: 'viewer',
      plan: 'pro',
      status: 'inactive',
      isDeleted: false,
      lastLoginAt: new Date('2026-02-22T08:00:00.000Z'),
      createdAt: new Date('2025-12-01T16:20:00.000Z'),
      updatedAt: now
    }
  ];

  const dashboard = {
    title: 'User directory table',
    description: 'Sample dashboard for testing the dashboard-table component.',
    code: `const users = await db.model('User')
  .find({ isDeleted: false })
  .sort({ createdAt: -1 })
  .lean();

return {
  $table: {
    columns: ['Name', 'Email', 'Role', 'Plan', 'Status', 'Last Login'],
    rows: users.map(user => [
      user.name,
      user.email,
      user.role,
      user.plan,
      user.status,
      user.lastLoginAt ? new Date(user.lastLoginAt).toISOString().slice(0, 10) : 'Never'
    ])
  }
};`
  };

  await User.deleteMany({ email: { $in: users.map(user => user.email) } });
  await dashboardCollection.deleteMany({ title: dashboard.title });

  const insertedUsers = await User.insertMany(users);
  const insertedDashboard = await dashboardCollection.insertOne(dashboard);

  console.log(`Inserted ${insertedUsers.length} users`);
  console.log(`Inserted dashboard ${insertedDashboard.insertedId.toString()}`);

  await mongoose.disconnect();
}

module.exports = run;
