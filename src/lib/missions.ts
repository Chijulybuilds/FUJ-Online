import { PHOTOS } from "@/components/landing/photos";
import { AKPAJO_2023, BAYELSA_2024, LAGOS_2025, NKPOLU_2024, OKPORO_2020, RUMUKWURUSHI_2021, SAGBAMA_2026 } from "./mission-photos";

/**
 * Love Missions — where FlagUpJesus has been and what happened there. Each location (a pin on the map) has
 * areas (local government areas / communities), and each area has outreaches with their photos.
 * Photos live in public/images/missions/<location>/… — add a new outreach by adding an entry below.
 */
export type MissionPhoto = { src: string; alt: string; w: number; h: number };
export type Outreach = { title: string; year?: number; summary?: string; photos: MissionPhoto[] };
export type MissionArea = { name: string; outreaches: Outreach[] };
export type MissionLocation = {
  slug: string; name: string; region: string; country: "Nigeria" | "United Kingdom"; tagline: string; summary: string;
  /** Position on the map: longitude / latitude inside Nigeria, or a fixed spot above it (the UK). */
  lonlat?: [number, number]; xy?: [number, number]; hq?: boolean; labelDx: number; labelDy: number; areas: MissionArea[];
};

export const MISSION_LOCATIONS: MissionLocation[] = [
  {
    slug: "port-harcourt", name: "Port Harcourt", region: "Rivers State", country: "Nigeria", hq: true, lonlat: [7.0, 4.82], labelDx: 12, labelDy: 18,
    tagline: "The Headquarters of Love",
    summary: "Where FlagUpJesus began — and where the FlagUp Jesus Army keeps going out into communities across Rivers State with free medical care, food and the gospel.",
    // Newest first.
    areas: [{
      name: "Nkpolu",
      outreaches: [{
        title: "Nkpolu Outreach", year: 2024,
        summary: "Food and relief, free medical care and the gospel for families in Nkpolu, Port Harcourt.",
        photos: NKPOLU_2024
      }]
    }, {
      name: "Akpajo, Eleme",
      outreaches: [{
        title: "Akpajo Outreach", year: 2023,
        summary: "Free medical care and medication, food and relief packs, clothing, and the gospel for families in Akpajo, Eleme.",
        photos: AKPAJO_2023
      }]
    }, {
      name: "Rumukwurushi",
      outreaches: [{
        title: "Rumukwurushi Outreach", year: 2021,
        summary: "A Love Mission to Rumukwurushi, Port Harcourt — relief, care and the good news of Jesus for the community.",
        photos: RUMUKWURUSHI_2021
      }]
    }, {
      name: "Okporo",
      outreaches: [{
        title: "Okporo School Outreach", year: 2020,
        summary: "A Love Mission to Okporo: free medical checks and medication, food packs, clothing and shoes, hair care, and the gospel for pupils, parents and the whole community.",
        photos: OKPORO_2020
      }]
    }]
  },
  {
    slug: "bayelsa", name: "Bayelsa", region: "Bayelsa State", country: "Nigeria", lonlat: [6.26, 4.93], labelDx: -86, labelDy: 22,
    tagline: "Medical missions to the Niger Delta",
    summary: "Free consultations, medication and health education for riverine communities in Bayelsa State — and the joy of the gospel for every family we met.",
    areas: [{
      name: "Sagbama",
      outreaches: [{
        title: "Sagbama Outreach", year: 2026,
        summary: "Food and relief packs for families, gifts for the children, free medical consultations, and prayer with the people of Sagbama, Bayelsa State.",
        photos: SAGBAMA_2026
      }]
    }, {
      name: "Bayelsa State",
      outreaches: [{
        title: "Bayelsa Outreach", year: 2024,
        summary: "Free medical consultations and medication, with the FlagUp Jesus Army volunteers serving families across the community.",
        photos: BAYELSA_2024
      }, {
        title: "Bayelsa State Medical Outreach",
        summary: "Volunteer doctors, nurses and pharmacists saw young and old, dispensed free medication and taught families how to stay well.",
        photos: [PHOTOS.children, PHOTOS.medical, PHOTOS.teaching, PHOTOS.elders]
      }]
    }]
  },
  {
    slug: "lagos", name: "Lagos", region: "Lagos State", country: "Nigeria", lonlat: [3.4, 6.52], labelDx: 12, labelDy: -10,
    tagline: "Medical & village outreaches",
    summary: "Love Missions in and around Lagos — medical outreaches and village visits carrying the gospel and real relief.",
    areas: [{
      name: "Lagos State",
      outreaches: [{
        title: "Lagos State Medical Outreach", year: 2025,
        summary: "Free health checks and medication for women, men and children, with the FUJ Lagos nurses and volunteers.",
        photos: LAGOS_2025
      }]
    }]
  },
  {
    slug: "abuja", name: "Abuja", region: "Federal Capital Territory", country: "Nigeria", lonlat: [7.49, 9.06], labelDx: 12, labelDy: 4,
    tagline: "Village & medical outreaches",
    summary: "Love Missions in and around Abuja — village visits and medical outreaches carrying the gospel and real relief.",
    areas: []
  },
  {
    slug: "united-kingdom", name: "United Kingdom", region: "International", country: "United Kingdom", xy: [34, -44], labelDx: 14, labelDy: 4,
    tagline: "Love beyond Nigeria",
    summary: "The FlagUpJesus family in the United Kingdom, taking the same love — the Word and the Works — beyond Nigeria.",
    areas: []
  }
];

export const missionLocation = (slug: string) => MISSION_LOCATIONS.find((l) => l.slug === slug) ?? null;
export function missionStats(l: MissionLocation) {
  const outreaches = l.areas.flatMap((a) => a.outreaches);
  return { areas: l.areas.length, outreaches: outreaches.length, photos: outreaches.reduce((n, o) => n + o.photos.length, 0), cover: outreaches.find((o) => o.photos.length)?.photos[0] ?? null };
}
