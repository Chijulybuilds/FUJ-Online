export type Person = { id: string; name: string; phone: string; email: string; status: "Member" | "Visitor"; department: string; joined: string; attendance: string };
export const people: Person[] = [
  { id:"FOJ-001", name:"Grace Okafor", phone:"+234 803 123 4567", email:"grace@example.com", status:"Member", department:"Choir", joined:"12 Jan 2024", attendance:"Present" },
  { id:"FOJ-002", name:"David Nwosu", phone:"+234 806 234 5678", email:"david@example.com", status:"Member", department:"Ushering", joined:"03 Mar 2023", attendance:"Present" },
  { id:"FOJ-003", name:"Amara Eze", phone:"+234 809 345 6789", email:"amara@example.com", status:"Visitor", department:"—", joined:"20 Oct 2026", attendance:"First visit" },
  { id:"FOJ-004", name:"Samuel James", phone:"+234 802 456 7890", email:"samuel@example.com", status:"Member", department:"Media", joined:"18 Jun 2022", attendance:"Absent" },
  { id:"FOJ-005", name:"Esther Bello", phone:"+234 805 567 8901", email:"esther@example.com", status:"Member", department:"Protocol", joined:"09 Sep 2024", attendance:"Present" },
  { id:"FOJ-006", name:"Daniel Peter", phone:"+234 807 678 9012", email:"daniel@example.com", status:"Visitor", department:"—", joined:"27 Oct 2026", attendance:"Present" }
];
export const services = [
  { id:"SVC-026", name:"Sunday Celebration Service", date:"Sunday, 08 Nov 2026", time:"9:00 AM", status:"Upcoming", attendance:"—" },
  { id:"SVC-025", name:"Sunday Celebration Service", date:"Sunday, 01 Nov 2026", time:"9:00 AM", status:"Completed", attendance:"248" },
  { id:"SVC-024", name:"Midweek Bible Study", date:"Wednesday, 28 Oct 2026", time:"5:30 PM", status:"Completed", attendance:"86" },
  { id:"SVC-023", name:"Sunday Celebration Service", date:"Sunday, 25 Oct 2026", time:"9:00 AM", status:"Completed", attendance:"231" }
];
export const followUps = [
  { name:"Samuel James", reason:"Missed 3 consecutive services", priority:"High", assigned:"Pastoral Team" },
  { name:"Blessing Adebayo", reason:"Missed 2 consecutive services", priority:"Normal", assigned:"Sis. Grace" },
  { name:"Michael Obi", reason:"First-time visitor follow-up", priority:"Normal", assigned:"Bro. David" }
];
export const announcements = [
  { title:"November Thanksgiving Service", audience:"All members", date:"02 Nov 2026", status:"Published" },
  { title:"Workers' Prayer Meeting", audience:"Ministry workers", date:"01 Nov 2026", status:"Published" },
  { title:"New Members' Welcome Class", audience:"New members", date:"30 Oct 2026", status:"Draft" }
];
