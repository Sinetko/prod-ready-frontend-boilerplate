module.exports = {
  extends: ['stylelint-config-recommended'],
  plugins: ['stylelint-order'],
  overrides: [
    {
      files: ['**/*.{ts,tsx,js,jsx}'],
      customSyntax: 'postcss-styled-syntax',
    },
  ],
  rules: {
    'no-descending-specificity': null,
    'no-duplicate-selectors': null,
    'property-no-vendor-prefix': null,
    'order/order': ['custom-properties', 'declarations', 'rules'],
  },
};
