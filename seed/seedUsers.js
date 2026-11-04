'use strict';

const mongoose = require('mongoose');

const batchSize = 10000;
const plans = ['starter', 'pro', 'enterprise'];
const statuses = ['active', 'invited', 'inactive'];

const namedUsers = [
  {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    location: {
      type: 'Point',
      coordinates: [-0.1276, 51.5072]
    },
    role: 'admin',
    plan: 'enterprise',
    status: 'active',
    isDeleted: false,
    picture: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Ada_Lovelace_daguerreotype_by_Antoine_Claudet_1843_-_cropped.png/250px-Ada_Lovelace_daguerreotype_by_Antoine_Claudet_1843_-_cropped.png',
      uploadedAt: '2026-03-10',
      verified: false
    },
    lastLoginAt: new Date('2026-03-11T14:21:00.000Z'),
    createdAt: new Date('2025-10-03T09:15:00.000Z')
  },
  {
    name: 'Grace Hopper',
    email: 'grace@example.com',
    location: {
      type: 'Point',
      coordinates: [-74.006, 40.7128]
    },
    role: 'analyst',
    plan: 'pro',
    status: 'active',
    isDeleted: false,
    picture: {
      url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSIr89U4_AMP_H4ImShM8EIOUMA6DEPVxkhxw&s',
      uploadedAt: '2026-03-09',
      verified: true
    },
    lastLoginAt: new Date('2026-03-10T17:42:00.000Z'),
    createdAt: new Date('2025-11-16T13:05:00.000Z')
  },
  {
    name: 'Linus Torvalds',
    email: 'linus@example.com',
    location: {
      type: 'Point',
      coordinates: [24.9384, 60.1699]
    },
    role: 'editor',
    plan: 'starter',
    status: 'invited',
    isDeleted: false,
    picture: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/e/e8/Lc3_2018_%28263682303%29_%28cropped%29.jpeg',
      uploadedAt: '2026-03-11',
      verified: false
    },
    lastLoginAt: null,
    createdAt: new Date('2026-01-09T11:30:00.000Z')
  },
  {
    name: 'Margaret Hamilton',
    email: 'margaret@example.com',
    location: {
      type: 'Point',
      coordinates: [-71.1097, 42.3736]
    },
    role: 'viewer',
    plan: 'pro',
    status: 'inactive',
    isDeleted: false,
    picture: {
      url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Margaret_Hamilton_1995.jpg/960px-Margaret_Hamilton_1995.jpg',
      uploadedAt: '2026-03-06',
      verified: true
    },
    lastLoginAt: new Date('2026-02-22T08:00:00.000Z'),
    createdAt: new Date('2025-12-01T16:20:00.000Z')
  }
];

// Generated users copy the last named user, and only differ by their user number.
// Status changes every `plans.length` users so every plan and status combination shows up.
function getUser(index) {
  if (index < namedUsers.length) {
    return namedUsers[index];
  }

  const userNumber = index + 1;
  return {
    ...namedUsers[namedUsers.length - 1],
    name: `User ${userNumber}`,
    email: `user${userNumber}@example.com`,
    plan: plans[index % plans.length],
    status: statuses[Math.floor(index / plans.length) % statuses.length]
  };
}

module.exports = async function seedUsers(numUsers = namedUsers.length) {
  if (!Number.isSafeInteger(Number(numUsers)) || numUsers < 0) {
    throw new Error(`Number of users must be a non-negative integer, got "${numUsers}"`);
  }
  numUsers = Number(numUsers);

  const { User } = mongoose.models;
  const now = new Date();

  // Match generated users by pattern so re-seeding with fewer users removes the extras
  await User.deleteMany({
    $or: [
      { email: { $in: namedUsers.map(user => user.email) } },
      { email: /^user\d+@example\.com$/ }
    ]
  });

  for (let start = 0; start < numUsers; start += batchSize) {
    const batch = [];
    for (let index = start; index < Math.min(start + batchSize, numUsers); ++index) {
      batch.push({ ...getUser(index), updatedAt: now });
    }
    await User.insertMany(batch);
  }

  return numUsers;
};
