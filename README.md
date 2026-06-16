<h2 align="center">
  <a href="https://whenn.cc">https://whenn.cc</a>
</h2>

> Hey bro, I finish work at 5:45pm but I'm in London. Here's when I'm free: [https://whenn.cc/gb/london/16-06-2042/1745](https://whenn.cc/gb/london/16-06-2042/1745)

<img width="1295" height="706" alt="image" src="https://github.com/user-attachments/assets/6eee63d9-299b-4471-9caf-4aa5096a9b29" />

---

## What it is
**whenn.cc** is a simple time-sharing website for sending someone a date and time in your timezone, then showing it in their local time.
Useful for Discord, online friends, gaming sessions, meetings, calls, or anything where people are in different countries.

---

## What it does
Create a link with a country, city, date, and time.

When someone opens it, **whenn.cc** shows the original time, their local time, and the countdown.
It uses the IP address of the person accessing the website to estimate their timezone. From what I've seen it's quite accurate. However if you're using a VPN connection you can manually set the time.

---

## Example links
| Location | Link |
|---|---|
| Sydney, Australia | [https://whenn.cc/au/sydney/16-06-2042/1745](https://whenn.cc/au/sydney/16-06-2042/1745) |
| Australia country-only | [https://whenn.cc/au/16-06-2042/1745](https://whenn.cc/au/16-06-2042/1745) |
| Cebu, Philippines | [https://whenn.cc/ph/cebu/16-06-2042/1745](https://whenn.cc/ph/cebu/16-06-2042/1745) |
| New York, United States | [https://whenn.cc/us/new-york/16-06-2042/1745](https://whenn.cc/us/new-york/16-06-2042/1745) |
| London, United Kingdom | [https://whenn.cc/gb/london/16-06-2042/1745](https://whenn.cc/gb/london/16-06-2042/1745) |
| Tokyo, Japan | [https://whenn.cc/jp/tokyo/16-06-2042/1745](https://whenn.cc/jp/tokyo/16-06-2042/1745) |

---

## Data source
Country data is based on the excellent [mledoze/countries](https://github.com/mledoze/countries) dataset.

## URL format
```text
https://whenn.cc/{countryOrcountrycode}/{city}/{dateDDMMYYYY}/{timeHHMM}
https://whenn.cc/{countryOrcountrycode}/{dateDDMMYYYY}/{timeHHMM}
