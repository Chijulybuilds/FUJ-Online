export const PHOTOS = {
  pastor: { src: "/images/fuj/pastor-caleb.webp", w: 819, h: 1024, alt: "Pastor Umanuwa D. Caleb, founder and lead pastor of FlagUpJesus Global Ministry" },
  children: { src: "/images/fuj/outreach-children.webp", w: 1024, h: 674, alt: "Pastor Caleb celebrating with children during a medical outreach in Bayelsa State" },
  teaching: { src: "/images/fuj/outreach-teaching.webp", w: 1024, h: 694, alt: "A volunteer sharing health education with a community gathered under a pavilion" },
  elders: { src: "/images/fuj/outreach-elders.webp", w: 768, h: 950, alt: "Elderly men and women waiting to be seen at a free medical outreach" },
  medical: { src: "/images/fuj/outreach-medical.webp", w: 738, h: 952, alt: "Volunteer pharmacists dispensing free medication to villagers" }
} as const;
export type Photo = (typeof PHOTOS)[keyof typeof PHOTOS];
