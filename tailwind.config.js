'use strict';

module.exports = {
  mode: 'jit',
  content: ['./frontend/src/**/*.html', './frontend/src/**/*.js', './frontend/src/**/**/*.html', './frontend/src/**/**/*.js'],
  corePlugins: {
    container: true
  },
  plugins: [],
  theme: {
    extend: {
      colors: {
        'puerto-rico': {
          '50': '#eefffb',
          '100': '#c6fff3',
          '200': '#8effe8',
          '300': '#4dfbdb',
          '400': '#15d4b7',
          '500': '#00ccb0',
          '600': '#00a491',
          '700': '#038276',
          '800': '#08675f',
          '900': '#0c554e',
          '950': '#003432',
        },
        'teal': {
          '50': '#eefffc',
          '100': '#c5fffa',
          '200': '#8bfff5',
          '300': '#4afef0',
          '400': '#15ece2',
          '500': '#00d0c9',
          '600': '#00a8a5',
          '700': '#008888',
          '800': '#066769',
          '900': '#0a5757',
          '950': '#003235',
        },
        'ultramarine': {
            '50': '#f1f5ff',
            '100': '#e5eaff',
            '200': '#cedaff',
            '300': '#a7b9ff',
            '400': '#768cff',
            '500': '#3f53ff',
            '600': '#1823ff',
            '700': '#0713fa',
            '800': '#0510d2',
            '900': '#060eac',
            '950': '#000c87',
        },
      }
    }
  }
};
