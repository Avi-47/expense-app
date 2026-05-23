export const formatMoney = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const fromCents = (cents) => Number(cents || 0) / 100;

export const formatBalanceLabel = ({ direction, amount, otherUserName }) => {
  const formatted = formatMoney(amount);

  if (direction === "incoming") {
    return `${otherUserName} owes you ₹${formatted}`;
  }

  if (direction === "outgoing") {
    return `You owe ${otherUserName} ₹${formatted}`;
  }

  return "Settled";
};