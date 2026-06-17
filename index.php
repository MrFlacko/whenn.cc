<?php

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

function normalize_slug(string $value): string
{
    $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    $value = is_string($converted) ? $converted : $value;

    return preg_replace('/[^a-z0-9]+/', '', strtolower($value)) ?: '';
}

function url_slug(string $value): string
{
    $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    $value = is_string($converted) ? $converted : $value;

    return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($value)), '-');
}

function city_label_from_timezone(string $timezone): string
{
    $parts = explode('/', $timezone);
    return str_replace('_', ' ', end($parts));
}

function city_slug_from_timezone(string $timezone): string
{
    return strtolower(str_replace(' ', '_', city_label_from_timezone($timezone)));
}

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

function timezones_for_country(string $code): array
{
    try {
        $zones = DateTimeZone::listIdentifiers(DateTimeZone::PER_COUNTRY, strtoupper($code));
    } catch (Throwable $error) {
        $zones = [];
    }

    return array_values(array_filter($zones, function (string $timezone): bool {
        return count(explode('/', $timezone)) >= 2;
    }));
}

function resolve_timezone(string $city, ?array $countryData = null): ?string
{
    $cityKey = normalize_slug($city);
    $countryZones = $countryData ? timezones_for_country($countryData['cca2'] ?? '') : [];
    $zones = $countryZones ?: DateTimeZone::listIdentifiers();

    if ($cityKey === '') {
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

$timezone = resolve_timezone($city, $countryData);
$eventUtc = null;
$eventError = null;
$displayLocation = '';

if ($date !== '' || $time !== '' || $city !== '' || $countryInput !== '') {
    if (!$countryData) {
        $eventError = 'Unknown country';
    } elseif (!$timezone) {
        $eventError = 'Unknown city or timezone';
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

if ($timezone) {
    $displayLocation = city_label_from_timezone($timezone);
} elseif ($city !== '') {
    $displayLocation = ucwords(str_replace(['-', '_'], ' ', $city));
}

if ($countryData) {
    $displayLocation .= ($displayLocation !== '' ? ', ' : '') . $countryData['name']['common'];
}

$cssPath = __DIR__ . '/css/style.css';
$jsPath = __DIR__ . '/js/app.js';
?>
<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>when.cc</title>
    <style>
        <?php readfile($cssPath); ?>
    </style>
</head>

<body class="<?= $path !== '' ? 'has-event' : 'home-page' ?>">

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
            hasEvent: <?= json_encode($path !== '') ?>,
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

                <div class="swap-mark route-only" aria-hidden="true">›</div>

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

                <button type="submit" id="createCopyButton">Copy Invite Link</button>
            </form>

            <div class="link-note" id="resultPanel">
                <span>Generated link:</span>
                <a id="createdLink" href="/"></a>
            </div>
        </section>

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

    <script>
<?php readfile($jsPath); ?>
    </script>

</body>

</html>
