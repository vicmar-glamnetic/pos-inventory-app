export function formatPeso(amount) {
  if (amount === null || amount === undefined) return '₱0.00';
  return '₱' + Number(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
