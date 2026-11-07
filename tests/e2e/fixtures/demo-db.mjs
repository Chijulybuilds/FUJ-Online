// @ts-check
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

function normalizePhone(input) {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return `+234${digits.slice(1)}`;
  return `+${digits}`;
}


/**
 * TEST-ONLY sample data for the Playwright end-to-end suite. It is written to a throwaway
 * database file before the test server starts and is never part of the app itself.
 * All names, numbers and amounts here are fictional test fixtures.
 */
export function buildFixture() {
  const now = new Date();
  const iso = (d) => d.toISOString();
  const daysAgo = (n) => new Date(now.getTime() - n * 86400000);
  let n = 0;
  const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

  const lastSunday = new Date(now);
  lastSunday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 7) % 7 || 7));
  lastSunday.setUTCHours(8, 0, 0, 0); // 9:00 Lagos

  const peopleSeed = [
    ["Grace Okafor", "08031234567", "flaggrace101", "member", 700],
    ["David Nwosu", "08062345678", "flagdavid102", "member", 900],
    ["Amara Eze", "08093456789", "flagamara103", "visitor", 10],
    ["Samuel James", "08024567890", "flagsamuel104", "member", 1200],
    ["Esther Bello", "08055678901", "flagesther105", "member", 400],
    ["Daniel Peter", "08076789012", "flagdaniel106", "visitor", 6],
    ["Blessing Adebayo", "08087890123", "flagblessing107", "member", 600],
    ["Michael Obi", "08098901234", "flagmichael108", "member", 300],
    ["Joy Chukwu", "08019012345", "flagjoy109", "member", 500],
    ["Peter Okon", "08020123456", "flagpeter110", "member", 800]
  ];
  const people = peopleSeed.map(([name, phone, username, status, joined], i) => ({
    id: id(), person_code: `FOJ-${String(i + 1).padStart(4, "0")}`, username, full_name: name, phone,
    normalized_phone: normalizePhone(phone), email: `${username.replace("flag", "")}@example.com`, status,
    first_visit_at: iso(daysAgo(joined)), joined_at: status === "member" ? iso(daysAgo(joined)) : null, notes: null,
    auth_subject: null, avatar_url: null, gender: null, birthday: null, address: null, how_heard: null,
    last_seen_at: null, whatsapp: i % 4 === 3 ? "no" : i % 2 === 0 ? "yes" : "unknown", whatsapp_checked_at: null,
    verified_via: "in_person", verified_at: iso(daysAgo(joined)),
    created_at: iso(daysAgo(joined)), updated_at: iso(daysAgo(joined))
  }));

  const services = [];
  for (let w = 5; w >= 0; w--) {
    const start = new Date(lastSunday.getTime() - w * 7 * 86400000);
    services.push({
      id: id(), title: "Sunday Celebration Service", description: null, category: "Sunday worship", location: "Main auditorium",
      starts_at: iso(start), ends_at: iso(new Date(start.getTime() + 3 * 3600000)), check_in_opens_at: null, check_in_closes_at: null,
      status: "completed", created_at: iso(daysAgo(60)), updated_at: iso(daysAgo(1))
    });
  }
  const nextSunday = new Date(lastSunday.getTime() + 7 * 86400000);
  services.push({
    id: id(), title: "Sunday Celebration Service", description: "Thanksgiving Sunday", category: "Sunday worship", location: "Main auditorium",
    starts_at: iso(nextSunday), ends_at: iso(new Date(nextSunday.getTime() + 3 * 3600000)), check_in_opens_at: null, check_in_closes_at: null,
    status: "scheduled", created_at: iso(daysAgo(3)), updated_at: iso(daysAgo(3))
  });
  const wed = new Date(lastSunday.getTime() + 3 * 86400000 + 8.5 * 3600000);
  services.push({
    id: id(), title: "Midweek Bible Study", description: null, category: "Bible study", location: "Main auditorium",
    starts_at: iso(wed), ends_at: iso(new Date(wed.getTime() + 2 * 3600000)), check_in_opens_at: null, check_in_closes_at: null,
    status: wed < now ? "completed" : "scheduled", created_at: iso(daysAgo(10)), updated_at: iso(daysAgo(1))
  });

  // Attendance pattern: Samuel (3) and Blessing (6) stop attending recently -> absentee follow-ups.
  const attendance = [];
  const sundays = services.filter((s) => s.status === "completed" && s.category === "Sunday worship");
  sundays.forEach((svc, w) => {
    people.forEach((p, i) => {
      if (p.status === "visitor" && w < sundays.length - 1) return; // visitors only came last Sunday
      if ((i === 3 || i === 6) && w >= sundays.length - 2) return;
      if ((i + w) % 7 === 5) return; // occasional absence
      attendance.push({
        id: id(), person_id: p.id, service_id: svc.id,
        checked_in_at: iso(new Date(new Date(svc.starts_at).getTime() + (i * 3 + 5) * 60000)),
        check_in_method: "qr", recorded_by: null, device_id: null, created_at: iso(new Date(svc.starts_at))
      });
    });
  });

  const midweek = services[services.length - 1];
  if (midweek.status === "completed") {
    people.filter((p) => p.status === "member").slice(0, 5).forEach((p, i) => attendance.push({
      id: id(), person_id: p.id, service_id: midweek.id, checked_in_at: iso(new Date(new Date(midweek.starts_at).getTime() + (i + 2) * 60000)),
      check_in_method: "qr", recorded_by: null, device_id: null, created_at: iso(new Date(midweek.starts_at))
    }));
  }


  const stamp = iso(daysAgo(400));
  const admin_users = ([
    ["admin@flagupjesus.local", "Church Admin", "super_admin"],
    ["pastor@flagupjesus.local", "Pastor John", "pastor"],
    ["care@flagupjesus.local", "Sis. Grace (Care)", "pastoral_worker"],
    ["finance@flagupjesus.local", "Finance Desk", "finance_admin"],
    ["usher@flagupjesus.local", "Head Usher", "department_leader"]
  ]).map(([email, full_name, role]) => ({ id: id(), email, full_name, role, active: true, last_login_at: null, created_at: stamp }));

  return {
    church_settings: [{
      id: true, church_name: "FlagUpJesus Global Ministry", app_name: "FlagUpJesus", timezone: "Africa/Lagos",
      contact_email: null, contact_phone: null, tagline: "Test tagline",
      address: null,
      service_times: "Word Experience (Sunday Service)|Sundays · 9:00 AM\nBible Study|Wednesdays · 5:30 PM\nPrayer Meeting|Fridays · 6:00 PM",
      livestream_url: "https://example.org/live", bank_name: "Fidelity Bank", account_name: "FlagUp Jesus Global Ministry",
      account_number: "5600605313", absence_threshold: 2, created_at: stamp, updated_at: stamp
    }],
    admin_users, people, services, attendance,
    announcements: [
      { id: id(), title: "Thanksgiving Sunday", body: "Join us this Sunday as we give thanks to God for His faithfulness. Come with a friend!", audience: "all", status: "published", published_at: iso(daysAgo(2)), pinned: true, is_public: true, author: "Church Admin", created_at: iso(daysAgo(2)), updated_at: iso(daysAgo(2)) },
      { id: id(), title: "Workers' Prayer Meeting", body: "All workers should gather on Saturday at 7:00 AM for prayer.", audience: "members", status: "published", published_at: iso(daysAgo(5)), pinned: false, is_public: false, author: "Pastor John", created_at: iso(daysAgo(5)), updated_at: iso(daysAgo(5)) },
      { id: id(), title: "New Members' Welcome Class", body: "Our next welcome class holds after the second service.", audience: "visitors", status: "draft", published_at: null, pinned: false, is_public: true, author: "Church Admin", created_at: iso(daysAgo(1)), updated_at: iso(daysAgo(1)) }
    ],
    prayer_requests: [
      { id: id(), person_id: people[0].id, request_text: "Please pray for my mother's healing and quick recovery.", visibility: "public", status: "praying", consent_to_share: true, requester_name: null, requester_contact: null, is_anonymous: false, prayed_count: 14, admin_note: null, assignee: null, on_wall: true, created_at: iso(daysAgo(4)), updated_at: iso(daysAgo(4)) },
      { id: id(), person_id: people[4].id, request_text: "Guidance concerning a new job opportunity.", visibility: "pastoral", status: "pending", consent_to_share: false, requester_name: null, requester_contact: null, is_anonymous: false, prayed_count: 0, admin_note: null, assignee: null, on_wall: false, created_at: iso(daysAgo(1)), updated_at: iso(daysAgo(1)) }
    ],
    testimonies: [
      { id: id(), person_id: people[1].id, title: "God provided a new job", body: "After months of searching, God opened a door I did not expect. I am grateful to this church family for standing with me in prayer.", consent_to_publish: true, status: "published", featured: true, published_at: iso(daysAgo(6)), reviewer: "Pastor John", created_at: iso(daysAgo(8)) },
      { id: id(), person_id: people[8].id, title: "Safe delivery", body: "We welcomed our baby girl safely. Thank you Jesus!", consent_to_publish: true, status: "published", featured: false, published_at: iso(daysAgo(12)), reviewer: "Pastor John", created_at: iso(daysAgo(13)) },
      { id: id(), person_id: people[7].id, title: "Healed from malaria", body: "I was very sick but the Lord restored my health within days.", consent_to_publish: true, status: "pending", featured: false, published_at: null, reviewer: null, created_at: iso(daysAgo(1)) }
    ],
    donations: [
      { id: id(), person_id: people[0].id, amount: 50000, currency: "NGN", fund_name: "Tithe", status: "paid", provider_reference: null, paid_at: iso(daysAgo(1)), method: "transfer", note: null, donor_name: null, recorded_by: "Finance Desk", created_at: iso(daysAgo(6)) },
      { id: id(), person_id: people[1].id, amount: 20000, currency: "NGN", fund_name: "Offering", status: "paid", provider_reference: null, paid_at: iso(daysAgo(1)), method: "cash", note: null, donor_name: null, recorded_by: "Finance Desk", created_at: iso(daysAgo(6)) },
      { id: id(), person_id: null, amount: 100000, currency: "NGN", fund_name: "Building fund", status: "paid", provider_reference: null, paid_at: iso(daysAgo(20)), method: "transfer", note: "Anonymous", donor_name: "Anonymous", recorded_by: "Finance Desk", created_at: iso(daysAgo(20)) }
    ]
  };
}

const out = process.argv[2];
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  const empty = { people: [], otp_codes: [], services: [], qr_sessions: [], attendance: [], follow_up_tasks: [], follow_up_logs: [], announcements: [], prayer_requests: [], testimonies: [], donations: [], broadcasts: [], broadcast_recipients: [], admin_users: [], church_settings: [], audit_logs: [] };
  writeFileSync(out, JSON.stringify({ ...empty, ...buildFixture() }, null, 1));
}
