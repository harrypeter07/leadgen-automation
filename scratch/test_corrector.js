const { correctCountryName } = require('../backend/modules/countryCorrector');

console.log('Test "sweeden":', correctCountryName('sweeden'));
console.log('Test "indiaa":', correctCountryName('indiaa'));
console.log('Test "swedn":', correctCountryName('swedn'));
console.log('Test "united states":', correctCountryName('united states'));
console.log('Test "germanii":', correctCountryName('germanii'));
console.log('Test "asdfasdf":', correctCountryName('asdfasdf'));
