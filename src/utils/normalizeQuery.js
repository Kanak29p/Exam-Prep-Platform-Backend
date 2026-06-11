// Maps incoming category/subCategory variants to the canonical values stored in Snowflake.
function normalizeQuery(category, subCategory) {
  let mappedCat = (category || "").trim();
  let mappedSub = (subCategory || "").trim().replace(/-/g, " ");

  const lowerCat = mappedCat.toLowerCase();
  const lowerSub = mappedSub.toLowerCase();

  // 1. Resolve Category
  if (lowerCat === "speaking" || lowerCat === "speaking & writing" || lowerCat === "speaking and writing") {
    mappedCat = "Speaking";
  } else if (lowerCat === "writing") {
    mappedCat = "Writing";
  } else if (lowerCat === "reading") {
    mappedCat = "Reading";
  } else if (lowerCat === "listening") {
    mappedCat = "Listening";
  }

  // 2. Resolve Subcategory and correct category if needed
  if (lowerSub === "re tell lecture" || lowerSub === "retell lecture" || lowerSub === "re-tell lecture") {
    mappedCat = "Speaking";
    mappedSub = "Re-tell Lecture";
  } else if (lowerSub === "answer short question" || lowerSub === "answer short questions") {
    mappedCat = "Speaking";
    mappedSub = "Answer Short Questions";
  } else if (lowerSub === "read aloud") {
    mappedCat = "Speaking";
    mappedSub = "Read Aloud";
  } else if (lowerSub === "repeat sentence") {
    mappedCat = "Speaking";
    mappedSub = "Repeat Sentence";
  } else if (lowerSub === "describe image") {
    mappedCat = "Speaking";
    mappedSub = "Describe Image";
  } else if (lowerSub === "respond to a situation") {
    mappedCat = "Speaking";
    mappedSub = "Respond to a Situation";
  } else if (lowerSub === "summarize discussion" || lowerSub === "summarize group discussion") {
    mappedCat = "Speaking";
    mappedSub = "Summarize Discussion";
  } else if (lowerSub === "personal introduction") {
    mappedCat = "Speaking";
    mappedSub = "Personal Introduction";
  }
  
  // Writing
  else if (lowerSub === "essay" || lowerSub === "write essay") {
    mappedCat = "Writing";
    mappedSub = "Write Essay";
  } else if (lowerSub === "summarize written text" || lowerSub === "summarize written text (core)") {
    mappedCat = "Writing";
    mappedSub = "Summarize Written Text";
  }
  
  // Reading
  else if (lowerSub === "reorder paragraph" || lowerSub === "reorder paragraphs" || lowerSub === "re-order paragraphs") {
    mappedCat = "Reading";
    mappedSub = "Reorder Paragraph";
  } else if (lowerSub === "reading fill in the blanks" || lowerSub === "reading: fill in the blanks" || lowerSub === "fill in the blanks (drag and drop)") {
    mappedCat = "Reading";
    mappedSub = "Reading Fill in the Blanks";
  } else if (lowerSub === "fill in the blanks reading & writing" || lowerSub === "reading & writing: fill in the blanks" || lowerSub === "r/w fill in blanks" || lowerSub === "fill in the blanks (dropdown)") {
    mappedCat = "Reading";
    mappedSub = "Fill in the Blanks Reading & Writing";
  }
  
  // Listening
  else if (lowerSub === "summarize spoken text" || lowerSub === "summarize spoken text (core)") {
    mappedCat = "Listening";
    mappedSub = "Summarize Spoken Text";
  } else if (lowerSub === "highlight correct summary") {
    mappedCat = "Listening";
    mappedSub = "Highlight Correct Summary";
  } else if (lowerSub === "select missing word") {
    mappedCat = "Listening";
    mappedSub = "Select Missing Word";
  } else if (lowerSub === "highlight incorrect word" || lowerSub === "highlight incorrect words") {
    mappedCat = "Listening";
    mappedSub = "Highlight Incorrect Word";
  } else if (lowerSub === "write from dictation") {
    mappedCat = "Listening";
    mappedSub = "Write from Dictation";
  }
  
  // Ambiguous Single/Multiple choices and general "fill in the blanks"
  else if (lowerSub === "multiple choice single answer" || lowerSub === "multiple choice, single answer" || lowerSub === "single answer" || lowerSub === "mcq single answer") {
    if (mappedCat === "Listening") {
      mappedSub = "MCQ Single Answer";
    } else {
      mappedCat = "Reading";
      mappedSub = "Multiple Choice Single Answer";
    }
  } else if (lowerSub === "multiple choice multiple answer" || lowerSub === "multiple choice, multiple answer" || lowerSub === "multiple choice, multiple answers" || lowerSub === "multiple answers" || lowerSub === "mcq multiple answer") {
    if (mappedCat === "Listening") {
      mappedSub = "MCQ Multiple Answer";
    } else {
      mappedCat = "Reading";
      mappedSub = "Multiple Choice Multiple Answer";
    }
  } else if (lowerSub === "fill in blanks" || lowerSub === "fill in the blanks" || lowerSub === "fill in the blanks (type in)" || lowerSub === "listening fill in the blanks") {
    if (mappedCat === "Listening") {
      mappedSub = "Listening Fill in the Blanks";
    } else {
      mappedCat = "Reading";
      mappedSub = "Reading Fill in the Blanks";
    }
  }

  return { category: mappedCat, subCategory: mappedSub };
}

module.exports = { normalizeQuery };
