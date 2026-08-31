const decimalStringPattern = /^-?\d+(?:\.\d+)?$/;
const isoCurrencyPattern = /^[A-Za-z]{3}$/;

export interface FormatMoneyOptions {
  readonly signDisplay?: "auto" | "always" | "exceptZero" | "never";
}

function roundToCurrencyPrecision(
  amount: string,
  fractionDigits: number,
): { readonly negative: boolean; readonly minorUnits: bigint } {
  const negative = amount.startsWith("-");
  const unsignedAmount = negative ? amount.slice(1) : amount;
  const [integerPart, fractionPart = ""] = unsignedAmount.split(".");
  const scale = BigInt(10) ** BigInt(fractionDigits);
  const retainedFraction = fractionPart
    .slice(0, fractionDigits)
    .padEnd(fractionDigits, "0");
  const firstDiscardedDigit = fractionPart[fractionDigits];

  let minorUnits =
    BigInt(integerPart) * scale + BigInt(retainedFraction || "0");
  if (firstDiscardedDigit !== undefined && firstDiscardedDigit >= "5") {
    minorUnits += BigInt(1);
  }

  return { negative, minorUnits };
}

function localizedDigits(locale: string): readonly string[] {
  const formatter = new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 0,
  });
  return Array.from({ length: 10 }, (_, digit) => formatter.format(digit));
}

export function formatMoney(
  amount: string,
  currency: string,
  locale = "en-US",
  options: FormatMoneyOptions = {},
): string {
  if (!decimalStringPattern.test(amount)) {
    throw new TypeError("Money amount must be an API decimal string.");
  }

  if (!isoCurrencyPattern.test(currency)) {
    throw new TypeError("Money currency must be a three-letter ISO currency code.");
  }

  const normalizedCurrency = currency.toUpperCase();
  if (!Intl.supportedValuesOf("currency").includes(normalizedCurrency)) {
    throw new TypeError("Money currency must be a supported ISO currency code.");
  }

  try {
    let formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      ...(options.signDisplay ? { signDisplay: options.signDisplay } : {}),
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    if (fractionDigits === undefined) {
      throw new TypeError("Money currency precision is not supported.");
    }
    const { negative, minorUnits } = roundToCurrencyPrecision(
      amount,
      fractionDigits,
    );
    if (
      options.signDisplay === "exceptZero" &&
      minorUnits !== BigInt(0)
    ) {
      formatter = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: normalizedCurrency,
        signDisplay: "always",
      });
    }
    const scale = BigInt(10) ** BigInt(fractionDigits);
    const wholeUnits = minorUnits / scale;
    const fractionalUnits = (minorUnits % scale)
      .toString()
      .padStart(fractionDigits, "0");
    const digitMap = localizedDigits(locale);
    const localizedFraction = fractionalUnits.replace(
      /\d/g,
      (digit) => digitMap[Number(digit)] ?? digit,
    );
    const signedWholeUnits =
      wholeUnits === BigInt(0)
        ? negative
          ? -0
          : 0
        : negative
          ? -wholeUnits
          : wholeUnits;

    return formatter
      .formatToParts(signedWholeUnits)
      .map((part) => (part.type === "fraction" ? localizedFraction : part.value))
      .join("");
  } catch {
    throw new TypeError("Money currency or locale is not supported.");
  }
}
