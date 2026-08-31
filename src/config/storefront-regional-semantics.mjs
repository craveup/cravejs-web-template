function fail(code) {
  throw new TypeError(code);
}

function validateTrimmedString(value, code) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    fail(code);
  }
}

export function validateStorefrontLocale(value) {
  validateTrimmedString(value, "LOCALE");

  try {
    new Intl.Locale(value);
  } catch {
    fail("LOCALE");
  }

  return value;
}

export function validateStorefrontTimeZone(value) {
  validateTrimmedString(value, "TIME_ZONE");

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
  } catch {
    fail("TIME_ZONE");
  }

  return value;
}

export function validateStorefrontRegionalConfig(config) {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    fail("REGIONAL_CONFIG");
  }

  return {
    locale: validateStorefrontLocale(config.locale),
    timeZone: validateStorefrontTimeZone(config.timeZone),
  };
}
