/**
 * Fully-populated sample report fixture.
 *
 * Validates cleanly against `createReportSchema` (see ../schemas/reportSchemas.ts)
 * and exercises every section of the finalized report content:
 *
 *   • private  — privately-owned stations, grouped by primary fuel
 *   • iec      — Israel Electric Corporation stations, grouped by primary fuel
 *   • forecast — today / tomorrow load + weather
 *   • archive  — yesterday's production + weather (editable archive block)
 *   • archiveExtraDays — two days prior to yesterday
 *   • lastYearArchive  — same calendar day last year
 *   • fuels    — per-tank fuel-site inventory
 *
 * Station statuses are intentionally mixed (Active / Inactive / Maintenance)
 * with realistic startTime / endTime / notes on the non-Active rows.
 *
 * Reference date for this fixture: 2026-05-28 (Thursday).
 *   yesterday        = 2026-05-27 (Wednesday — "יום רביעי")
 *   day before       = 2026-05-26 (Tuesday  — "יום שלישי")
 *   two days before  = 2026-05-25 (Monday   — "יום שני")
 *   last-year match  = 2025-05-27 (Tuesday  — "יום שלישי")
 */

import type { CreateReportInput } from "../schemas/reportSchemas";

// ─── Helpers ────────────────────────────────────────────────────────────────

const isoMidnight = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d, 0, 0, 0)).toISOString();

// ─── The fixture ────────────────────────────────────────────────────────────

