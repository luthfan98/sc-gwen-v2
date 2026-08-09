import { DateTime, Settings } from "luxon";

export const WIB_TIMEZONE = "Asia/Jakarta";

Settings.defaultZone = WIB_TIMEZONE;

const ISO_WITH_OFFSET_RE = /(Z|[+-]\d{2}:\d{2})$/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const SQL_DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,7})?)?$/;

const toSqlCompatibleDate = (dt) =>
  new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second, dt.millisecond));

const toWibDateTime = (input, sourceTz = WIB_TIMEZONE) => {
  if (input == null || input === "") return null;

  let dt = null;

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return null;
    dt = DateTime.fromJSDate(input, { zone: "utc" });
  } else if (typeof input === "number") {
    dt = DateTime.fromMillis(input, { zone: "utc" });
  } else if (typeof input === "string") {
    const value = input.trim();
    if (!value) return null;

    if (ISO_WITH_OFFSET_RE.test(value)) {
      dt = DateTime.fromISO(value, { setZone: true });
    } else if (DATE_ONLY_RE.test(value)) {
      dt = DateTime.fromISO(value, { zone: sourceTz });
    } else if (SQL_DATE_TIME_RE.test(value)) {
      dt = DateTime.fromSQL(value, { zone: sourceTz });
    } else {
      dt = DateTime.fromISO(value, { zone: sourceTz });
    }
  } else {
    return null;
  }

  if (!dt || !dt.isValid) return null;
  return dt.setZone(WIB_TIMEZONE);
};

export const nowWib = () => {
  const now = DateTime.now().setZone(WIB_TIMEZONE);
  return toSqlCompatibleDate(now);
};

export const toWibDate = (input, options = {}) => {
  const dtWib = toWibDateTime(input, options.sourceTz);
  if (!dtWib) return null;
  return toSqlCompatibleDate(dtWib);
};

const normalizeDateTimeInput = (input) => {
  if (input instanceof DateTime) return input;
  if (input instanceof Date) return DateTime.fromJSDate(input, { zone: "utc" });
  if (typeof input === "number") return DateTime.fromMillis(input, { zone: "utc" });
  return DateTime.now();
};

export const wibDateOnly = (input = DateTime.now()) => {
  const dt = normalizeDateTimeInput(input);
  return dt.setZone(WIB_TIMEZONE).toFormat("yyyy-LL-dd");
};

export const wibStamp = (input = DateTime.now()) => {
  const dt = normalizeDateTimeInput(input);
  return dt.setZone(WIB_TIMEZONE).toFormat("yyLLddHHmmssSSS");
};

export const formatWibSqlDateTime = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const dt = DateTime.fromJSDate(value, { zone: "utc" });
  return dt.toFormat("yyyy-LL-dd HH:mm:ss");
};

export const logWibConversion = (logger, payload) => {
  if (!logger || process.env.WIB_TIME_DEBUG !== "1") return;
  logger.info(payload, "[WIB-TIME] timestamp conversion");
};
