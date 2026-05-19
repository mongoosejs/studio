'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema({
  name: String,
  email: String,
  balance: Number,
  joinedAt: Date
});

const vehicleSchema = new Schema({
  make: String,
  model: String,
  type: { type: String, enum: ['sedan', 'suv', 'ev'] },
  licensePlate: String,
  dailyRate: Number
});

const bookingSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
  startAt: Date,
  endAt: Date,
  returnedAt: Date,
  status: { type: String, enum: ['active', 'completed', 'cancelled'] }
});

const chargeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
  amount: Number,
  paid: Boolean,
  createdAt: Date
});

module.exports = {
  name: 'carsharing',
  defineModels(connection) {
    return {
      User: connection.model('User', userSchema),
      Vehicle: connection.model('Vehicle', vehicleSchema),
      Booking: connection.model('Booking', bookingSchema),
      Charge: connection.model('Charge', chargeSchema)
    };
  },
  async seed({ User, Vehicle, Booking, Charge }) {
    const users = await User.create([
      { name: 'Jane Doe', email: 'jane@example.com', balance: 50, joinedAt: new Date('2025-02-01') },
      { name: 'John Smith', email: 'john@example.com', balance: -25, joinedAt: new Date('2025-03-15') },
      { name: 'Alice Wonder', email: 'alice@example.com', balance: 100, joinedAt: new Date('2025-06-22') },
      { name: 'Bob Lee', email: 'bob@example.com', balance: 0, joinedAt: new Date('2026-01-10') }
    ]);

    const vehicles = await Vehicle.create([
      { make: 'Tesla', model: 'Model 3', type: 'ev', licensePlate: 'EV-001', dailyRate: 80 },
      { make: 'Toyota', model: 'Camry', type: 'sedan', licensePlate: 'SD-110', dailyRate: 50 },
      { make: 'Honda', model: 'CR-V', type: 'suv', licensePlate: 'SU-220', dailyRate: 70 },
      { make: 'Nissan', model: 'Leaf', type: 'ev', licensePlate: 'EV-330', dailyRate: 60 }
    ]);

    const dayOffset = (n) => {
      const d = new Date('2026-05-13T12:00:00.000Z');
      d.setUTCDate(d.getUTCDate() + n);
      return d;
    };
    const daysAgo = (n) => dayOffset(-n);

    const bookings = await Booking.create([
      {
        userId: users[0]._id,
        vehicleId: vehicles[0]._id,
        startAt: daysAgo(40),
        endAt: daysAgo(38),
        returnedAt: daysAgo(38),
        status: 'completed'
      },
      {
        userId: users[1]._id,
        vehicleId: vehicles[1]._id,
        startAt: daysAgo(30),
        endAt: daysAgo(28),
        returnedAt: daysAgo(27),
        status: 'completed'
      },
      {
        userId: users[1]._id,
        vehicleId: vehicles[2]._id,
        startAt: daysAgo(20),
        endAt: daysAgo(18),
        returnedAt: daysAgo(15),
        status: 'completed'
      },
      {
        userId: users[2]._id,
        vehicleId: vehicles[3]._id,
        startAt: daysAgo(10),
        endAt: daysAgo(8),
        returnedAt: daysAgo(8),
        status: 'completed'
      },
      {
        userId: users[2]._id,
        vehicleId: vehicles[0]._id,
        startAt: daysAgo(3),
        endAt: dayOffset(2),
        returnedAt: null,
        status: 'active'
      },
      {
        userId: users[3]._id,
        vehicleId: vehicles[1]._id,
        startAt: daysAgo(1),
        endAt: dayOffset(5),
        returnedAt: null,
        status: 'active'
      },
      {
        userId: users[3]._id,
        vehicleId: vehicles[3]._id,
        startAt: daysAgo(60),
        endAt: daysAgo(58),
        returnedAt: null,
        status: 'cancelled'
      },
      {
        userId: users[0]._id,
        vehicleId: vehicles[2]._id,
        startAt: daysAgo(50),
        endAt: daysAgo(48),
        returnedAt: daysAgo(46),
        status: 'completed'
      }
    ]);

    await Charge.create([
      { userId: users[0]._id, bookingId: bookings[0]._id, amount: 160, paid: true, createdAt: daysAgo(38) },
      { userId: users[1]._id, bookingId: bookings[1]._id, amount: 100, paid: true, createdAt: daysAgo(27) },
      { userId: users[1]._id, bookingId: bookings[2]._id, amount: 140, paid: false, createdAt: daysAgo(15) },
      { userId: users[1]._id, bookingId: bookings[2]._id, amount: 35, paid: false, createdAt: daysAgo(15) },
      { userId: users[2]._id, bookingId: bookings[3]._id, amount: 120, paid: true, createdAt: daysAgo(8) },
      { userId: users[0]._id, bookingId: bookings[7]._id, amount: 140, paid: false, createdAt: daysAgo(46) }
    ]);
  }
};
