import { describe, expect, it } from "vitest";
import { canEdit, completedSteps, isStepComplete, type TeacherWithApplication } from "@/server/application";

function teacher(over: Record<string, unknown> = {}, app: Record<string, unknown> = {}, reviews: unknown[] = []) {
  return {
    subjects: ["FRENCH"],
    spokenLanguages: [{ language: "FRENCH", level: "NATIVE" }],
    countryOfBirth: "CM",
    photoUrl: "/api/files/p",
    videoUrl: "/api/files/v",
    certificates: [],
    educations: [],
    headlineEn: "French teacher for adults",
    headlineFr: "Professeure de français pour adultes",
    bioEn: "x".repeat(120),
    bioFr: "y".repeat(120),
    specialties: ["GRAMMAR"],
    availability: [{ weekday: 1, startMin: 1080, endMin: 1200 }],
    hourlyRateXaf: 5000,
    trialRateXaf: 2000,
    ...over,
    application: {
      status: "DRAFT",
      round: 1,
      noCertificate: true,
      noEducation: true,
      idDocumentType: "CNI",
      idFrontDocId: "f",
      idBackDocId: "b",
      idSelfieDocId: "s",
      termsAcceptedAt: null,
      reviews,
      ...app,
    },
  } as unknown as TeacherWithApplication;
}

describe("step completion", () => {
  it("a full draft has every step done except the agreement", () => {
    expect(completedSteps(teacher())).toHaveLength(9);
    expect(isStepComplete("AGREEMENT", teacher())).toBe(false);
  });

  it("needs the back of an ID card, but not of a passport", () => {
    expect(isStepComplete("IDENTITY", teacher({}, { idBackDocId: null }))).toBe(false);
    expect(isStepComplete("IDENTITY", teacher({}, { idBackDocId: null, idDocumentType: "PASSPORT" }))).toBe(true);
  });

  it("certificates: a file or an explicit 'I have none'", () => {
    expect(isStepComplete("CERTIFICATION", teacher({}, { noCertificate: false }))).toBe(false);
    expect(isStepComplete("CERTIFICATION", teacher({ certificates: [{}] }, { noCertificate: false }))).toBe(true);
  });

  it("descriptions must be written in both languages", () => {
    expect(isStepComplete("DESCRIPTION", teacher({ bioFr: "" }))).toBe(false);
  });
});

describe("who can edit what", () => {
  const review = (section: string, decision: string, round = 1) => ({ section, decision, round, comment: "c" });

  it("everything while drafting, nothing while under review", () => {
    expect(canEdit("PHOTO", teacher())).toBe(true);
    expect(canEdit("PHOTO", teacher({}, { status: "UNDER_REVIEW" }))).toBe(false);
    expect(canEdit("AGREEMENT", teacher({}, { status: "SUBMITTED" }))).toBe(false);
  });

  it("only the sections marked for changes, plus the submit step", () => {
    const t = teacher({}, { status: "CHANGES_REQUESTED" }, [review("PHOTO", "NEEDS_CHANGES"), review("ABOUT", "APPROVED")]);
    expect(canEdit("PHOTO", t)).toBe(true);
    expect(canEdit("ABOUT", t)).toBe(false);
    expect(canEdit("VIDEO", t)).toBe(false);
    expect(canEdit("AGREEMENT", t)).toBe(true);
  });

  it("ignores decisions from older rounds", () => {
    const t = teacher({}, { status: "CHANGES_REQUESTED", round: 2 }, [review("PHOTO", "NEEDS_CHANGES", 1), review("VIDEO", "NEEDS_CHANGES", 2)]);
    expect(canEdit("PHOTO", t)).toBe(false);
    expect(canEdit("VIDEO", t)).toBe(true);
  });
});
