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
        'navy-blue': {
          '50': '#f1f4ff',
          '100': '#e5e8ff',
          '200': '#ced5ff',
          '300': '#a7b1ff',
          '400': '#767fff',
          '500': '#3f42ff',
          '600': '#2118ff',
          '700': '#1007fa',
          '800': '#0d05d2',
          '900': '#0c06ac',
          '950': '#000088',
        },
      } 
    }
  }
};