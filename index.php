<?php

/**
 * index.php
 *
 * Single server-rendered entry point for every whenn.cc route.
 *
 * Responsibilities:
 * 1. Parse country/city/date/time from the URL.
 * 2. Match countries from json/countries.json and cities from PHP's timezone list.
 * 3. Validate fixed events and convert them to one UTC instant.
 * 4. Expose route/data state to JavaScript through `linkyData`.
 * 5. Render the page and directly import the feature CSS/JS files.
 *
 * Troubleshooting:
 * - URL dates are DD-MM-YYYY; browser form dates are YYYY-MM-DD.
 * - City slugs match the final segment of an IANA timezone.
 * - Routes without date/time become live location clocks.
 */

// Route parsing. Supported forms include /country/city/date/time and /country/date/time.
$path = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$parts = $path === '' ? [] : explode('/', $path);

$countryInput = $parts[0] ?? '';
$city = $parts[1] ?? '';
$date = $parts[2] ?? '';
$time = $parts[3] ?? '';

if (isset($parts[1], $parts[2]) && preg_match('/^\d{2}-\d{2}-\d{4}$/', $parts[1])) {
    $city = '';
    $date = $parts[1];
    $time = $parts[2];
}

/** Normalizes user-facing names/codes into a comparison-only key. */
function normalize_slug(string $value): string
{
    $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    $value = is_string($converted) ? $converted : $value;

    return preg_replace('/[^a-z0-9]+/', '', strtolower($value)) ?: '';
}

/** Turns an IANA timezone's final segment into a readable city label. */
function city_label_from_timezone(string $timezone): string
{
    $parts = explode('/', $timezone);
    return str_replace('_', ' ', end($parts));
}

/** Produces the underscore city slug used by whenn.cc URLs. */
function city_slug_from_timezone(string $timezone): string
{
    return strtolower(str_replace(' ', '_', city_label_from_timezone($timezone)));
}

/** Collects every country alias/code accepted in the first URL segment. */
function country_names(array $country): array
{
    $names = [];

    foreach ([
        $country['name']['common'] ?? null,
        $country['name']['official'] ?? null,
        $country['cca2'] ?? null,
        $country['cca3'] ?? null,
        $country['ccn3'] ?? null,
        $country['cioc'] ?? null,
    ] as $name) {
        if (is_string($name) && $name !== '') {
            $names[] = $name;
        }
    }

    foreach (($country['altSpellings'] ?? []) as $name) {
        if (is_string($name) && $name !== '') {
            $names[] = $name;
        }
    }

    return array_unique($names);
}

/** Returns Region/City IANA timezone identifiers belonging to a country code. */
function timezones_for_country(string $code): array
{
    try {
        $zones = DateTimeZone::listIdentifiers(DateTimeZone::PER_COUNTRY, strtoupper($code));
    } catch (Throwable) {
        $zones = [];
    }

    return array_values(array_filter($zones, function (string $timezone): bool {
        return count(explode('/', $timezone)) >= 2;
    }));
}

/**
 * Resolves within the matched country first, then globally as a compatibility fallback.
 * Empty city routes prefer the capital and then the country's first timezone.
 */
function resolve_timezone(string $city, ?array $countryData = null): ?string
{
    $cityKey = normalize_slug($city);
    $countryZones = $countryData ? timezones_for_country($countryData['cca2'] ?? '') : [];
    $zones = $countryZones ?: DateTimeZone::listIdentifiers();

    if ($cityKey === '') {
        foreach (($countryData['capital'] ?? []) as $capital) {
            $capitalKey = normalize_slug($capital);

            foreach ($countryZones as $timezone) {
                if (normalize_slug(city_label_from_timezone($timezone)) === $capitalKey) {
                    return $timezone;
                }
            }
        }

        return $countryZones[0] ?? null;
    }

    foreach ($zones as $timezone) {
        if (normalize_slug(city_label_from_timezone($timezone)) === $cityKey) {
            return $timezone;
        }
    }

    foreach (DateTimeZone::listIdentifiers() as $timezone) {
        if (normalize_slug(city_label_from_timezone($timezone)) === $cityKey) {
            return $timezone;
        }
    }

    return null;
}

