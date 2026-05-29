export function Format(amount: number | string): string {
  if (typeof amount === 'number') {
    return amount.toLocaleString('ja-JP');
  }
  return Number(amount).toLocaleString('ja-JP');
}