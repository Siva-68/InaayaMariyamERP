/**
 * Converts numeric amount to Indian Currency words (Rupees ... Only)
 * Used in Indian GST invoices (e.g. "Rupees Two Thousand One Hundred and Sixty Only")
 */
export function numberToIndianWords(num: number | string): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(n) || n === 0) return 'Rupees Zero Only';

  const singleDigits = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(val: number): string {
    if (val < 20) return singleDigits[val];
    const digit = val % 10;
    return tens[Math.floor(val / 10)] + (digit ? ' ' + singleDigits[digit] : '');
  }

  function convertThreeDigits(val: number): string {
    const hundred = Math.floor(val / 100);
    const rest = val % 100;
    let res = '';
    if (hundred > 0) {
      res += singleDigits[hundred] + ' Hundred';
    }
    if (rest > 0) {
      if (res) res += ' and ';
      res += convertTwoDigits(rest);
    }
    return res;
  }

  const [rupeesStr, paiseStr] = n.toFixed(2).split('.');
  let rupees = parseInt(rupeesStr, 10);
  const paise = parseInt(paiseStr, 10);

  let words = '';

  // Crores (1,00,00,000)
  const crores = Math.floor(rupees / 10000000);
  rupees %= 10000000;
  if (crores > 0) {
    words += convertTwoDigits(crores) + ' Crore ';
  }

  // Lakhs (1,00,000)
  const lakhs = Math.floor(rupees / 100000);
  rupees %= 100000;
  if (lakhs > 0) {
    words += convertTwoDigits(lakhs) + ' Lakh ';
  }

  // Thousands (1,000)
  const thousands = Math.floor(rupees / 1000);
  rupees %= 1000;
  if (thousands > 0) {
    words += convertTwoDigits(thousands) + ' Thousand ';
  }

  // Hundreds & below
  if (rupees > 0) {
    words += convertThreeDigits(rupees) + ' ';
  }

  let finalStr = 'Rupees ' + words.trim();
  if (paise > 0) {
    finalStr += ' and ' + convertTwoDigits(paise) + ' Paise';
  }
  return finalStr + ' Only';
}
