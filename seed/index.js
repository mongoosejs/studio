'use strict';

const connect = require('./connect');
const mongoose = require('mongoose');
const seedUsers = require('./seedUsers');

if (require.main === module) {
  run(process.argv[2]).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

async function run(numUsers) {
  await connect();
  const dashboardCollection = mongoose.connection.collection('studio__dashboards');

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

  await dashboardCollection.deleteMany({ title: dashboard.title });

  const numInsertedUsers = await seedUsers(numUsers);
  const insertedDashboard = await dashboardCollection.insertOne(dashboard);

  console.log(`Inserted ${numInsertedUsers} users`);
  console.log(`Inserted dashboard ${insertedDashboard.insertedId.toString()}`);

  await mongoose.disconnect();
}

module.exports = run;
