'use strict';

const mongoose = require('mongoose');

const sleuthSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    status: {
        type: String,
        $required: true,
        default: 'created',
        enum: ['created', 'in_progress', 'cancelled', 'resolved', 'archived']
    }
}, {
    timestamps: true
});

module.exports = sleuthSchema;