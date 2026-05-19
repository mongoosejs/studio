'use strict';

const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema({
  name: String,
  email: String,
  signupDate: Date,
  isDeleted: { type: Boolean, default: false }
});

const productSchema = new Schema({
  name: String,
  category: { type: String, enum: ['electronics', 'apparel', 'home', 'books'] },
  price: Number,
  inventory: Number,
  createdAt: Date
});

const orderSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  items: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    quantity: Number,
    price: Number
  }],
  total: Number,
  status: { type: String, enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] },
  placedAt: Date,
  paidAt: Date
});

module.exports = {
  name: 'ecommerce',
  defineModels(connection) {
    return {
      User: connection.model('User', userSchema),
      Product: connection.model('Product', productSchema),
      Order: connection.model('Order', orderSchema)
    };
  },
  async seed({ User, Product, Order }) {
    const users = await User.create([
      { name: 'Alice Smith', email: 'alice@example.com', signupDate: new Date('2025-01-15'), isDeleted: false },
      { name: 'Bob Jones', email: 'bob@example.com', signupDate: new Date('2025-04-22'), isDeleted: false },
      { name: 'Carol Wu', email: 'carol@example.com', signupDate: new Date('2025-09-08'), isDeleted: true },
      { name: 'David Park', email: 'david@example.com', signupDate: new Date('2025-12-03'), isDeleted: false }
    ]);

    const products = await Product.create([
      { name: 'Laptop', category: 'electronics', price: 1200, inventory: 12, createdAt: new Date('2024-11-01') },
      { name: 'Headphones', category: 'electronics', price: 150, inventory: 45, createdAt: new Date('2024-11-01') },
      { name: 'T-Shirt', category: 'apparel', price: 25, inventory: 200, createdAt: new Date('2025-01-15') },
      { name: 'Lamp', category: 'home', price: 60, inventory: 30, createdAt: new Date('2025-02-10') },
      { name: 'Novel', category: 'books', price: 18, inventory: 100, createdAt: new Date('2025-03-04') }
    ]);

    const monthsAgo = (n) => {
      const d = new Date('2026-05-13T12:00:00.000Z');
      d.setUTCMonth(d.getUTCMonth() - n);
      return d;
    };

    await Order.create([
      {
        userId: users[0]._id,
        items: [{ productId: products[0]._id, quantity: 1, price: 1200 }],
        total: 1200,
        status: 'delivered',
        placedAt: monthsAgo(5),
        paidAt: monthsAgo(5)
      },
      {
        userId: users[0]._id,
        items: [{ productId: products[1]._id, quantity: 2, price: 150 }],
        total: 300,
        status: 'paid',
        placedAt: monthsAgo(3),
        paidAt: monthsAgo(3)
      },
      {
        userId: users[1]._id,
        items: [
          { productId: products[2]._id, quantity: 3, price: 25 },
          { productId: products[4]._id, quantity: 1, price: 18 }
        ],
        total: 93,
        status: 'shipped',
        placedAt: monthsAgo(4),
        paidAt: monthsAgo(4)
      },
      {
        userId: users[1]._id,
        items: [{ productId: products[3]._id, quantity: 1, price: 60 }],
        total: 60,
        status: 'paid',
        placedAt: monthsAgo(2),
        paidAt: monthsAgo(2)
      },
      {
        userId: users[3]._id,
        items: [{ productId: products[0]._id, quantity: 1, price: 1200 }],
        total: 1200,
        status: 'cancelled',
        placedAt: monthsAgo(2),
        paidAt: null
      },
      {
        userId: users[3]._id,
        items: [{ productId: products[1]._id, quantity: 1, price: 150 }],
        total: 150,
        status: 'paid',
        placedAt: monthsAgo(1),
        paidAt: monthsAgo(1)
      },
      {
        userId: users[1]._id,
        items: [{ productId: products[4]._id, quantity: 4, price: 18 }],
        total: 72,
        status: 'paid',
        placedAt: monthsAgo(1),
        paidAt: monthsAgo(1)
      },
      {
        userId: users[3]._id,
        items: [{ productId: products[2]._id, quantity: 2, price: 25 }],
        total: 50,
        status: 'pending',
        placedAt: monthsAgo(0),
        paidAt: null
      },
      {
        userId: users[0]._id,
        items: [{ productId: products[3]._id, quantity: 2, price: 60 }],
        total: 120,
        status: 'cancelled',
        placedAt: monthsAgo(6),
        paidAt: null
      },
      {
        userId: users[1]._id,
        items: [{ productId: products[0]._id, quantity: 1, price: 1200 }],
        total: 1200,
        status: 'delivered',
        placedAt: monthsAgo(4),
        paidAt: monthsAgo(4)
      }
    ]);
  }
};
