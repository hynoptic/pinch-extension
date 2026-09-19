function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTransformedValue(value: number, tOrigin: number, amount: number) {
  if (amount === 0 || value === tOrigin) {
    return value;
  }

  const exponent =
    amount < 0
      ? 1 / (1 + -amount * 3) // pinch
      : 1 + amount * 3; // bulge

  if (value < tOrigin) {
    const distance = (tOrigin - value) / tOrigin;
    const tDistance = Math.pow(distance, exponent);

    return tOrigin - tDistance * tOrigin;
  }

  const distance = (value - tOrigin) / (1 - tOrigin);
  const tDistance = Math.pow(distance, exponent);

  return tOrigin + tDistance * (1 - tOrigin);
}

export function transformStartTime(
  startTime: number,
  clipLength: number,
  transformOrigin: number,
  amount: number,
) {
  const tStartTime = clamp(startTime / clipLength, 0, 1);
  const tOrigin = clamp(transformOrigin / 100, 0.0001, 0.9999);
  const tAmount = clamp(amount, -1, 1);
  return getTransformedValue(tStartTime, tOrigin, tAmount) * clipLength;
}