export const sampleReport: CreateReportInput = {
  title:       "דוח יומי — שוק החשמל 28.05.2026",
  description: "סקירת ייצור, צריכה, עתודה ומלאי דלקים לתאריך 28 במאי 2026.",
  status:      "published",

  content: {
    // ── PRIVATE ────────────────────────────────────────────────────────────
    private: {
      gas: {
        "דוראד": [
          {
            stationNumber:             1,
            installedCapacity:         860,
            availableCapacity:         840,
            peakCapacity:              820,
            minReserveCapacity:        20,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "gas",
            secondaryFuels:            ["diesel"],
          },
          {
            stationNumber:             2,
            installedCapacity:         860,
            availableCapacity:         0,
            peakCapacity:              0,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Maintenance",
            startTime:                 "06:00",
            endTime:                   "22:00",
            mainFuel:                  "gas",
            secondaryFuels:            ["diesel"],
            notes:                     "תחזוקה שנתית מתוכננת — החלפת להבי טורבינה.",
          },
        ],
        "OPC רותם": [
          {
            stationNumber:             1,
            installedCapacity:         466,
            availableCapacity:         460,
            peakCapacity:              455,
            minReserveCapacity:        5,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "gas",
            secondaryFuels:            ["diesel"],
          },
        ],
        "OPC חדרה": [
          {
            stationNumber:             1,
            installedCapacity:         144,
            availableCapacity:         144,
            peakCapacity:              140,
            minReserveCapacity:        4,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "gas",
            secondaryFuels:            [],
          },
        ],
        "IPM באר טוביה": [
          {
            stationNumber:             1,
            installedCapacity:         450,
            availableCapacity:         445,
            peakCapacity:              440,
            minReserveCapacity:        5,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "gas",
            secondaryFuels:            ["diesel"],
          },
          {
            stationNumber:             2,
            installedCapacity:         450,
            availableCapacity:         0,
            peakCapacity:              0,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Inactive",
            mainFuel:                  "gas",
            secondaryFuels:            ["diesel"],
            notes:                     "תקלה במערכת הקירור — צוות שירות בדרך.",
          },
        ],
      },

      solar: {
        "אשלים": [
          {
            stationNumber:             1,
            installedCapacity:         121,
            availableCapacity:         121,
            peakCapacity:              115,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "solar",
            secondaryFuels:            [],
          },
          {
            stationNumber:             2,
            installedCapacity:         110,
            availableCapacity:         110,
            peakCapacity:              104,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "solar",
            secondaryFuels:            [],
          },
        ],
        "קטורה סאן": [
          {
            stationNumber:             1,
            installedCapacity:         40,
            availableCapacity:         40,
            peakCapacity:              38,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "solar",
            secondaryFuels:            [],
          },
        ],
        "צאלים": [
          {
            stationNumber:             1,
            installedCapacity:         110,
            availableCapacity:         0,
            peakCapacity:              0,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Maintenance",
            startTime:                 "08:00",
            endTime:                   "12:00",
            mainFuel:                  "solar",
            secondaryFuels:            [],
            notes:                     "ניקוי פנלים וביקורת ממירים.",
          },
        ],
      },

      wind: {
        "רוח הגולן": [
          {
            stationNumber:             1,
            installedCapacity:         207,
            availableCapacity:         190,
            peakCapacity:              140,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "wind",
            secondaryFuels:            [],
            notes:                     "תפוקה תלוית רוח — מעודכן לפי תחזית.",
          },
        ],
      },
    },

    // ── IEC ────────────────────────────────────────────────────────────────
    iec: {
      coal: {
        "אורות רבין": [
          {
            stationNumber:             1,
            installedCapacity:         360,
            availableCapacity:         355,
            peakCapacity:              350,
            minReserveCapacity:        5,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "coal",
            secondaryFuels:            ["mazut"],
          },
          {
            stationNumber:             2,
            installedCapacity:         360,
            availableCapacity:         355,
            peakCapacity:              350,
            minReserveCapacity:        5,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "coal",
            secondaryFuels:            ["mazut"],
          },
          {
            stationNumber:             3,
            installedCapacity:         360,
            availableCapacity:         0,
            peakCapacity:              0,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Maintenance",
            startTime:                 "04:00",
            endTime:                   "20:00",
            updatedEndTime:            "22:00",
            mainFuel:                  "coal",
            secondaryFuels:            ["mazut"],
            notes:                     "תחזוקה מתוכננת — הוארכה בשעתיים בשל ממצא בודק.",
          },
          {
            stationNumber:             4,
            installedCapacity:         360,
            availableCapacity:         355,
            peakCapacity:              345,
            minReserveCapacity:        10,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "coal",
            secondaryFuels:            ["mazut"],
          },
        ],
        "אורות חדרה": [
          {
            stationNumber:             1,
            installedCapacity:         575,
            availableCapacity:         560,
            peakCapacity:              555,
            minReserveCapacity:        5,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "coal",
            secondaryFuels:            ["mazut"],
          },
          {
            stationNumber:             2,
            installedCapacity:         575,
            availableCapacity:         0,
            peakCapacity:              0,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Inactive",
            mainFuel:                  "coal",
            secondaryFuels:            ["mazut"],
            notes:                     "מושבתת זמנית — בירור עם המשרד להגנת הסביבה.",
          },
        ],
      },

      gas: {
        "תחנת רידינג": [
          {
            stationNumber:             1,
            installedCapacity:         428,
            availableCapacity:         420,
            peakCapacity:              415,
            minReserveCapacity:        5,
            secondaryFuelPeakCapacity: 60,
            status:                    "Active",
            mainFuel:                  "gas",
            secondaryFuels:            ["diesel"],
          },
        ],
        "תחנת אשכול": [
          {
            stationNumber:             1,
            installedCapacity:         365,
            availableCapacity:         360,
            peakCapacity:              355,
            minReserveCapacity:        5,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "gas",
            secondaryFuels:            ["mazut"],
          },
          {
            stationNumber:             2,
            installedCapacity:         365,
            availableCapacity:         360,
            peakCapacity:              355,
            minReserveCapacity:        5,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "gas",
            secondaryFuels:            ["mazut"],
          },
          {
            stationNumber:             3,
            installedCapacity:         365,
            availableCapacity:         0,
            peakCapacity:              0,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Maintenance",
            startTime:                 "07:00",
            endTime:                   "15:00",
            mainFuel:                  "gas",
            secondaryFuels:            ["mazut"],
            notes:                     "החלפת מסנני אוויר בכניסת הקומפרסור.",
          },
        ],
        "תחנת גזר": [
          {
            stationNumber:             1,
            installedCapacity:         575,
            availableCapacity:         570,
            peakCapacity:              560,
            minReserveCapacity:        10,
            secondaryFuelPeakCapacity: 80,
            status:                    "Active",
            mainFuel:                  "gas",
            secondaryFuels:            ["diesel"],
          },
        ],
      },

      hydro: {
        "אגירה שאובה גלבוע": [
          {
            stationNumber:             1,
            installedCapacity:         150,
            availableCapacity:         150,
            peakCapacity:              150,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "hydro",
            secondaryFuels:            [],
          },
          {
            stationNumber:             2,
            installedCapacity:         150,
            availableCapacity:         150,
            peakCapacity:              150,
            minReserveCapacity:        0,
            secondaryFuelPeakCapacity: 0,
            status:                    "Active",
            mainFuel:                  "hydro",
            secondaryFuels:            [],
          },
        ],
      },
    },

    // ── FORECAST ───────────────────────────────────────────────────────────
    forecast: {
      load: {
        today: {
          value:           14_650,
          peakHour:        "14:00",
          minReserveValue: 14_100,
          minReserveHour:  "20:30",
        },
        tomorrow: {
          value:           15_280,
          peakHour:        "15:00",
          minReserveValue: 14_700,
          minReserveHour:  "20:30",
        },
      },
      weather: {
        region:    "תל אביב",
        fetchedAt: new Date(Date.UTC(2026, 4, 28, 5, 30, 0)).toISOString(),
        today:     { temperatureC: 32, feelsLikeC: 35, humidityPct: 48, description: "חם ובהיר" },
        tomorrow:  { temperatureC: 34, feelsLikeC: 38, humidityPct: 52, description: "חם מהרגיל" },
        source: {
          today:    "db",
          tomorrow: "db",
        },
      },
    },

    // ── ARCHIVE (yesterday — 2026-05-27) ───────────────────────────────────
    archive: {
      date:                isoMidnight(2026, 5, 27),
      dayName:             "יום רביעי",
      peakConsumptionHour: "14:30",
      totalsMwhByFuel: {
        coal:    78_400,
        gas:     142_300,
        solar:    18_900,
        wind:      2_450,
        hydro:     1_800,
        diesel:      320,
        mazut:       150,
      },
      renewableMwh:    23_150,
      totalIecMwh:    168_200,
      totalPrivateMwh: 76_120,
      weather: { temperatureC: 31, feelsLikeC: 34, humidityPct: 46 },
    },

    archiveExtraDays: [
      {
        date:                isoMidnight(2026, 5, 26),
        dayName:             "יום שלישי",
        peakConsumptionHour: "14:00",
        totalsMwhByFuel: {
          coal:   77_900,
          gas:    140_800,
          solar:   19_400,
          wind:     2_310,
          hydro:    1_750,
          diesel:     280,
          mazut:      140,
        },
        renewableMwh:    23_460,
        totalIecMwh:    167_100,
        totalPrivateMwh: 75_620,
        weather: { temperatureC: 30, feelsLikeC: 33, humidityPct: 45 },
      },
      {
        date:                isoMidnight(2026, 5, 25),
        dayName:             "יום שני",
        peakConsumptionHour: "13:30",
        totalsMwhByFuel: {
          coal:   76_800,
          gas:    138_400,
          solar:   20_100,
          wind:     2_700,
          hydro:    1_650,
          diesel:     200,
          mazut:      120,
        },
        renewableMwh:    24_450,
        totalIecMwh:    165_800,
        totalPrivateMwh: 74_180,
        weather: { temperatureC: 29, feelsLikeC: 31, humidityPct: 50 },
      },
    ],

    // ── LAST-YEAR ARCHIVE (2025-05-27) ─────────────────────────────────────
    lastYearArchive: {
      date:                isoMidnight(2025, 5, 27),
      dayName:             "יום שלישי",
      peakConsumptionHour: "14:00",
      peakConsumptionMw:   13_980,
      totalIecMwh:        162_400,
      totalPrivateMwh:     73_100,
      totalMwh:           235_500,
      weather: { temperatureC: 30, feelsLikeC: 33, humidityPct: 47 },
      ytdEnergyGrowthPct:  3.7,
    },

    // ── FUELS (per-tank inventory) ─────────────────────────────────────────
    fuels: [
      {
        id:          "fuel-rabin-diesel-1",
        stationTag:  "rabin",
        stationName: "אורות רבין",
        fuelType:    "diesel",
        tankType:    "מיכל דיזל ראשי",
        available:   12_400,
        bottom:      800,
      },
      {
        id:          "fuel-rabin-mazut-1",
        stationTag:  "rabin",
        stationName: "אורות רבין",
        fuelType:    "mazut",
        tankType:    "מיכל מזוט A",
        available:   28_500,
        bottom:      1_500,
      },
      {
        id:          "fuel-hadera-diesel-1",
        stationTag:  "hadera",
        stationName: "אורות חדרה",
        fuelType:    "diesel",
        tankType:    "מיכל דיזל ראשי",
        available:   9_800,
        bottom:      600,
      },
      {
        id:          "fuel-hadera-mazut-1",
        stationTag:  "hadera",
        stationName: "אורות חדרה",
        fuelType:    "mazut",
        tankType:    "מיכל מזוט B",
        available:   22_300,
        bottom:      1_200,
      },
      {
        id:          "fuel-reading-diesel-1",
        stationTag:  "reading",
        stationName: "תחנת רידינג",
        fuelType:    "diesel",
        tankType:    "מיכל דיזל גיבוי",
        available:   5_400,
        bottom:      400,
      },
      {
        id:          "fuel-eshkol-mazut-1",
        stationTag:  "eshkol",
        stationName: "תחנת אשכול",
        fuelType:    "mazut",
        tankType:    "מיכל מזוט ראשי",
        available:   18_700,
        bottom:      900,
      },
      {
        id:          "fuel-gezer-diesel-1",
        stationTag:  "gezer",
        stationName: "תחנת גזר",
        fuelType:    "diesel",
        tankType:    "מיכל דיזל ראשי",
        available:   7_200,
        bottom:      500,
      },
      {
        id:          "fuel-dorad-diesel-1",
        stationTag:  "dorad",
        stationName: "דוראד",
        fuelType:    "diesel",
        tankType:    "מיכל דיזל גיבוי",
        available:   4_100,
        bottom:      300,
      },
    ],
  },
};

export default sampleReport;
