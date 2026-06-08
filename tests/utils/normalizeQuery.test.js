const { normalizeQuery } = require("../../src/utils/normalizeQuery");

describe("normalizeQuery", () => {
  test("should normalize category and subcategory trimming and casing", () => {
    const result = normalizeQuery(" speaking ", "  read aloud  ");
    expect(result).toEqual({
      category: "Speaking",
      subCategory: "Read Aloud",
    });
  });

  test("should handle hyphen replacements in subcategories", () => {
    const result = normalizeQuery("speaking", "re-tell-lecture");
    expect(result).toEqual({
      category: "Speaking",
      subCategory: "Re-tell Lecture",
    });
  });

  test("should resolve Speaking subcategories properly", () => {
    expect(normalizeQuery("", "answer short question")).toEqual({
      category: "Speaking",
      subCategory: "Answer Short Questions",
    });
    expect(normalizeQuery("", "retell lecture")).toEqual({
      category: "Speaking",
      subCategory: "Re-tell Lecture",
    });
    expect(normalizeQuery("", "summarize group discussion")).toEqual({
      category: "Speaking",
      subCategory: "Summarize Discussion",
    });
  });

  test("should resolve Writing subcategories properly", () => {
    expect(normalizeQuery("", "essay")).toEqual({
      category: "Writing",
      subCategory: "Write Essay",
    });
    expect(normalizeQuery("", "summarize written text (core)")).toEqual({
      category: "Writing",
      subCategory: "Summarize Written Text",
    });
  });

  test("should resolve Reading subcategories properly", () => {
    expect(normalizeQuery("", "reorder paragraphs")).toEqual({
      category: "Reading",
      subCategory: "Reorder Paragraph",
    });
    expect(normalizeQuery("", "fill in the blanks (drag and drop)")).toEqual({
      category: "Reading",
      subCategory: "Reading Fill in the Blanks",
    });
    expect(normalizeQuery("", "fill in the blanks (dropdown)")).toEqual({
      category: "Reading",
      subCategory: "Fill in the Blanks Reading & Writing",
    });
  });

  test("should resolve Listening subcategories properly", () => {
    expect(normalizeQuery("", "summarize spoken text")).toEqual({
      category: "Listening",
      subCategory: "Summarize Spoken Text",
    });
    expect(normalizeQuery("", "highlight incorrect words")).toEqual({
      category: "Listening",
      subCategory: "Highlight Incorrect Word",
    });
    expect(normalizeQuery("", "write from dictation")).toEqual({
      category: "Listening",
      subCategory: "Write from Dictation",
    });
  });

  test("should resolve MCQ subcategories based on category context", () => {
    // If category is Listening
    expect(normalizeQuery("Listening", "mcq single answer")).toEqual({
      category: "Listening",
      subCategory: "MCQ Single Answer",
    });
    expect(normalizeQuery("Listening", "mcq multiple answer")).toEqual({
      category: "Listening",
      subCategory: "MCQ Multiple Answer",
    });

    // Default to Reading
    expect(normalizeQuery("Reading", "mcq single answer")).toEqual({
      category: "Reading",
      subCategory: "Multiple Choice Single Answer",
    });
    expect(normalizeQuery("Reading", "mcq multiple answer")).toEqual({
      category: "Reading",
      subCategory: "Multiple Choice Multiple Answer",
    });
  });

  test("should resolve general fill in the blanks based on category context", () => {
    // If Listening
    expect(normalizeQuery("Listening", "fill in the blanks")).toEqual({
      category: "Listening",
      subCategory: "Listening Fill in the Blanks",
    });
    // Default to Reading
    expect(normalizeQuery("", "fill in the blanks")).toEqual({
      category: "Reading",
      subCategory: "Reading Fill in the Blanks",
    });
  });
});