// Country JSON feeds URL matching and the client-side picker option lists.
$countries = json_decode(
    file_get_contents(__DIR__ . '/json/countries.json'),
    true
) ?: [];

$countryData = null;
$countryKey = normalize_slug($countryInput);
$countryOptions = [];

foreach ($countries as $country) {
    $commonName = $country['name']['common'] ?? null;
    $code = $country['cca2'] ?? null;

    if (!is_string($commonName) || !is_string($code)) {
        continue;
    }

    if ($countryKey !== '') {
        foreach (country_names($country) as $name) {
            $nameKey = normalize_slug($name);

            if ($nameKey !== '' && $nameKey === $countryKey) {
                $countryData = $country;
                break;
            }
        }
    }

    $zones = array_map(function (string $timezone): array {
        return [
            'label' => city_label_from_timezone($timezone),
            'slug' => city_slug_from_timezone($timezone),
            'timezone' => $timezone,
        ];
    }, timezones_for_country($code));

    usort($zones, fn (array $a, array $b): int => strcasecmp($a['label'], $b['label']));

    if ($zones) {
        $countryOptions[] = [
            'name' => $commonName,
            'slug' => strtolower($code),
            'code' => strtoupper($code),
            'zones' => $zones,
        ];
    }
}

usort($countryOptions, fn (array $a, array $b): int => strcasecmp($a['name'], $b['name']));

// Validate the current route and convert fixed local event time into UTC once.
$timezone = resolve_timezone($city, $countryData);
$eventUtc = null;
$eventError = null;
$displayLocation = '';
$isLocationClock = $path !== '' && $date === '' && $time === '';

if ($path !== '') {
    if (!$countryData) {
        $eventError = 'Unknown country';
    } elseif (!$timezone) {
        $eventError = 'Unknown city or timezone';
    } elseif ($isLocationClock) {
        // Country-only and country/place URLs show a live clock.
    } elseif (!preg_match('/^\d{2}-\d{2}-\d{4}$/', $date)) {
        $eventError = 'Invalid date';
    } elseif (!preg_match('/^\d{4}$/', $time)) {
        $eventError = 'Invalid time';
    } else {
        $eventTime = DateTimeImmutable::createFromFormat(
            '!d-m-Y H:i',
            $date . ' ' . substr($time, 0, 2) . ':' . substr($time, 2, 2),
            new DateTimeZone($timezone)
        );

        $errors = DateTimeImmutable::getLastErrors();

        if (!$eventTime || ($errors && ($errors['warning_count'] || $errors['error_count']))) {
            $eventError = 'Invalid date or time';
        } else {
            $eventUtc = $eventTime
                ->setTimezone(new DateTimeZone('UTC'))
                ->format(DateTimeInterface::ATOM);
        }
    }
}

// Build the human-readable location shown by clocks and calendar invites.
if ($timezone) {
    $displayLocation = city_label_from_timezone($timezone);
} elseif ($city !== '') {
    $displayLocation = ucwords(str_replace(['-', '_'], ' ', $city));
}

if ($countryData) {
    $displayLocation .= ($displayLocation !== '' ? ', ' : '') . $countryData['name']['common'];
}

?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>whenn.cc</title>

    <link rel="icon" type="image/png" sizes="32x32" href="/images/icon-32.png">
    <link rel="icon" type="image/png" sizes="192x192" href="/images/icon-192.png">
    <link rel="apple-touch-icon" sizes="180x180" href="/images/icon-180.png">    
    <link rel="manifest" href="/json/manifest.json">
    <meta name="theme-color" content="#111318">

    <!--
        Styles load from general foundations into increasingly specific features.
        Later files refine shared rules, so preserve this order when adding files.
    -->
    <link rel="stylesheet" href="/css/foundation.css">
    <link rel="stylesheet" href="/css/layout.css">
    <link rel="stylesheet" href="/css/forms.css">
    <link rel="stylesheet" href="/css/examples.css">
    <link rel="stylesheet" href="/css/clock.css">
    <link rel="stylesheet" href="/css/creator.css">
    <link rel="stylesheet" href="/css/location-pickers.css">
    <link rel="stylesheet" href="/css/date-picker.css">
    <link rel="stylesheet" href="/css/time-picker.css">
    <link rel="stylesheet" href="/css/calendar.css">
    <link rel="stylesheet" href="/css/install-prompt.css">

    <script
        id="calendarLibraryScript"
        src="https://cdn.jsdelivr.net/npm/add-to-calendar-button@2.14.0"
        integrity="sha384-aW6S8xE01iTMowDFmkE+uBtBsxO3Zrd1fa38ADkf1ufkaWkUyMdNPe7Ql9x0yQjy"
        crossorigin="anonymous"
        referrerpolicy="no-referrer"
        async
        defer
    ></script>
