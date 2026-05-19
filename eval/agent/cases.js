'use strict';

const assert = require('node:assert/strict');

module.exports = [
  {
    id: 'simple-1-user-count',
    category: 'simple',
    fixture: 'ecommerce',
    prompt: 'How many users do we have in total, including deleted ones?',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      const got = typeof trace.output === 'number' ? trace.output : trace.output?.count;
      assert.equal(got, 4, `expected 4 users, got ${JSON.stringify(trace.output)}`);
    }
  },
  {
    id: 'simple-2-most-expensive-product',
    category: 'simple',
    fixture: 'ecommerce',
    prompt: 'What is the single most expensive product? Return an object with its name and price.',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      assert.equal(trace.output?.name, 'Laptop', `expected name=Laptop, got ${JSON.stringify(trace.output)}`);
      assert.equal(trace.output?.price, 1200, `expected price=1200, got ${JSON.stringify(trace.output)}`);
    }
  },
  {
    id: 'simple-3-active-bookings',
    category: 'simple',
    fixture: 'carsharing',
    prompt: 'How many bookings currently have status "active"?',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      const got = typeof trace.output === 'number' ? trace.output : trace.output?.count;
      assert.equal(got, 2, `expected 2 active bookings, got ${JSON.stringify(trace.output)}`);
    }
  },
  {
    id: 'simple-4-list-evs',
    category: 'simple',
    fixture: 'carsharing',
    prompt: 'List every electric vehicle in the fleet, returning an array with make and model.',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      const list = Array.isArray(trace.output) ? trace.output : trace.output?.vehicles;
      assert.equal(list?.length, 2, `expected 2 EVs, got ${JSON.stringify(trace.output)}`);
      const json = JSON.stringify(list);
      assert.ok(json.includes('Tesla') && json.includes('Leaf'), `expected Tesla and Leaf, got ${json}`);
    }
  },
  {
    id: 'simple-5-orders-by-status',
    category: 'simple',
    fixture: 'ecommerce',
    prompt: 'Show a table with the count of orders grouped by status.',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      assert.ok(trace.output?.$table, `expected $table, got ${JSON.stringify(trace.output)}`);
      assert.equal(trace.output.$table.rows.length, 5, `expected 5 status rows, got ${trace.output.$table.rows.length}`);
      const json = JSON.stringify(trace.output.$table);
      for (const status of ['pending', 'paid', 'shipped', 'delivered', 'cancelled']) {
        assert.ok(json.includes(status), `expected "${status}" in table, got ${json}`);
      }
    }
  },

  {
    id: 'nested-1-orders-by-month',
    category: 'nested',
    fixture: 'ecommerce',
    prompt: 'How many orders were placed each month over the past 6 months? Return a table.',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      assert.ok(trace.output?.$table, `expected $table, got ${JSON.stringify(trace.output)}`);
      assert.ok(trace.output.$table.rows.length >= 3, `expected ≥3 month rows, got ${trace.output.$table.rows.length}`);
    }
  },
  {
    id: 'nested-2-late-returns-unpaid',
    category: 'nested',
    fixture: 'carsharing',
    prompt: 'Return an array of bookings that were returned late (returnedAt after endAt) and have at least one unpaid charge.',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      assert.ok(Array.isArray(trace.output), `expected array, got ${JSON.stringify(trace.output)}`);
      assert.equal(trace.output.length, 2, `expected 2 late+unpaid bookings, got ${trace.output.length}`);
    }
  },
  {
    id: 'nested-3-paid-orders-with-electronics',
    category: 'nested',
    fixture: 'ecommerce',
    prompt: 'Return an array of paid orders that contain at least one electronics product.',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      assert.ok(Array.isArray(trace.output), `expected array, got ${JSON.stringify(trace.output)}`);
      assert.equal(trace.output.length, 2, `expected 2 paid+electronics orders, got ${trace.output.length}`);
    }
  },

  {
    id: 'dashboard-1-top-products',
    category: 'dashboard',
    fixture: 'ecommerce',
    prompt: 'Build a dashboard showing the top 5 products by gross revenue from paid orders.',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      const renderable = trace.output?.$chart || trace.output?.$table;
      assert.ok(renderable, `expected $chart or $table, got ${JSON.stringify(trace.output)}`);
      assert.ok(JSON.stringify(renderable).includes('Headphones'), `Headphones should be top product, got ${JSON.stringify(renderable)}`);
    }
  },
  {
    id: 'dashboard-2-bookings-per-vehicle-type',
    category: 'dashboard',
    fixture: 'carsharing',
    prompt: 'Show a chart of total bookings broken down by vehicle type.',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      assert.ok(trace.output?.$chart, `expected $chart, got ${JSON.stringify(trace.output)}`);
      const json = JSON.stringify(trace.output.$chart);
      for (const type of ['ev', 'sedan', 'suv']) {
        assert.ok(json.includes(type), `expected "${type}" in chart, got ${json}`);
      }
    }
  },
  {
    id: 'dashboard-3-revenue-by-month',
    category: 'dashboard',
    fixture: 'ecommerce',
    prompt: 'Chart total revenue per month from paid orders.',
    assert(trace) {
      assert.equal(trace.executionError, null, `script error: ${trace.executionError}`);
      assert.ok(trace.output?.$chart, `expected $chart, got ${JSON.stringify(trace.output)}`);
      const labels = trace.output.$chart.data?.labels;
      assert.ok(Array.isArray(labels) && labels.length >= 2, `expected ≥2 month labels, got ${JSON.stringify(labels)}`);
    }
  },

  {
    id: 'ambig-1-missing-user',
    category: 'ambiguous',
    fixture: 'carsharing',
    prompt: 'Why does Jane Doe have a negative balance?',
    assert(trace) {
      assert.ok(
        trace.toolCalls.some(t => t.toolName === 'findOne' || t.toolName === 'find'),
        'agent should look up the user before answering'
      );
      const lower = trace.text.toLowerCase();
      assert.ok(
        lower.includes('50') || lower.includes('positive') || lower.includes('not negative'),
        `agent should note Jane's balance is actually positive; text was: ${trace.text.slice(0, 500)}`
      );
    }
  },
  {
    id: 'ambig-2-investigate',
    category: 'ambiguous',
    fixture: 'ecommerce',
    prompt: 'Some orders look weird. Can you investigate?',
    assert(trace) {
      assert.ok(trace.toolCalls.length >= 2, `expected ≥2 tool calls; saw ${trace.toolCalls.length}`);
    }
  }
];
