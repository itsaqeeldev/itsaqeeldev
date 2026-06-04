const fs = require("fs");

const username = process.env.GITHUB_USERNAME;
const token = process.env.GH_TOKEN;

if (!username) throw new Error("Missing GITHUB_USERNAME");
if (!token) throw new Error("Missing GH_TOKEN / STATS_TOKEN");

async function graphql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "profile-streak-card",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error(JSON.stringify(json, null, 2));
    throw new Error("GitHub GraphQL request failed");
  }

  return json.data;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

async function main() {
  const userData = await graphql(
    `
      query($login: String!) {
        user(login: $login) {
          createdAt
        }
      }
    `,
    { login: username }
  );

  const createdAt = new Date(userData.user.createdAt);
  const startYear = createdAt.getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();

  const contributionsByDate = new Map();

  for (let year = startYear; year <= currentYear; year++) {
    const from = `${year}-01-01T00:00:00Z`;
    const to = `${year}-12-31T23:59:59Z`;

    const data = await graphql(
      `
        query($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) {
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar {
                weeks {
                  contributionDays {
                    date
                    contributionCount
                  }
                }
              }
            }
          }
        }
      `,
      { login: username, from, to }
    );

    const weeks = data.user.contributionsCollection.contributionCalendar.weeks;

    for (const week of weeks) {
      for (const day of week.contributionDays) {
        contributionsByDate.set(day.date, day.contributionCount);
      }
    }
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  let totalContributions = 0;
  let longestStreak = 0;
  let runningStreak = 0;

  for (
    let d = new Date(Date.UTC(startYear, 0, 1));
    d <= todayUtc;
    d = addDays(d, 1)
  ) {
    const count = contributionsByDate.get(dateKey(d)) || 0;
    totalContributions += count;

    if (count > 0) {
      runningStreak++;
      longestStreak = Math.max(longestStreak, runningStreak);
    } else {
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  let cursor = new Date(todayUtc);

  if ((contributionsByDate.get(dateKey(cursor)) || 0) === 0) {
    cursor = addDays(cursor, -1);
  }

  while ((contributionsByDate.get(dateKey(cursor)) || 0) > 0) {
    currentStreak++;
    cursor = addDays(cursor, -1);
  }

const svg = `
<svg width="840" height="250" viewBox="0 0 840 250" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="840" y2="250" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#050816"/>
      <stop offset="0.55" stop-color="#0A1023"/>
      <stop offset="1" stop-color="#071427"/>
    </linearGradient>

    <linearGradient id="cyanGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#00F0FF"/>
      <stop offset="1" stop-color="#00A3FF"/>
    </linearGradient>

    <linearGradient id="purpleGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5CE1FF"/>
      <stop offset="1" stop-color="#7C4DFF"/>
    </linearGradient>

    <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <filter id="panelGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="840" height="250" rx="26" fill="url(#bg)"/>
  <rect x="1" y="1" width="838" height="248" rx="25" stroke="#15304D"/>

  <!-- Outer glow lines -->
  <rect x="24" y="22" width="792" height="3" rx="1.5" fill="url(#cyanGlow)" filter="url(#softGlow)"/>
  <rect x="24" y="225" width="792" height="2" rx="1" fill="url(#purpleGlow)" opacity="0.7" filter="url(#softGlow)"/>

  <!-- Corner accents -->
  <path d="M24 42V24H42" stroke="#00E5FF" stroke-width="2"/>
  <path d="M798 24H816V42" stroke="#00E5FF" stroke-width="2"/>
  <path d="M24 208V226H42" stroke="#7C4DFF" stroke-width="2"/>
  <path d="M798 226H816V208" stroke="#7C4DFF" stroke-width="2"/>

  <!-- Header -->
  <text x="420" y="50" text-anchor="middle" fill="#D9F7FF" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="800" letter-spacing="1">
    GITHUB ACTIVITY
  </text>
 

  <!-- Decorative line -->
  <line x1="290" y1="84" x2="550" y2="84" stroke="#113A56" stroke-width="1.5"/>
  <circle cx="420" cy="84" r="3" fill="#00E5FF" filter="url(#softGlow)"/>

  <!-- Panels -->
  <g filter="url(#panelGlow)">
    <rect x="28" y="105" width="244" height="102" rx="18" fill="#091426"/>
    <rect x="28.8" y="105.8" width="242.4" height="100.4" rx="17.2" stroke="#103B5D"/>
    
    <rect x="298" y="105" width="244" height="102" rx="18" fill="#091426"/>
    <rect x="298.8" y="105.8" width="242.4" height="100.4" rx="17.2" stroke="#103B5D"/>
    
    <rect x="568" y="105" width="244" height="102" rx="18" fill="#091426"/>
    <rect x="568.8" y="105.8" width="242.4" height="100.4" rx="17.2" stroke="#103B5D"/>
  </g>

  <!-- Panel accent bars -->
  <rect x="42" y="118" width="56" height="3" rx="1.5" fill="#00E5FF" filter="url(#softGlow)"/>
  <rect x="312" y="118" width="56" height="3" rx="1.5" fill="#38BDF8" filter="url(#softGlow)"/>
  <rect x="582" y="118" width="56" height="3" rx="1.5" fill="#7C4DFF" filter="url(#softGlow)"/>

  <!-- Labels -->
  <text x="42" y="141" fill="#7FC8DC" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="1">
    TOTAL CONTRIBUTIONS
  </text>
  <text x="312" y="141" fill="#7FC8DC" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="1">
    CURRENT STREAK
  </text>
  <text x="582" y="141" fill="#7FC8DC" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="1">
    LONGEST STREAK
  </text>

  <!-- Values -->
  <text x="150" y="181" text-anchor="middle" fill="#F4FEFF" font-family="Segoe UI, Arial, sans-serif" font-size="35" font-weight="900">
    ${formatNumber(totalContributions)}
  </text>

  <text x="420" y="181" text-anchor="middle" fill="#F4FEFF" font-family="Segoe UI, Arial, sans-serif" font-size="35" font-weight="900">
    ${formatNumber(currentStreak)}
  </text>

  <text x="690" y="181" text-anchor="middle" fill="#F4FEFF" font-family="Segoe UI, Arial, sans-serif" font-size="35" font-weight="900">
    ${formatNumber(longestStreak)}
  </text>

  <!-- Footer -->
  <text x="420" y="233" text-anchor="middle" fill="#5B8AA5" font-family="Segoe UI, Arial, sans-serif" font-size="11" letter-spacing="1">
   VIA GITHUB 
  </text>
</svg>`.trim();

  fs.mkdirSync("assets", { recursive: true });
  fs.writeFileSync("assets/github-streak.svg", svg);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