</head>

<body class="<?= $path !== '' ? 'has-event' . ($isLocationClock ? ' location-clock' : '') : 'home-page' ?>">
    <div class="install-prompt" id="installPrompt" hidden>
        <div>
            <strong>Install whenn.cc</strong>
            <span id="installPromptText">Add it to your home screen for quicker access.</span>
        </div>

        <button type="button" id="installButton">Install</button>
        <button type="button" id="installDismiss" aria-label="Dismiss">×</button>
    </div>
    <!-- PHP-to-JavaScript bridge: route flags plus country/timezone picker data. -->
    <script>
        const linkyData = {
            country: <?= json_encode($countryData['name']['common'] ?? '') ?>,
            city: <?= json_encode($city) ?>,
            displayLocation: <?= json_encode($displayLocation) ?>,
            date: <?= json_encode($date) ?>,
            time: <?= json_encode($time) ?>,
            timezone: <?= json_encode($timezone) ?>,
            eventUtc: <?= json_encode($eventUtc) ?>,
            error: <?= json_encode($eventError) ?>,
            hasEvent: <?= json_encode($path !== '' && !$isLocationClock) ?>,
            isLocationClock: <?= json_encode($isLocationClock) ?>,
            countries: <?= json_encode($countryOptions) ?>
        };
    </script>

    <header class="topbar">
        <a class="brand" href="/" aria-label="Go to whenn.cc home">whenn.cc</a>
        <a class="github-link-card"
        href="https://github.com/MrFlacko/whenn.cc"
        target="_blank"
        rel="noopener"
        aria-label="View source on GitHub">
            <img src="https://cdn.simpleicons.org/github/ffffff" alt="" aria-hidden="true">
            <span>Git</span>
        </a>
    </header>

    <main class="page">
        <section class="hero">
            <section class="examples examples-card" aria-label="Example times">
                <div class="section-heading">
                    <p class="eyebrow">Examples</p>
                    <h2>Try these links</h2>
                </div>

<?php
// Small curated examples across the world. These use the site's URL format.
$examples = [
    ['country' => 'us', 'city' => 'new_york', 'label' => 'New York'],
    ['country' => 'gb', 'city' => 'london', 'label' => 'London'],
    ['country' => 'jp', 'city' => 'tokyo', 'label' => 'Tokyo'],
    ['country' => 'au', 'city' => 'sydney', 'label' => 'Sydney'],
    ['country' => 'ax', 'city' => 'utc', 'label' => 'UTC'],
];

$nowUtc = new DateTimeImmutable('now', new DateTimeZone('UTC'));
$tomorrow = $nowUtc->modify('+1 day');
$dateStr = $tomorrow->format('d-m-Y');
$timeStr = $nowUtc->format('Hi'); // use current UTC time so examples stay relevant
?>

                <details class="examples-mobile-accordion">
                    <summary>
                        <span>Show example links</span>
                        <span class="examples-mobile-arrow" aria-hidden="true">›</span>
                    </summary>
                    <div class="examples-mobile-list">
                        <div class="examples-mobile-list-inner">
<?php
foreach ($examples as $ex) {
    $href = sprintf('/%s/%s/%s/%s', $ex['country'], $ex['city'], $dateStr, $timeStr);
    $displayUrl = htmlspecialchars($href);
    $label = htmlspecialchars($ex['label']);
    echo '<a href="' . $displayUrl . '"><span class="ex-label">' . $label . '</span><small class="ex-url">' . $displayUrl . '</small></a>' . "\n";
}
?>
                        </div>
                    </div>
                </details>

                <div class="examples-footer">
