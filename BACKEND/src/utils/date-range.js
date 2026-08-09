export const toDateOnly = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const formatDateOnly = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const normalizeDateRange = ({ from, to, defaultDays = 30, maxSpanDays = 93 }) => {
  let fromVal = String(from || "").trim();
  let toVal = String(to || "").trim();

  if (!fromVal && !toVal) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - defaultDays);
    fromVal = formatDateOnly(start);
    toVal = formatDateOnly(today);
  } else if (fromVal && !toVal) {
    toVal = fromVal;
  } else if (!fromVal && toVal) {
    fromVal = toVal;
  }

  const fromDate = toDateOnly(fromVal);
  const toDate = toDateOnly(toVal);
  if (!fromDate || !toDate) {
    return { error: "Format tanggal tidak valid." };
  }

  const diffMs = toDate.getTime() - fromDate.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays < 0) {
    return { error: "Tanggal sampai harus >= tanggal dari." };
  }
  const spanDays = diffDays + 1;
  if (spanDays > maxSpanDays) {
    return { error: `Rentang tanggal maksimal ${maxSpanDays} hari.` };
  }

  return {
    from: formatDateOnly(fromDate),
    to: formatDateOnly(toDate),
    fromDate,
    toDate,
    spanDays,
  };
};