<?php
foreach ($examples as $ex) {
    $href = sprintf('/%s/%s/%s/%s', $ex['country'], $ex['city'], $dateStr, $timeStr);
    $displayUrl = htmlspecialchars($href);
    $label = htmlspecialchars($ex['label']);
    echo '<a href="' . $displayUrl . '"><span class="ex-label">' . $label . '</span><small class="ex-url">' . $displayUrl . '</small></a>' . "\n";
}
?>
                </div>
            </section>

            <div class="hero-copy">
                <p class="eyebrow">whenn.cc</p>
                <h1>Share a time that makes sense everywhere.</h1>
                <p class="intro">Create a clean link for a meeting, stream, launch, call, or anything else with a fixed time. Pick a country and city, set the date, then send one link that converts automatically for whoever opens it.</p>

                <div class="mini-help" aria-label="How whenn.cc works">
                    <span><strong>1</strong><em>Place</em></span>
                    <span><strong>2</strong><em>Time</em></span>
                    <span><strong>3</strong><em>Copy</em></span>
                </div>
            </div>

            <section class="clock-card" aria-label="Shared event preview">
                <div class="clock-column">
                    <span class="date-label" id="eventTimeLabel">Selected Time</span>
                    <div class="time" id="eventTime">Loading...</div>
                    <div class="date" id="eventDate"></div>
                    <div class="location" id="eventLocation"><?= htmlspecialchars($displayLocation) ?></div>
                </div>

                <div class="time-difference-column route-only">
                    <span class="time-difference" id="timeDifference" hidden></span>
                </div>

                <div class="clock-column route-only">
                    <span class="date-label" id="localTimeLabel">Your Time</span>
                    <div class="time" id="localTime">Loading...</div>
                    <div class="date" id="localDate"></div>
                    <div class="location" id="location">Detecting location...</div>
                </div>

                <div class="timezone-control">
                    <label>
                        <span>Your country</span>
                        <select id="manualCountrySelect"></select>
                    </label>

                    <label>
                        <span>Your city / timezone</span>
                        <select id="manualCitySelect"></select>
                    </label>
                </div>

                <div class="current-time-link" id="currentTimePanel" hidden>
                    <span>Your Time:</span>
                    <a id="currentTimeLink" href="/"></a>
                    <button id="currentTimeCopyButton" type="button">Copy</button>
                </div>

                <div class="countdown-inline" aria-label="Countdown to event">
                    <div class="countdown-heading">
                        <span class="countdown-kicker">Countdown</span>
                        <div class="countdown-heading-row">
                            <strong class="countdown-title">Event starts in</strong>
                        </div>
                    </div>
                    <div class="countdown-grid-compact">
                        <div>
                            <strong id="countdownDays">--</strong>
                            <span>Days</span>
                        </div>
                        <div>
                            <strong id="countdownHours">--</strong>
                            <span>Hours</span>
                        </div>
                        <div>
                            <strong id="countdownMinutes">--</strong>
                            <span>Min</span>
                        </div>
                        <div>
                            <strong id="countdownSeconds">--</strong>
                            <span>Sec</span>
                        </div>
                    </div>
                </div>
            </section>

        </section>

        <section class="creator" aria-labelledby="creatorTitle">
            <div class="section-heading">
                <p class="eyebrow">Creator</p>
                <h2 id="creatorTitle">Create an Invite</h2>
            </div>

            <form class="creator-form" id="creatorForm">
                <label>
                    <span>Country</span>
                    <select id="countrySelect" required></select>
                </label>

                <label>
                    <span>City / timezone</span>
                    <select id="citySelect" required></select>
                </label>

                <label>
                    <span>Date</span>
                    <input id="dateInput" type="hidden" required>
                    <button class="date-picker-button" id="datePickerButton" type="button">
                        <span aria-hidden="true">📅</span>
                        <strong id="datePickerLabel">Select date</strong>
                    </button>
                </label>

                <label>
                    <span>Time</span>
                    <input id="timeInput" type="hidden" required>
                    <button class="time-picker-button" id="timePickerButton" type="button">
                        <span aria-hidden="true">🕒</span>
                        <strong id="timePickerLabel">--:--</strong>
                    </button>
                </label>

                <div class="link-note" id="resultPanel">
                    <span>Try yourself:</span>
                    <a id="createdLink" href="/"></a>
                </div>

                <div class="creator-actions">
                    <button class="calendar-button" type="button" id="addToCalendarButton">
                        <span aria-hidden="true">＋</span>
                        Add to Calendar
                    </button>
                    <button type="submit" id="createCopyButton">Copy Invite Link</button>
                </div>
            </form>
        </section>

        <div class="calendar-popover" id="calendarPopover" aria-hidden="true">
            <div class="calendar-popover-panel" role="dialog" aria-modal="true" aria-labelledby="calendarPopoverTitle">
                <button class="popover-close" id="calendarPopoverClose" type="button" aria-label="Close calendar invite">×</button>

                <div class="calendar-popover-header">
                    <span class="eyebrow">Calendar invite</span>
                    <h2 id="calendarPopoverTitle">Add this time to your calendar</h2>
                    <p>The date, time, and timezone come directly from your invite.</p>
                </div>

                <div class="calendar-event-preview" aria-label="Calendar event details">
                    <div>
                        <span>Country</span>
                        <strong id="calendarCountry">—</strong>
                    </div>
                    <div>
                        <span>City</span>
                        <strong id="calendarCity">—</strong>
                    </div>
                    <div>
                        <span>Date</span>
                        <strong id="calendarDate">—</strong>
                    </div>
                    <div>
                        <span>Time</span>
                        <strong id="calendarTime">—</strong>
                        <small id="calendarTimezone"></small>
                    </div>
                </div>

                <form class="calendar-form" id="calendarForm">
                    <label>
                        <span>Event name</span>
                        <input id="calendarName" type="text" maxlength="120" placeholder="Meeting, stream, launch…" required>
                    </label>

                    <label>
                        <span>Description <small>Optional</small></span>
                        <textarea id="calendarDescription" rows="4" maxlength="2000" placeholder="Add any useful details…"></textarea>
                    </label>

                    <div class="calendar-duration">
                        <div class="calendar-duration-heading">
                            <label for="calendarDuration">Duration</label>
                            <output id="calendarDurationOutput" for="calendarDuration">1 hour</output>
                        </div>
                        <input id="calendarDuration" type="range" min="15" max="480" step="15" value="60">
                        <div class="calendar-duration-scale" aria-hidden="true">
                            <span>15 min</span>
                            <span>8 hours</span>
                        </div>
                    </div>

                    <div class="calendar-provider" id="calendarProvider" hidden>
                        <button class="calendar-download-button" id="calendarOpenButton" type="button">Open Calendar</button>
                    </div>
                    <button class="calendar-download-button" id="calendarDownloadFallback" type="submit">Download Invite</button>
                </form>
            </div>
        </div>

        <div class="country-picker" id="countryPicker" aria-hidden="true">
            <div class="country-picker-panel" role="dialog" aria-modal="true" aria-labelledby="countryPickerTitle">
                <div class="country-picker-header">
                    <div>
                        <span>Country</span>
                        <strong id="countryPickerTitle">Choose a country</strong>
                    </div>
                    <button class="popover-close" id="countryPickerClose" type="button" aria-label="Close country picker">×</button>
                </div>

                <label class="country-search">
                    <span class="sr-only">Search countries</span>
                    <input id="countrySearchInput" type="search" placeholder="Search countries…" autocomplete="off" spellcheck="false">
                </label>

                <div class="country-results" id="countryResults" role="listbox" aria-label="Countries"></div>
                <p class="country-empty" id="countryEmpty" hidden>No countries found.</p>
            </div>
        </div>

        <div class="country-picker" id="cityPicker" aria-hidden="true">
            <div class="country-picker-panel" role="dialog" aria-modal="true" aria-labelledby="cityPickerTitle">
                <div class="country-picker-header">
                    <div>
                        <span>City / timezone</span>
                        <strong id="cityPickerTitle">Choose a city</strong>
                    </div>
                    <button class="popover-close" id="cityPickerClose" type="button" aria-label="Close city picker">×</button>
                </div>

                <label class="country-search">
                    <span class="sr-only">Search cities</span>
                    <input id="citySearchInput" type="search" placeholder="Search cities…" autocomplete="off" spellcheck="false">
                </label>

                <div class="country-results" id="cityResults" role="listbox" aria-label="Cities and timezones"></div>
                <p class="country-empty" id="cityEmpty" hidden>No cities found.</p>
            </div>
        </div>

        <div class="date-popover" id="datePopover" aria-hidden="true">
            <div class="date-popover-panel" role="dialog" aria-label="Pick a date">
                <button class="popover-close" id="datePickerClose" type="button" aria-label="Close date picker">×</button>

                <div class="picker-header">
                    <div>
                        <span>Selected date</span>
                        <strong id="datePickerReadout">Today</strong>
                    </div>
                </div>

                <div class="date-panel">
                    <div class="date-year-bar">
                        <button type="button" id="prevYearButton" aria-label="Previous year">‹</button>
                        <strong id="calendarYearLabel">2026</strong>
                        <button type="button" id="nextYearButton" aria-label="Next year">›</button>
                    </div>

                    <div class="date-month-bar">
                        <button type="button" id="prevMonthButton" aria-label="Previous month">‹</button>
                        <strong id="calendarMonthLabel">June 2026</strong>
                        <button type="button" id="nextMonthButton" aria-label="Next month">›</button>
                    </div>

                    <div class="calendar-weekdays" aria-hidden="true">
                        <span>Sun</span>
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                        <span>Sat</span>
                    </div>

                    <div class="calendar-grid" id="calendarGrid"></div>
                </div>

                <div class="picker-actions">
                    <button type="button" id="datePickerCancel">Cancel</button>
                    <button type="button" id="datePickerToday">Today</button>
                </div>
            </div>
        </div>

        <div class="time-popover" id="timePopover" aria-hidden="true">
            <div class="time-popover-panel" role="dialog" aria-label="Pick a time">
                <button class="popover-close" id="timePickerClose" type="button" aria-label="Close time picker">×</button>

                <div class="picker-header">
                    <div>
                        <span>Selected time</span>
                        <strong id="pickerReadout">09:00</strong>
                    </div>
                </div>

                <div class="mobile-wheel-picker" aria-label="Pick a time with wheels">
                    <div class="wheel-stage">
                        <div class="time-wheel" id="mobileHourWheel" aria-label="Hour"></div>
                        <div class="time-wheel-divider" aria-hidden="true">:</div>
                        <div class="time-wheel" id="mobileMinuteWheel" aria-label="Minute"></div>
                    </div>

                    <div class="mobile-minute-chips" aria-label="Quick minute choices">
                        <button type="button" data-minute="00">:00</button>
                        <button type="button" data-minute="15">:15</button>
                        <button type="button" data-minute="30">:30</button>
                        <button type="button" data-minute="45">:45</button>
                    </div>

                    <div class="mobile-time-options">
                        <div class="mobile-format-toggle" aria-label="Hour display">
                            <button type="button" data-hour-format="12">12h</button>
                            <button type="button" data-hour-format="24">24h</button>
                        </div>

                        <div class="mobile-ampm-toggle" id="mobileAmpmToggle" aria-label="AM or PM">
                            <button type="button" data-mobile-ampm="AM">AM</button>
                            <button type="button" data-mobile-ampm="PM">PM</button>
                        </div>
                    </div>
                </div>

                <div class="picker-face">
                    <div class="dial-group dial-panel">
                        <div class="dial-heading">
                            <div>
                                <span>Hour</span>
                                <strong id="hourValue">09</strong>
                            </div>
                            <div class="picker-mode-toggle" aria-label="Hour display">
                                <button class="is-active" type="button" data-hour-format="24">24h</button>
                                <button type="button" data-hour-format="12">12h</button>
                            </div>
                        </div>

                        <div class="clock-dial hour-mode-24" id="hourDial" data-picker-mode="hour">
                            <span class="hour-outer" style="--i:0">00</span>
                            <span class="hour-outer" style="--i:1">01</span>
                            <span class="hour-outer" style="--i:2">02</span>
                            <span class="hour-outer" style="--i:3">03</span>
                            <span class="hour-outer" style="--i:4">04</span>
                            <span class="hour-outer" style="--i:5">05</span>
                            <span class="hour-outer" style="--i:6">06</span>
                            <span class="hour-outer" style="--i:7">07</span>
                            <span class="hour-outer" style="--i:8">08</span>
                            <span class="hour-outer" style="--i:9">09</span>
                            <span class="hour-outer" style="--i:10">10</span>
                            <span class="hour-outer" style="--i:11">11</span>
                            <span class="hour-outer" style="--i:12">12</span>
                            <span class="hour-outer" style="--i:13">13</span>
                            <span class="hour-outer" style="--i:14">14</span>
                            <span class="hour-outer" style="--i:15">15</span>
                            <span class="hour-outer" style="--i:16">16</span>
                            <span class="hour-outer" style="--i:17">17</span>
                            <span class="hour-outer" style="--i:18">18</span>
                            <span class="hour-outer" style="--i:19">19</span>
                            <span class="hour-outer" style="--i:20">20</span>
                            <span class="hour-outer" style="--i:21">21</span>
                            <span class="hour-outer" style="--i:22">22</span>
                            <span class="hour-outer" style="--i:23">23</span>
                            <span class="hour-inner" style="--i:0">12</span>
                            <span class="hour-inner" style="--i:1">1</span>
                            <span class="hour-inner" style="--i:2">2</span>
                            <span class="hour-inner" style="--i:3">3</span>
                            <span class="hour-inner" style="--i:4">4</span>
                            <span class="hour-inner" style="--i:5">5</span>
                            <span class="hour-inner" style="--i:6">6</span>
                            <span class="hour-inner" style="--i:7">7</span>
                            <span class="hour-inner" style="--i:8">8</span>
                            <span class="hour-inner" style="--i:9">9</span>
                            <span class="hour-inner" style="--i:10">10</span>
                            <span class="hour-inner" style="--i:11">11</span>
                            <div class="clock-hand hour-hand" id="hourHand"></div>
                            <div class="clock-pin"></div>
                        </div>

                        <div class="dial-stepper">
                            <button type="button" id="hourDown">-</button>
                            <button type="button" id="hourUp">+</button>
                        </div>

                        <div class="ampm-toggle" id="ampmToggle" aria-label="AM or PM">
                            <button type="button" data-ampm="AM">AM</button>
                            <button type="button" data-ampm="PM">PM</button>
                        </div>
                    </div>

                    <div class="dial-group dial-panel">
                        <div class="dial-heading">
                            <span>Minute</span>
                            <strong id="minuteValue">00</strong>
                        </div>

                        <div class="minute-dial-wrap">
                            <div class="clock-dial" id="minuteDial" data-picker-mode="minute">
                                <span style="--i:0">00</span>
                                <span style="--i:1">05</span>
                                <span style="--i:2">10</span>
                                <span style="--i:3">15</span>
                                <span style="--i:4">20</span>
                                <span style="--i:5">25</span>
                                <span style="--i:6">30</span>
                                <span style="--i:7">35</span>
                                <span style="--i:8">40</span>
                                <span style="--i:9">45</span>
                                <span style="--i:10">50</span>
                                <span style="--i:11">55</span>
                                <div class="clock-hand minute-hand" id="minuteHand"></div>
                                <div class="clock-pin"></div>
                            </div>
                            <div class="minute-nudges" aria-label="Adjust minute">
                                <button type="button" id="minuteUp">+</button>
                                <button type="button" id="minuteDown">-</button>
                            </div>
                        </div>

                        <div class="minute-chips" aria-label="Quick minute choices">
                            <button type="button" data-minute="00">:00</button>
                            <button type="button" data-minute="15">:15</button>
                            <button type="button" data-minute="30">:30</button>
                            <button type="button" data-minute="45">:45</button>
                        </div>
                    </div>
                </div>

                <div class="picker-actions">
                    <button type="button" id="timePickerCancel">Cancel</button>
                    <button type="button" id="timePickerDone">Done</button>
                </div>
            </div>
        </div>
    </main>

    <!--
        Classic deferred scripts share state; dependency order is intentional.
        shared.js must remain first and app.js must remain last.
    -->
    <script src="/js/shared.js" defer></script>
    <script src="/js/install-prompt.js" defer></script>
    <script src="/js/time-picker.js" defer></script>
    <script src="/js/date-picker.js" defer></script>
    <script src="/js/location-pickers.js" defer></script>
    <script src="/js/calendar.js" defer></script>
    <script src="/js/clock.js" defer></script>
    <script src="/js/examples.js" defer></script>
    <script src="/js/select-controls.js" defer></script>
    <script src="/js/creator.js" defer></script>
    <script src="/js/app.js" defer></script>

</body>

</html>
